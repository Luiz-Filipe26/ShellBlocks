import express, { Request, Response } from "express";
import cors from "cors";
import frontendPage from "../build/frontend/index.html"; 
import { registerRoutes } from "./controllers/executionController";
import { runInSandbox } from "./services/sandboxRunner";
import { ensureDockerImageExists } from "./services/dockerService";
import { ExecutionStatus } from "@shellblocks/shared/contracts/execution";

const app = express();
const port = Number(process.env.PORT) || 7000;

app.use(cors());
app.use(express.json());

registerRoutes(app);

app.get(/.*/, (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(frontendPage);
});

console.log("------------------------------------------");
console.log(" Inicializando ShellBlocks Backend...");
console.log("------------------------------------------");

ensureDockerImageExists();

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
