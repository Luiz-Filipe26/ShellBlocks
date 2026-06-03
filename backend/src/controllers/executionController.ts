import { Request, Response } from "express";
import { runInSandbox } from "../services/sandboxRunner";

export async function runHandler(req: Request, res: Response): Promise<void> {
    try {
        const { userScript, setupCommands, verificationScript } = req.body;

        if (!userScript) {
            res.status(400).json({
                stdout: "",
                stderr: "Nenhum script fornecido para execução.",
                exitCode: 1,
            });
            return;
        }

        const result = await runInSandbox(
            userScript,
            setupCommands,
            verificationScript,
        );

        res.status(200).json(result);
    } catch (error: any) {
        console.error("Erro não tratado no ExecutionController:", error);
        res.status(500).json({
            stdout: "",
            stderr: `Erro no servidor: ${error.message}`,
            exitCode: 1,
        });
    }
}
