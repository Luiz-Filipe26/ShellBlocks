import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { SANDBOX_EXECUTION_TIMEOUT_MS } from "@shellblocks/shared/config/sandbox";
import type { ExecutionResult, StageResult } from "@shellblocks/shared/contracts/execution";
import { ensureDockerImageExists } from "@/services/dockerService";
import { runInSandbox } from "@/services/sandboxRunner";

const SUITE_LABEL_KEY = "shellblocks.test-run";
const SUITE_ID = randomUUID();
const SUITE_LABEL = SUITE_LABEL_KEY + "=" + SUITE_ID;
const TIMEOUT_SCHEDULING_TOLERANCE_MS = 2_000;
const TIMEOUT_CLEANUP_ALLOWANCE_MS = 12_000;
let expectPossibleLateContainerCreation = false;

function expectCompleted(
    result: ExecutionResult,
): asserts result is Extract<ExecutionResult, { status: "completed" }> {
    expect(result.status).toBe("completed");
}

function output(stage: StageResult, stream: "stdout" | "stderr"): Buffer {
    return Buffer.from(
        stream === "stdout" ? stage.stdoutBase64 : stage.stderrBase64,
        "base64",
    );
}

function listSuiteContainers(): string[] {
    return execFileSync(
        "docker",
        ["ps", "-a", "--filter", "label=" + SUITE_LABEL, "--format", "{{.Names}}"],
        { encoding: "utf8" },
    ).split("\n").filter(Boolean);
}

async function waitForCleanup(): Promise<string[]> {
    const deadline = Date.now() + 8_000;
    let remaining = listSuiteContainers();
    do {
        if (remaining.length === 0 && !expectPossibleLateContainerCreation) return [];
        await new Promise((resolve) => setTimeout(resolve, 100));
        remaining = listSuiteContainers();
    } while (Date.now() < deadline);
    return remaining;
}

function runOwnedSandbox(
    userScript: string,
    setupScript = "",
    verificationScript = "",
) {
    return runInSandbox(
        { userScript, setupScript, verificationScript },
        { containerLabel: SUITE_LABEL },
    );
}

