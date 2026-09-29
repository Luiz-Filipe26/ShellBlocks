import { spawn } from "node:child_process";

export interface DockerCommandOptions {
    input?: Buffer;
    signal?: AbortSignal;
}

export type DockerCommandOutcome =
    | { kind: "succeeded"; stdout: Buffer; stderr: Buffer }
    | { kind: "failed"; stdout: Buffer; stderr: Buffer; exitCode: number }
    | { kind: "aborted" }
    | { kind: "spawn-failed"; error: Error }
    | { kind: "input-failed"; error: Error };

export type RunDockerCommand = (
    args: readonly string[],
    options?: DockerCommandOptions,
) => Promise<DockerCommandOutcome>;

export const runDockerCommand: RunDockerCommand = (args, options = {}) => {
    if (options.signal?.aborted) return Promise.resolve({ kind: "aborted" });

    return new Promise((resolve) => {
        let child;
        try {
            child = spawn("docker", [...args], {
                stdio: ["pipe", "pipe", "pipe"],
                signal: options.signal,
                killSignal: "SIGKILL",
            });
        } catch (error) {
            resolve({ kind: "spawn-failed", error: toError(error) });
            return;
        }

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let processError: Error | undefined;
        let inputError: Error | undefined;

        child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

        child.once("error", (error: Error) => {
            processError = error;
        });
        child.stdin.on("error", (error: NodeJS.ErrnoException) => {
            if (error.code === "EPIPE") return;
            inputError = error;
            child.kill("SIGKILL");
        });
        child.once("close", (exitCode) => {
            if (
                options.signal?.aborted ||
                processError?.name === "AbortError"
            ) {
                resolve({ kind: "aborted" });
            } else if (processError) {
                resolve({ kind: "spawn-failed", error: processError });
            } else if (inputError) {
                resolve({ kind: "input-failed", error: inputError });
            } else {
                const output = {
                    stdout: Buffer.concat(stdout),
                    stderr: Buffer.concat(stderr),
                };
                resolve(
                    exitCode === 0
                        ? { kind: "succeeded", ...output }
                        : {
                            kind: "failed",
                            ...output,
                            exitCode: exitCode ?? 1,
                        },
                );
            }
        });
        child.stdin.end(options.input);
    });
};

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
