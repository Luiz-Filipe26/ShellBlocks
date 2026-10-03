import cors from "cors";
import express, { type Express } from "express";
import { ExecutionStatus } from "@shellblocks/shared/contracts/execution";
import { registerRoutes } from "./controllers/executionController";
import { runInSandbox } from "./services/sandboxRunner";

export function createApiApp(): Express {
    const app = express();
    app.use(cors());
    app.use(express.json());
    registerRoutes(app);
    return app;
}

export function startApiServer(app: Express): void {
    const port = Number(process.env.PORT) || 7000;

    console.log("------------------------------------------");
    console.log(" Inicializando ShellBlocks Backend...");
    console.log("------------------------------------------");

    app.listen(port, () => {
        console.log(`\n✅ Servidor rodando em http://localhost:${port}`);

        console.log("Aquecendo o ambiente Docker...");
        runInSandbox({ userScript: "echo warmup" })
            .then((result) => {
                if (
                    result.status === ExecutionStatus.COMPLETED &&
                    result.execution.exitCode === 0
                ) {
                    console.log("Ambiente Docker aquecido.");
                } else {
                    console.error("Aviso: o aquecimento do Docker falhou.", result);
                }
            })
            .catch((error: unknown) =>
                console.error("Aviso: erro inesperado no aquecimento do Docker.", error),
            );
    });
}
