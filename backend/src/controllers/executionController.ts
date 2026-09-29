import type { Express, Request, Response } from "express";
import { ExecutionStatus, RunRequestSchema } from "@shellblocks/shared/contracts/execution";
import { runInSandbox } from "../services/sandboxRunner";

export function registerRoutes(app: Express): void {
    app.post("/api/run", runHandler);
}

export async function runHandler(req: Request, res: Response): Promise<void> {
    const parsed = RunRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            status: ExecutionStatus.INFRASTRUCTURE_ERROR,
            reason: "invalid_request",
            message: "Requisição de execução inválida.",
        });
        return;
    }

    try {
        const result = await runInSandbox(parsed.data);
        res.status(200).json(result);
    } catch (error) {
        console.error("Erro não tratado no ExecutionController:", error);
        const details = error instanceof Error ? error.message : String(error);
        res.status(500).json({
            status: ExecutionStatus.INFRASTRUCTURE_ERROR,
            reason: "internal_error",
            message: "Erro interno no servidor.",
            details,
        });
    }
}
