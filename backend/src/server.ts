import express, { Request, Response } from "express";
import cors from "cors";
import frontendPage from "./index.html"; 
import { runHandler } from "./controllers/executionController";
import { runInSandbox } from "./services/sandboxRunner";
import { ensureDockerImageExists } from "./services/dockerService";

const app = express();
const port = Number(process.env.PORT) || 7000;

app.use(cors());
app.use(express.json());

app.post("/api/run", runHandler);

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
    
    console.log("Aquecendo os motores do Docker...");
    runInSandbox("echo 'warmup'", [], "")
        .then(() => console.log("🚀 ShellBlocks 100% pronto para uso!"))
        .catch((err: any) =>
            console.error("Aviso: Falha no aquecimento do Docker", err),
        );
});
