import type { Request, Response } from "express";
import frontendPage from "../build/frontend/index.html";
import { createApiApp, startApiServer } from "./serverBootstrap";
import { ensureDockerImageExists } from "./services/dockerService";
import dockerfileContent from "./docker/Dockerfile.sandbox?raw";
import runnerContent from "./docker/runner.sandbox.js?raw";

const app = createApiApp();

app.get(/.*/, (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html");
    res.send(frontendPage);
});

ensureDockerImageExists([
    { name: "Dockerfile.sandbox", content: dockerfileContent },
    { name: "runner.sandbox.js", content: runnerContent },
]);

startApiServer(app);
