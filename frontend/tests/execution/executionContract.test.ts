import { describe, expect, it } from "vitest";
import {
    ExecutionResultSchema,
    RunRequestSchema,
} from "@shellblocks/shared/contracts/execution";
import { decodeStageStream } from "../../src/pages/features/execution/scriptRunner";

describe("contrato de streams da execução", () => {
    it("usa Base64 como representação pública autoritativa", () => {
        expect(
            ExecutionResultSchema.parse({
                status: "completed",
                setup: null,
                execution: {
                    exitCode: 0,
                    stdoutBase64: "b2s=",
                    stderrBase64: "",
                },
                verification: null,
            }),
        ).toBeDefined();

        expect(() =>
            ExecutionResultSchema.parse({
                status: "completed",
                setup: null,
                execution: {
                    exitCode: 0,
                    stdoutBase64: "b2s=",
                    stderrBase64: "",
                    stdout: "ok",
                },
                verification: null,
            }),
        ).toThrow();
    });

    it("decodifica bytes como UTF-8 para apresentação", () => {
        expect(decodeStageStream("b2zDoQ==")).toBe("olá");
        expect(decodeStageStream("/w==")).toBe("�");
    });
});

describe("contrato de requisição de execução", () => {
    it("exige userScript não vazio", () => {
        expect(() => RunRequestSchema.parse({ userScript: " \n\t " })).toThrow();
    });

    it.each(["", " \n\t "])(
        "normaliza setupScript e verificationScript vazios (%j) para ausência",
        (emptyScript) => {
            expect(RunRequestSchema.parse({
                userScript: "echo ok",
                setupScript: emptyScript,
                verificationScript: emptyScript,
            })).toEqual({ userScript: "echo ok" });
        },
    );

    it("preserva scripts opcionais não vazios", () => {
        expect(RunRequestSchema.parse({
            userScript: "echo ok",
            setupScript: "mkdir app",
            verificationScript: "test -d app",
        })).toEqual({
            userScript: "echo ok",
            setupScript: "mkdir app",
            verificationScript: "test -d app",
        });
    });
});
