import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { SANDBOX_IMAGE_NAME } from "@shellblocks/shared/config/sandbox";
import dockerfileContent from "../docker/Dockerfile.sandbox?raw";
import runnerContent from "../docker/runner.sandbox.js?raw";

const BUILD_FINGERPRINT_LABEL = "shellblocks.build.sha256";

export interface BuildInput {
    name: string;
    content: string;
}

export interface DockerImageOperations {
    imageExists(): boolean;
    inspectLabels(): Record<string, string>;
    build(fingerprint: string): void;
}

const BUILD_INPUTS: readonly BuildInput[] = [
    { name: "Dockerfile.sandbox", content: dockerfileContent },
    { name: "runner.sandbox.js", content: runnerContent },
];

const DOCKER_IMAGE_OPERATIONS: DockerImageOperations = {
    imageExists,
    inspectLabels: inspectDockerImageLabels,
    build: buildDockerImage,
};

export function ensureDockerImageExists(
    operations: DockerImageOperations = DOCKER_IMAGE_OPERATIONS,
): void {
    const expectedFingerprint = computeBuildFingerprint(BUILD_INPUTS);
    console.log(`[Docker] Verificando a imagem '${SANDBOX_IMAGE_NAME}'...`);

    if (operations.imageExists()) {
        const currentFingerprint =
            operations.inspectLabels()[BUILD_FINGERPRINT_LABEL] ?? "";
        if (currentFingerprint === expectedFingerprint) {
            console.log("[Docker] Imagem atualizada e pronta para uso.");
            return;
        }
    }

    console.log("[Docker] Imagem ausente ou desatualizada. Iniciando build...");
    operations.build(expectedFingerprint);
    console.log("[Docker] Imagem compilada com sucesso.");
}

export function computeBuildFingerprint(inputs: readonly BuildInput[]): string {
    const hash = createHash("sha256");
    const sortedInputs = [...inputs].sort((a, b) =>
        a.name.localeCompare(b.name, "en"),
    );
    for (const input of sortedInputs) hash.update(input.content);
    return hash.digest("hex");
}

function imageExists(): boolean {
    return (
        execFileSync("docker", ["image", "ls", "--quiet", SANDBOX_IMAGE_NAME], {
            encoding: "utf8",
        }).trim().length > 0
    );
}

const DockerLabelsSchema = z.record(z.string(), z.string()).nullable();

function inspectDockerImageLabels(): Record<string, string> {
    const output = execFileSync(
        "docker",
        ["image", "inspect", "--format", "{{json .Config.Labels}}", SANDBOX_IMAGE_NAME],
        { encoding: "utf8" },
    );

    return DockerLabelsSchema.parse(JSON.parse(output)) ?? {};
}

function buildDockerImage(fingerprint: string): void {
    const contextDirectory = mkdtempSync(join(tmpdir(), "shellblocks-image-"));
    const dockerfilePath = join(contextDirectory, "Dockerfile.sandbox");

    try {
        for (const input of BUILD_INPUTS) {
            writeFileSync(join(contextDirectory, input.name), input.content);
        }
        // prettier-ignore
        const buildArgs = [
            "build", "--file", dockerfilePath,
            "--label", `${BUILD_FINGERPRINT_LABEL}=${fingerprint}`,
            "--tag", SANDBOX_IMAGE_NAME,
            contextDirectory,
        ];

        execFileSync("docker", buildArgs, { stdio: "inherit" });
    } finally {
        rmSync(contextDirectory, { recursive: true, force: true });
    }
}
