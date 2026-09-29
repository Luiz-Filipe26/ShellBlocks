import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runDockerCommand } from "../../src/services/dockerCommand";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

function fakeProcess() {
    const events = new EventEmitter();
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const kill = vi.fn(() => true);
    const child = Object.assign(events, { stdin, stdout, stderr, kill });
    vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcess);
    return child;
}

describe("runDockerCommand", () => {
    afterEach(() => vi.resetAllMocks());

    it("não inicia um processo se o sinal já foi abortado", async () => {
        const controller = new AbortController();
        controller.abort();
        expect(await runDockerCommand(["create"], { signal: controller.signal })).toEqual({
            kind: "aborted",
        });
        expect(spawn).not.toHaveBeenCalled();
    });

    it.each([
        { exitCode: 0, expectedKind: "succeeded" },
        { exitCode: 17, expectedKind: "failed" },
    ])("exit code $exitCode resulta em $expectedKind", async ({ exitCode, expectedKind }) => {
        const child = fakeProcess();
        const pending = runDockerCommand(["inspect"]);
        child.stdout.write(Buffer.from([0xff, 0x00]));
        child.stderr.write("erro");
        child.emit("close", exitCode);

        const outcome = await pending;
        expect(outcome.kind).toBe(expectedKind);
        expect(outcome).toMatchObject({
            stdout: Buffer.from([0xff, 0x00]),
            stderr: Buffer.from("erro"),
        });
        if (expectedKind === "failed") {
            expect(outcome).toMatchObject({ exitCode });
        }
    });

    it("aguarda o fechamento do processo após um abort", async () => {
        const child = fakeProcess();
        const controller = new AbortController();
        const pending = runDockerCommand(["create"], { signal: controller.signal });
        let completed = false;
        void pending.then(() => { completed = true; });

        controller.abort();
        child.emit("error", Object.assign(new Error("abortado"), { name: "AbortError" }));
        await Promise.resolve();
        expect(completed).toBe(false);

        child.emit("close", null);
        expect(await pending).toEqual({ kind: "aborted" });
        expect(spawn).toHaveBeenCalledWith("docker", ["create"], expect.objectContaining({
            signal: controller.signal,
            killSignal: "SIGKILL",
        }));
    });

    it("distingue falha de spawn de falha no envio da entrada", async () => {
        const missing = fakeProcess();
        const spawnPending = runDockerCommand(["create"]);
        missing.emit("error", new Error("docker ausente"));
        missing.emit("close", null);
        expect(await spawnPending).toMatchObject({
            kind: "spawn-failed", error: { message: "docker ausente" },
        });

        const created = fakeProcess();
        const inputPending = runDockerCommand(["create"]);
        created.stdin.emit("error", new Error("stdin falhou"));
        created.emit("close", null);
        expect(await inputPending).toMatchObject({
            kind: "input-failed", error: { message: "stdin falhou" },
        });
        expect(created.kill).toHaveBeenCalledWith("SIGKILL");
    });
});