describe("runInSandbox com Docker real", () => {
    beforeAll(() => {
        try {
            execFileSync("docker", ["info"], { stdio: "pipe" });
        } catch (error) {
            throw new Error("A integração exige Docker acessível: " + String(error));
        }
        const startedAt = performance.now();
        ensureDockerImageExists([
            {
                name: "Dockerfile.sandbox",
                content: readFileSync(new URL("../../src/docker/Dockerfile.sandbox", import.meta.url), "utf8"),
            },
            {
                name: "runner.sandbox.js",
                content: readFileSync(new URL("../../src/docker/runner.sandbox.js", import.meta.url), "utf8"),
            },
        ]);
        console.log(
            "[docker-test] preparação da imagem: " +
                Math.round(performance.now() - startedAt) +
                " ms",
        );
    });

    afterEach(async () => {
        const leaked = await waitForCleanup();
        if (leaked.length > 0) {
            execFileSync("docker", ["rm", "-f", ...leaked], { stdio: "pipe" });
        }
        expectPossibleLateContainerCreation = false;
        expect(leaked, "containers da suíte não foram removidos").toEqual([]);
    });

    it("preserva stdout, stderr e exit code separadamente", async () => {
        const result = await runOwnedSandbox("printf saida; printf erro >&2; false");
        expectCompleted(result);
        expect(output(result.execution, "stdout").toString()).toBe("saida");
        expect(output(result.execution, "stderr").toString()).toBe("erro");
        expect(result.execution.exitCode).toBe(1);
    });

    it("compartilha filesystem do setup executado como aluno", async () => {
        const result = await runOwnedSandbox(
            "printf 'uid=%s gid=%s ' \"$(id -u)\" \"$(id -g)\"; cat preparado.txt",
            "printf 'conteúdo preparado' > preparado.txt",
        );
        expectCompleted(result);
        expect(result.setup?.exitCode).toBe(0);
        expect(output(result.execution, "stdout").toString()).toBe(
            "uid=1000 gid=1000 conteúdo preparado",
        );
    });

    it("mantém processos de background disponíveis entre os estágios", async () => {
        const result = await runOwnedSandbox(
            "ps aux | grep -v grep | grep -q setup-marker; sh -c 'sleep 30; :' user-marker &",
            "sh -c 'sleep 30; :' setup-marker &",
            "ps aux | grep -v grep | grep -q setup-marker && ps aux | grep -v grep | grep -q user-marker",
        );
        expectCompleted(result);
        expect(result).toMatchObject({
            execution: { exitCode: 0 },
            verification: { exitCode: 0 },
        });
    });

    it("impede execução e verificação depois de falha no setup", async () => {
        const result = await runOwnedSandbox(
            "touch aluno-executou",
            "printf setup-out; printf setup-err >&2; false",
            "touch verificador-executou",
        );
        expect(result.status).toBe("setup_failed");
        if (result.status !== "setup_failed") return;
        expect(output(result.setup, "stdout").toString()).toBe("setup-out");
        expect(output(result.setup, "stderr").toString()).toBe("setup-err");
        expect(result.execution).toBeNull();
        expect(result.verification).toBeNull();
    });

    it("executa verificação root com efeitos e artefatos privados", async () => {
        const userScript = "printf resultado > resultado.txt";
        const verificationScript = [
            "test \"$(id -u):$(id -g)\" = 0:0",
            "test \"$(cat resultado.txt)\" = resultado",
            "test \"$(stat -c %a \"$SHELLBLOCKS_USER_SCRIPT_FILE\")\" = 600",
            "test \"$(stat -c %a \"$SHELLBLOCKS_LAST_CMD_OUT_FILE\")\" = 600",
            "printf verificado",
        ].join(" && ");
        const result = await runOwnedSandbox(userScript, "", verificationScript);
        expectCompleted(result);
        expect(result.verification?.exitCode).toBe(0);
        expect(output(result.verification!, "stdout").toString()).toBe("verificado");
    });

    it("não permite ao aluno ler o diretório privado", async () => {
        const result = await runOwnedSandbox(
            "test ! -r /run/shellblocks && printf privado",
            "",
            "test -r \"$SHELLBLOCKS_USER_SCRIPT_FILE\"",
        );
        expectCompleted(result);
        expect(output(result.execution, "stdout").toString()).toBe("privado");
        expect(result.verification?.exitCode).toBe(0);
    });

    it("expõe source exato e stdout seguido de stderr", async () => {
        const userScript = "printf 'saida|'; printf 'erro\\\\fim' >&2";
        const verificationScript = [
            "cmp -s \"$SHELLBLOCKS_USER_SCRIPT_FILE\" source-esperado",
            "test \"$(cat \"$SHELLBLOCKS_LAST_CMD_OUT_FILE\")\" = 'saida|erro\\fim'",
        ].join(" && ");
        const setupScript =
            "printf %s " + shellQuote(userScript) + " > source-esperado";
        const result = await runOwnedSandbox(
            userScript,
            setupScript,
            verificationScript,
        );
        expectCompleted(result);
        expect(result.verification?.exitCode).toBe(0);
    });

    it("não confunde reprovação pedagógica com infraestrutura", async () => {
        const result = await runOwnedSandbox(
            "true",
            "",
            "printf feedback; printf detalhe >&2; exit 7",
        );
        expectCompleted(result);
        expect(result.execution.exitCode).toBe(0);
        expect(result.verification?.exitCode).toBe(7);
        expect(output(result.verification!, "stdout").toString()).toBe("feedback");
        expect(output(result.verification!, "stderr").toString()).toBe("detalhe");
    });

    it("preserva exit explícito e expõe o cwd final ao verificador", async () => {
        const result = await runOwnedSandbox(
            "mkdir destino; cd destino; exit 9",
            "",
            "test \"$SHELLBLOCKS_FINAL_CWD\" = /home/aluno/destino",
        );
        expectCompleted(result);
        expect(result).toMatchObject({
            execution: { exitCode: 9 },
            verification: { exitCode: 0 },
        });
    });

    it("preserva framing difícil e bytes não UTF-8 em Base64", async () => {
        const result = await runOwnedSandbox(
            "printf 'linha|\\n\"aspas\"\\\\barra Unicode: ç __SHELLBLOCKS_RESULT__\\n'; printf '\\377\\000A'",
        );
        expectCompleted(result);
        const expectedPrefix = Buffer.from(
            "linha|\n\"aspas\"\\barra Unicode: ç __SHELLBLOCKS_RESULT__\n",
        );
        expect(output(result.execution, "stdout")).toEqual(
            Buffer.concat([expectedPrefix, Buffer.from([0xff, 0x00, 0x41])]),
        );
    });

    it("interrompe no timeout e remove o container", async () => {
        expectPossibleLateContainerCreation = true;
        const startedAt = performance.now();
        const result = await runOwnedSandbox("sleep 30");
        const elapsed = performance.now() - startedAt;
        expect(result).toMatchObject({
            status: "infrastructure_error",
            reason: "timeout",
        });
        expect(elapsed).toBeGreaterThanOrEqual(
            SANDBOX_EXECUTION_TIMEOUT_MS - TIMEOUT_SCHEDULING_TOLERANCE_MS,
        );
        expect(elapsed).toBeLessThan(
            SANDBOX_EXECUTION_TIMEOUT_MS + TIMEOUT_CLEANUP_ALLOWANCE_MS,
        );
    }, SANDBOX_EXECUTION_TIMEOUT_MS + TIMEOUT_CLEANUP_ALLOWANCE_MS + 5_000);
});

function shellQuote(value: string): string {
    return "'" + value.replaceAll("'", "'\"'\"'") + "'";
}
