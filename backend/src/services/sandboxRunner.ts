import { spawn } from "child_process";

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

const TIMEOUT_MS = 30000;
const LOG_FILE = "/tmp/last_cmd_out";

const DOCKER_CMD = "docker";

export async function runInSandbox(
    userScript: string,
    setupCommands: string[] = [],
    verificationScript: string = "",
): Promise<ExecutionResult> {
    try {
        const fullScript = buildFullScript(
            userScript,
            setupCommands,
            verificationScript,
        );
        return await executeDocker(fullScript);
    } catch (error: any) {
        console.error("Erro interno no SandboxRunner:", error);
        return {
            stdout: "",
            stderr: `Erro Interno: ${error.message}`,
            exitCode: 1,
        };
    }
}

function buildFullScript(
    userScript: string,
    setupCommands: string[],
    verificationScript: string,
): string {
    let script = "";

    if (setupCommands && setupCommands.length > 0) {
        script += "{ ";
        for (const cmd of setupCommands) {
            script += `${cmd} ; `;
        }
        script += "} > /dev/null 2>&1 && ";
    }

    script += `{ ${userScript} ; } > ${LOG_FILE} 2>&1 ; `;
    script += `cat ${LOG_FILE} ; \n`;

    script +=
        verificationScript && verificationScript.trim() !== ""
            ? verificationScript
            : "exit 0";

    return script;
}

function executeDocker(fullScript: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
        const args = [
            "run",
            "--rm",
            "--net",
            "none",
            "--memory",
            "100m",
            "--cpus",
            "0.5",
            "blockly-shell-env",
            "bash",
            "-c",
            fullScript,
        ];

        const proc = spawn(DOCKER_CMD, args);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf-8");
        });

        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf-8");
        });

        const timeoutTimer = setTimeout(() => {
            proc.kill("SIGKILL");
            resolve({
                stdout: "",
                stderr: "⏱️ Tempo esgotado! Seu comando demorou muito.",
                exitCode: 124,
            });
        }, TIMEOUT_MS);

        proc.on("close", (code) => {
            clearTimeout(timeoutTimer);

            let exitCode = code ?? 1;

            if (exitCode >= 125) {
                stderr = `\n[ERRO SISTEMA] Exit ${exitCode}\n${stderr}`;
            }

            resolve({ stdout, stderr, exitCode });
        });

        proc.on("error", (err) => {
            clearTimeout(timeoutTimer);
            resolve({
                stdout: "",
                stderr: `[ERRO FATAL] Falha ao iniciar o Docker: ${err.message}`,
                exitCode: 127,
            });
        });
    });
}
