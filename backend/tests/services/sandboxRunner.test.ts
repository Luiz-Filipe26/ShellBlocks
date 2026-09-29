import { afterEach, describe, expect, it, vi } from "vitest";
import type {
    DockerCommandOutcome,
    RunDockerCommand,
} from "@/services/dockerCommand";
import { runInSandbox } from "@/services/sandboxRunner";

const empty = Buffer.alloc(0);
const stage = { exitCode: 0, stdoutBase64: "b2s=", stderrBase64: "" };

function succeeded(stdout: unknown = ""): DockerCommandOutcome {
    return {
        kind: "succeeded",
        stdout: Buffer.from(
            typeof stdout === "string" ? stdout : JSON.stringify(stdout),
        ),
        stderr: empty,
    };
}

function failed(message: string): DockerCommandOutcome {
    return {
        kind: "failed",
        stdout: empty,
        stderr: Buffer.from(message),
        exitCode: 1,
    };
}

function runnerResult() {
    return {
        status: "completed",
        setup: null,
        execution: stage,
        verification: null,
    };
}

describe("runInSandbox sem Docker real", () => {
    afterEach(() => vi.restoreAllMocks());

    it("cria, executa e remove o container preservando a label", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args, options) => {
            if (args[0] === "start") {
                expect(
                    JSON.parse(options?.input?.toString("utf8") ?? ""),
                ).toEqual({
                    setupScript: "",
                    userScript: "echo ok",
                    verificationScript: "",
                });
                return succeeded(runnerResult());
            }
            return succeeded();
        });
        expect(
            await runInSandbox(
                { userScript: "echo ok" },
                { containerLabel: "shellblocks.test-run=suite" },
                runDocker,
            ),
        ).toMatchObject({ status: "completed" });

        const createArgs = runDocker.mock.calls[0][0];
        expect(createArgs).toContain("shellblocks.test-run=suite");
        const containerName = createArgs[createArgs.indexOf("--name") + 1];
        expect(runDocker).toHaveBeenCalledWith(
            ["rm", "-f", containerName],
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it("classifica criação rejeitada e tenta remover um container parcial", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) =>
            args[0] === "create" ? failed("create falhou") : succeeded(),
        );
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "docker_error",
            details: "create falhou",
        });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "rm",
        ]);
    });

    it("trata container conhecido ausente como limpeza concluída", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) => {
            if (args[0] === "start") return succeeded(runnerResult());
            if (args[0] === "rm") return failed("No such container");
            return succeeded();
        });

        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({ status: "completed" });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "start",
            "rm",
        ]);
    });

    it("não remove container se o processo Docker não pôde iniciar", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async () => ({
            kind: "spawn-failed",
            error: new Error("docker indisponível"),
        }));
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "docker_error",
            details: "docker indisponível",
        });
        expect(runDocker).toHaveBeenCalledOnce();
    });

    it("continua reconciliando criação abortada após 'not found'", async () => {
        let attempts = 0;
        const runDocker = vi.fn<RunDockerCommand>(async (args) => {
            if (args[0] === "create") return { kind: "aborted" };
            return ++attempts === 1 ? failed("No such container") : succeeded();
        });
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "timeout",
        });
        await vi.waitFor(() => expect(attempts).toBe(2));
    });

    it("reconcilia criação incerta após falha de entrada", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) =>
            args[0] === "create"
                ? { kind: "input-failed", error: new Error("stdin falhou") }
                : succeeded(),
        );
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "docker_error",
            details: "stdin falhou",
        });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "rm",
        ]);
    });

    it.each([
        {
            caseName: "resposta não JSON",
            startOutcome: succeeded("não-json"),
            reason: "invalid_protocol",
        },
        {
            caseName: "falha do runner",
            startOutcome: failed("runner falhou"),
            reason: "docker_error",
        },
    ] as const)("classifica $caseName e limpa o container", async ({ startOutcome, reason }) => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) =>
            args[0] === "start" ? startOutcome : succeeded(),
        );
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason,
        });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "start",
            "rm",
        ]);
    });

    it("rejeita status infrastructure_error recebido do runner como protocolo inválido", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) =>
            args[0] === "start"
                ? succeeded({
                    status: "infrastructure_error",
                    reason: "internal_error",
                    message: "erro interno",
                })
                : succeeded(),
        );

        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "invalid_protocol",
        });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "start",
            "rm",
        ]);
    });

    it("classifica execução abortada como timeout e remove o container conhecido", async () => {
        const runDocker = vi.fn<RunDockerCommand>(async (args) =>
            args[0] === "start" ? { kind: "aborted" } : succeeded(),
        );
        expect(
            await runInSandbox({ userScript: "sleep 30" }, {}, runDocker),
        ).toMatchObject({
            status: "infrastructure_error",
            reason: "timeout",
        });
        expect(runDocker.mock.calls.map(([args]) => args[0])).toEqual([
            "create",
            "start",
            "rm",
        ]);
    });

    it("repete a remoção quando a primeira tentativa falha", async () => {
        let attempts = 0;
        const runDocker = vi.fn<RunDockerCommand>(async (args) => {
            if (args[0] === "start") return succeeded(runnerResult());
            if (args[0] === "rm")
                return ++attempts === 1 ? failed("falha") : succeeded();
            return succeeded();
        });
        expect(
            await runInSandbox({ userScript: "echo ok" }, {}, runDocker),
        ).toMatchObject({
            status: "completed",
        });
        await vi.waitFor(() => expect(attempts).toBe(2));
    });
});
