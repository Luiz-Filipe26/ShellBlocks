import { spawnSync } from "node:child_process";
import { appendFile, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const artifactPath = "dist/shellblocks-server.js";
const npmPath = process.env.npm_execpath;

function runNpm(packageDirectory, args) {
    const result = spawnSync(process.execPath, [npmPath, ...args], {
        cwd: join(projectRoot, packageDirectory),
        stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.signal) {
        throw new Error(`npm em ${packageDirectory} terminou pelo sinal ${result.signal}.`);
    }
    if (result.status !== 0) process.exit(result.status ?? 1);
}

async function buildProject() {
    if (!npmPath) throw new Error("Execute o build com npm run build.");

    console.log("--- Limpando artefatos de builds anteriores ---");
    for (const directory of ["frontend/dist", "backend/build", "backend/dist", "dist"]) {
        await rm(join(projectRoot, directory), { recursive: true, force: true });
    }
    await mkdir(join(projectRoot, "backend/build/frontend"), { recursive: true });
    await mkdir(join(projectRoot, "dist"), { recursive: true });

    console.log("--- Instalando dependências do package compartilhado ---");
    runNpm("shared", ["ci", "--silent", "--no-fund"]);

    console.log("--- [1/3] Compilando o Frontend (Single File) ---");
    runNpm("frontend", ["install", "--silent", "--no-fund"]);
    runNpm("frontend", ["run", "build", "--silent"]);

    console.log("--- [2/3] Integrando artefatos do Frontend ao Backend ---");
    await copyFile(
        join(projectRoot, "frontend/dist/index.html"),
        join(projectRoot, "backend/build/frontend/index.html"),
    );

    console.log("--- [3/3] Gerando artefato final do servidor (Bundler) ---");
    runNpm("backend", ["install", "--silent", "--no-fund"]);
    runNpm("backend", ["run", "build", "--silent"]);
    await copyFile(join(projectRoot, "backend/dist/server.js"), join(projectRoot, artifactPath));

    if (process.env.GITHUB_ENV) {
        await appendFile(process.env.GITHUB_ENV, `GENERATED_ARTIFACT_PATH=${artifactPath}\n`, "utf8");
        console.log("Registro de variável no GITHUB_ENV concluído.");
    }

    console.log("\n✅ Build finalizado com sucesso.");
    console.log("------------------------------------------------------");
    console.log(`Artefato consolidado gerado em:\n> ./${artifactPath}`);
    console.log("------------------------------------------------------");
    console.log(`Para iniciar o servidor, execute:\n$ node ${artifactPath}`);
}

try {
    await buildProject();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
