import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Express, Request, Response } from "express";
import {
    registerRoutes,
    runHandler,
} from "../../src/controllers/executionController";

const { mockRunInSandbox } = vi.hoisted(() => ({
    mockRunInSandbox: vi.fn(),
}));

vi.mock("../../src/services/sandboxRunner", () => ({
    runInSandbox: mockRunInSandbox,
}));

function createResponseRecorder(): {
    response: Response;
    status: Mock;
    json: Mock;
} {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    return {
        response: { status, json } as unknown as Response,
        status,
        json,
    };
}

async function invokeRunHandler(body: unknown) {
    const recorder = createResponseRecorder();
    await runHandler({ body } as Request, recorder.response);
    return recorder;
}

describe("POST /api/run", () => {
    beforeEach(() => {
        mockRunInSandbox.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it.each([
        null,
        {},
        { userScript: "" },
        { userScript: 42 },
        { userScript: "echo ok", setupScript: [] },
        { userScript: "echo ok", verificationScript: [] },
        { userScript: "echo ok", unexpected: true },
    ])("rejeita corpo inválido %#", async (body) => {
        const { status, json } = await invokeRunHandler(body);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            status: "infrastructure_error",
            reason: "invalid_request",
            message: "Requisição de execução inválida.",
        });
        expect(mockRunInSandbox).not.toHaveBeenCalled();
    });

    it("encaminha a requisição validada ao sandbox", async () => {
        mockRunInSandbox.mockResolvedValue({
            status: "completed",
            setup: null,
            execution: { exitCode: 0, stdoutBase64: "b2sK", stderrBase64: "" },
            verification: null,
        });
        const request = {
            userScript: "echo ok",
            setupScript: "mkdir app",
            verificationScript: "test -d app",
        };
        const { status } = await invokeRunHandler(request);
        expect(mockRunInSandbox).toHaveBeenCalledWith(request);
        expect(status).toHaveBeenCalledWith(200);
    });

    it("normaliza scripts opcionais vazios antes de delegar ao sandbox", async () => {
        mockRunInSandbox.mockResolvedValue({
            status: "completed",
            setup: null,
            execution: { exitCode: 0, stdoutBase64: "", stderrBase64: "" },
            verification: null,
        });
        const { status } = await invokeRunHandler({
            userScript: "echo ok",
            setupScript: " \n ",
            verificationScript: "",
        });

        expect(mockRunInSandbox).toHaveBeenCalledWith({ userScript: "echo ok" });
        expect(status).toHaveBeenCalledWith(200);
    });

    it("traduz exceção inesperada do serviço para erro HTTP 500", async () => {
        mockRunInSandbox.mockRejectedValue(new Error("falha inesperada"));
        const { status, json } = await invokeRunHandler({
            userScript: "echo ok",
        });
        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({
            status: "infrastructure_error",
            reason: "internal_error",
            message: "Erro interno no servidor.",
            details: "falha inesperada",
        });
    });
});

describe("registerRoutes", () => {
    it("registra a rota de execução no controller", () => {
        const post = vi.fn();
        registerRoutes({ post } as unknown as Express);
        expect(post).toHaveBeenCalledWith("/api/run", runHandler);
    });
});
