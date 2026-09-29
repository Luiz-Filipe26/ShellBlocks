import { randomUUID } from "node:crypto";
import {
    SANDBOX_EXECUTION_TIMEOUT_MS,
    SANDBOX_IMAGE_NAME,
} from "@shellblocks/shared/config/sandbox";
import {
    ExecutionResultSchema,
    ExecutionStatus,
    type ExecutionResult,
    type InfrastructureErrorReason,
    type RunRequest,
} from "@shellblocks/shared/contracts/execution";
import { runDockerCommand, type RunDockerCommand } from "./dockerCommand";

export interface SandboxRunOptions {
    containerLabel?: string;
}

type ContainerCreationResult =
    | { kind: "created" }
    | { kind: "rejected"; details: string }
    | { kind: "aborted" }
    | { kind: "spawn-failed"; error: Error }
    | { kind: "uncertain"; error: Error };

type ContainerRemovalResult =
    | { kind: "removed" }
    | { kind: "not-found" }
    | { kind: "failed" };

const CONTAINER_NAME_PREFIX = "shellblocks-";
const CLEANUP_COMMAND_TIMEOUT_MS = 1_000;
const CLEANUP_RECONCILIATION_MS = 5_000;
const CLEANUP_RETRY_INTERVAL_MS = 250;

export async function runInSandbox(
    request: RunRequest,
    options: SandboxRunOptions = {},
    runDocker: RunDockerCommand = runDockerCommand,
): Promise<ExecutionResult> {
    const containerName = `${CONTAINER_NAME_PREFIX}${randomUUID()}`;
    const executionSignal = AbortSignal.timeout(SANDBOX_EXECUTION_TIMEOUT_MS);

    try {
        const creation = await createContainer(
            containerName,
            options,
            executionSignal,
            runDocker,
        );

        switch (creation.kind) {
            case "created":
                return await runCreatedContainer(
                    containerName,
                    request,
                    executionSignal,
                    runDocker,
                );

            case "rejected":
                await cleanupKnownContainer(containerName, runDocker);
                return infrastructureError(
                    "docker_error",
                    "O ambiente isolado não pôde ser criado.",
                    creation.details,
                );

            case "aborted":
                void reconcileUncertainCreation(containerName, runDocker);
                return timeoutError();

            case "uncertain":
                void reconcileUncertainCreation(containerName, runDocker);
                return infrastructureError(
                    "docker_error",
                    "O ambiente isolado não pôde ser criado.",
                    creation.error.message,
                );

            case "spawn-failed":
                return infrastructureError(
                    "docker_error",
                    "Não foi possível executar o Docker.",
                    creation.error.message,
                );
        }
    } catch (error) {
        void reconcileUncertainCreation(containerName, runDocker);
        return infrastructureError(
            "internal_error",
            "Ocorreu um erro interno durante a execução.",
            errorMessage(error),
        );
    }
}

async function createContainer(
    containerName: string,
    options: SandboxRunOptions,
    signal: AbortSignal,
    runDocker: RunDockerCommand,
): Promise<ContainerCreationResult> {
    const args = [
        "create",
        "--name",
        containerName,
        "--net",
        "none",
        "--memory",
        "100m",
        "--cpus",
        "0.5",
        "--interactive",
    ];
    if (options.containerLabel !== undefined) {
        args.push("--label", options.containerLabel);
    }
    args.push(SANDBOX_IMAGE_NAME);

    const outcome = await runDocker(args, { signal });
    switch (outcome.kind) {
        case "succeeded":
            return { kind: "created" };
        case "failed":
            return {
                kind: "rejected",
                details: outcome.stderr.toString("utf8"),
            };
        case "aborted":
            return { kind: "aborted" };
        case "spawn-failed":
            return { kind: "spawn-failed", error: outcome.error };
        case "input-failed":
            return { kind: "uncertain", error: outcome.error };
    }
}

async function runCreatedContainer(
    containerName: string,
    request: RunRequest,
    signal: AbortSignal,
    runDocker: RunDockerCommand,
): Promise<ExecutionResult> {
    try {
        return await executeContainer(
            containerName,
            request,
            signal,
            runDocker,
        );
    } catch (error) {
        return infrastructureError(
            "internal_error",
            "Ocorreu um erro interno durante a execução.",
            errorMessage(error),
        );
    } finally {
        await cleanupKnownContainer(containerName, runDocker);
    }
}

