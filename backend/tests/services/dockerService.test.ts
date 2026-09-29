import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
    computeBuildFingerprint,
    ensureDockerImageExists,
    type DockerImageOperations,
} from "@/services/dockerService";

describe("computeBuildFingerprint", () => {
    const inputs = [
        { name: "Dockerfile.sandbox", content: "FROM alpine" },
        { name: "runner.sandbox.js", content: "console.log('runner')" },
    ];

    it("é determinístico e independente da ordem dos inputs", () => {
        expect(computeBuildFingerprint(inputs)).toBe(
            computeBuildFingerprint([...inputs].reverse()),
        );
    });

    it("muda quando o conteúdo de qualquer input muda", () => {
        const original = computeBuildFingerprint(inputs);

        expect(
            computeBuildFingerprint([
                { ...inputs[0], content: "FROM node" },
                inputs[1],
            ]),
        ).not.toBe(original);

        expect(
            computeBuildFingerprint([
                inputs[0],
                { ...inputs[1], content: "throw new Error()" },
            ]),
        ).not.toBe(original);
    });

    it("usa os nomes apenas para ordenar os conteúdos", () => {
        expect(
            computeBuildFingerprint([{ name: "runner.sandbox.js", content: "code" }]),
        ).toBe(
            computeBuildFingerprint([{ name: "runner.js", content: "code" }]),
        );

        expect(computeBuildFingerprint([
            { name: "a", content: "first" },
            { name: "b", content: "second" },
        ])).not.toBe(computeBuildFingerprint([
            { name: "z", content: "first" },
            { name: "b", content: "second" },
        ]));
    });

    it("aceita divisões dos conteúdos com concatenação idêntica", () => {
        const first = [
            { name: "a", content: "ab" },
            { name: "b", content: "c" },
        ];
        const second = [
            { name: "a", content: "a" },
            { name: "b", content: "bc" },
        ];

        expect(first.map((input) => input.content).join("")).toBe(
            second.map((input) => input.content).join(""),
        );
        expect(computeBuildFingerprint(first)).toBe(
            computeBuildFingerprint(second),
        );
    });
});

describe("ensureDockerImageExists", () => {
    let operations: DockerImageOperations;
    let build: Mock<(fingerprint: string) => void>;

    beforeEach(() => {
        build = vi.fn<(fingerprint: string) => void>();
        operations = {
            imageExists: vi.fn(() => true),
            inspectLabels: vi.fn(() => ({})),
            build,
        };
        vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    it("constrói quando a imagem está ausente", () => {
        vi.mocked(operations.imageExists).mockReturnValue(false);
        ensureDockerImageExists(operations);
        expect(build).toHaveBeenCalledOnce();
        expect(operations.inspectLabels).not.toHaveBeenCalled();
    });

    it("constrói quando a label está ausente ou diverge", () => {
        ensureDockerImageExists(operations);
        expect(build).toHaveBeenCalledOnce();

        build.mockClear();
        vi.mocked(operations.inspectLabels).mockReturnValue({
            "shellblocks.build.sha256": "desatualizado",
        });
        ensureDockerImageExists(operations);
        expect(build).toHaveBeenCalledOnce();
    });

    it("reutiliza quando o fingerprint corresponde", () => {
        let fingerprint = "";
        operations.build = vi.fn((value: string) => {
            fingerprint = value;
        });
        ensureDockerImageExists(operations);
        vi.mocked(operations.inspectLabels).mockReturnValue({
            "shellblocks.build.sha256": fingerprint,
        });
        operations.build = vi.fn();
        ensureDockerImageExists(operations);
        expect(operations.build).not.toHaveBeenCalled();
    });

    it("propaga falhas de consulta sem tentar build", () => {
        vi.mocked(operations.imageExists).mockImplementation(() => {
            throw new Error("daemon indisponível");
        });
        expect(() => ensureDockerImageExists(operations)).toThrow(
            "daemon indisponível",
        );
        expect(build).not.toHaveBeenCalled();
    });

    it("propaga falha de inspeção de uma imagem existente", () => {
        vi.mocked(operations.inspectLabels).mockImplementation(() => {
            throw new Error("inspect falhou");
        });
        expect(() => ensureDockerImageExists(operations)).toThrow(
            "inspect falhou",
        );
        expect(build).not.toHaveBeenCalled();
    });
});
