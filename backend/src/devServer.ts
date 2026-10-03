import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiApp, startApiServer } from "./serverBootstrap";
import { ensureDockerImageExists } from "./services/dockerService";

const dockerDirectory = join(dirname(fileURLToPath(import.meta.url)), "docker");
ensureDockerImageExists([
    {
        name: "Dockerfile.sandbox",
        content: readFileSync(join(dockerDirectory, "Dockerfile.sandbox"), "utf8"),
    },
    {
        name: "runner.sandbox.js",
        content: readFileSync(join(dockerDirectory, "runner.sandbox.js"), "utf8"),
    },
]);
startApiServer(createApiApp());