async function executeContainer(
    containerName: string,
    request: RunRequest,
    signal: AbortSignal,
    runDocker: RunDockerCommand,
): Promise<ExecutionResult> {
    const input = Buffer.from(
        JSON.stringify({
            setupScript: request.setupScript ?? "",
            userScript: request.userScript,
            verificationScript: request.verificationScript ?? "",
        }),
    );
    const outcome = await runDocker(
        ["start", "--attach", "--interactive", containerName],
        { input, signal },
    );

    switch (outcome.kind) {
        case "succeeded":
            return decodeRunnerResult(outcome.stdout);
        case "failed":
            return infrastructureError(
                "docker_error",
                "O runner isolado não pôde concluir a execução.",
                outcome.stderr.toString("utf8"),
            );
        case "aborted":
            return timeoutError();
        case "spawn-failed":
        case "input-failed":
            return infrastructureError(
                "docker_error",
                "Não foi possível executar o runner isolado.",
                outcome.error.message,
            );
    }
}

function decodeRunnerResult(stdout: Buffer): ExecutionResult {
    let decoded: unknown;
    try {
        decoded = JSON.parse(stdout.toString("utf8"));
    } catch (error) {
        return invalidProtocol(errorMessage(error));
    }

    const parsed = ExecutionResultSchema.safeParse(decoded);
    if (!parsed.success) return invalidProtocol(parsed.error.message);
    if (parsed.data.status === ExecutionStatus.INFRASTRUCTURE_ERROR) {
        return invalidProtocol(
            "O runner retornou um status reservado ao backend.",
        );
    }
    return parsed.data;
}

async function cleanupKnownContainer(
    containerName: string,
    runDocker: RunDockerCommand,
): Promise<void> {
    const removal = await removeContainerOnce(containerName, runDocker);
    if (removal.kind === "failed") {
        void reconcileKnownContainerRemoval(containerName, runDocker);
    }
}

async function removeContainerOnce(
    containerName: string,
    runDocker: RunDockerCommand,
): Promise<ContainerRemovalResult> {
    try {
        const outcome = await runDocker(["rm", "-f", containerName], {
            signal: AbortSignal.timeout(CLEANUP_COMMAND_TIMEOUT_MS),
        });
        switch (outcome.kind) {
            case "succeeded":
                return { kind: "removed" };
            case "failed":
                return /No such container/i.test(
                    outcome.stderr.toString("utf8"),
                )
                    ? { kind: "not-found" }
                    : { kind: "failed" };
            case "aborted":
            case "spawn-failed":
            case "input-failed":
                return { kind: "failed" };
        }
    } catch {
        return { kind: "failed" };
    }
}

async function reconcileKnownContainerRemoval(
    containerName: string,
    runDocker: RunDockerCommand,
): Promise<void> {
    const deadline = Date.now() + CLEANUP_RECONCILIATION_MS;
    do {
        const removal = await removeContainerOnce(containerName, runDocker);
        if (removal.kind === "removed" || removal.kind === "not-found") return;
        await sleep(CLEANUP_RETRY_INTERVAL_MS);
    } while (Date.now() < deadline);
    console.error(
        `[Docker] A limpeza do container ${containerName} não pôde ser confirmada.`,
    );
}

async function reconcileUncertainCreation(
    containerName: string,
    runDocker: RunDockerCommand,
): Promise<void> {
    const deadline = Date.now() + CLEANUP_RECONCILIATION_MS;
    do {
        const removal = await removeContainerOnce(containerName, runDocker);
        if (removal.kind === "removed") return;
        await sleep(CLEANUP_RETRY_INTERVAL_MS);
    } while (Date.now() < deadline);
    console.error(
        `[Docker] A limpeza do container ${containerName} não pôde ser confirmada.`,
    );
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function timeoutError(): ExecutionResult {
    return infrastructureError(
        "timeout",
        "A execução excedeu o tempo limite.",
    );
}

function invalidProtocol(details: string): ExecutionResult {
    return infrastructureError(
        "invalid_protocol",
        "O ambiente isolado retornou uma resposta inválida.",
        details,
    );
}

function infrastructureError(
    reason: InfrastructureErrorReason,
    message: string,
    details?: string,
): ExecutionResult {
    return {
        status: ExecutionStatus.INFRASTRUCTURE_ERROR,
        reason,
        message,
        ...(details ? { details } : {}),
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
