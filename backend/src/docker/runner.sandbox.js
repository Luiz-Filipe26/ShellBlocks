import { chmod, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const STUDENT_UID = 1000;
const STUDENT_GID = 1000;
const STUDENT_HOME = "/home/aluno";
const PRIVATE_DIRECTORY = "/run/shellblocks";
const USER_SCRIPT_FILE = `${PRIVATE_DIRECTORY}/user_script`;
const LAST_COMMAND_OUTPUT_FILE = `${PRIVATE_DIRECTORY}/last_cmd_out`;

function readInput() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.on("data", (chunk) => chunks.push(chunk));
        process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
        process.stdin.on("error", reject);
    });
}

function parseRequest(input) {
    const value = JSON.parse(input.toString("utf8"));
    if (
        typeof value !== "object" ||
        value === null ||
        typeof value.userScript !== "string" ||
        typeof value.setupScript !== "string" ||
        typeof value.verificationScript !== "string"
    ) {
        throw new Error("Entrada inválida para o runner.");
    }
    return value;
}

function runStage(
    script,
    { uid, gid, env, captureFinalCwd = false, preserveBackground = false },
) {
    return new Promise((resolve, reject) => {
        const prelude = [];
        if (preserveBackground) prelude.push("trap '' HUP");
        if (captureFinalCwd) {
            prelude.push(
                `trap '__shellblocks_status=$?; pwd -P >&3; exit "$__shellblocks_status"' EXIT`,
            );
        }
        const stageSource = [...prelude, script].join("\n");
        const child = spawn("/bin/bash", ["--noprofile", "--norc", "-s"], {
            uid,
            gid,
            cwd: STUDENT_HOME,
            env,
            stdio: captureFinalCwd
                ? ["pipe", "pipe", "pipe", "pipe"]
                : ["pipe", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        const finalCwd = [];
        let collecting = true;
        let quietTimer;
        let maximumDrainTimer;
        let exitCode;
        let exitSignal;

        const finish = () => {
            if (!collecting || exitCode === undefined) return;
            collecting = false;
            clearTimeout(quietTimer);
            clearTimeout(maximumDrainTimer);
            resolve({
                exitCode: exitCode ?? (exitSignal === null ? 1 : 128),
                stdout: Buffer.concat(stdout),
                stderr: Buffer.concat(stderr),
                finalCwd: captureFinalCwd
                    ? Buffer.concat(finalCwd).toString("utf8").replace(/\n$/, "")
                    : undefined,
            });
        };
        const scheduleAfterQuietPeriod = () => {
            if (!collecting || exitCode === undefined) return;
            clearTimeout(quietTimer);
            quietTimer = setTimeout(finish, 10);
        };
        const collect = (chunks) => (chunk) => {
            if (collecting) chunks.push(chunk);
            scheduleAfterQuietPeriod();
        };

        child.stdout.on("data", collect(stdout));
        child.stderr.on("data", collect(stderr));
        if (captureFinalCwd) {
            child.stdio[3].on("data", collect(finalCwd));
        }
        child.on("error", (error) => {
            collecting = false;
            reject(error);
        });
        child.on("exit", (code, signal) => {
            exitCode = code;
            exitSignal = signal;
            maximumDrainTimer = setTimeout(finish, 100);
            scheduleAfterQuietPeriod();
        });
        child.stdin.end(Buffer.from(stageSource, "utf8"));
    });
}

function publicStage(stage) {
    return {
        exitCode: stage.exitCode,
        stdoutBase64: stage.stdout.toString("base64"),
        stderrBase64: stage.stderr.toString("base64"),
    };
}

function writeResult(result) {
    process.stdout.write(JSON.stringify(result), () => process.exit(0));
}

async function preparePrivateDirectory() {
    await mkdir(PRIVATE_DIRECTORY, { recursive: true, mode: 0o700 });
    await chmod(PRIVATE_DIRECTORY, 0o700);
}

async function main() {
    const request = parseRequest(await readInput());
    await preparePrivateDirectory();

    const studentEnvironment = {
        ...process.env,
        HOME: STUDENT_HOME,
        USER: "aluno",
        LOGNAME: "aluno",
    };
    let setup = null;
    if (request.setupScript.trim() !== "") {
        setup = await runStage(request.setupScript, {
            uid: STUDENT_UID,
            gid: STUDENT_GID,
            env: studentEnvironment,
            preserveBackground: true,
        });
        if (setup.exitCode !== 0) {
            writeResult({
                status: "setup_failed",
                setup: publicStage(setup),
                execution: null,
                verification: null,
            });
            return;
        }
    }

    const execution = await runStage(request.userScript, {
        uid: STUDENT_UID,
        gid: STUDENT_GID,
        env: studentEnvironment,
        captureFinalCwd: true,
        preserveBackground: true,
    });
    let verification = null;
    if (request.verificationScript.trim() !== "") {
        await writeFile(USER_SCRIPT_FILE, Buffer.from(request.userScript, "utf8"), {
            mode: 0o600,
        });
        await writeFile(
            LAST_COMMAND_OUTPUT_FILE,
            Buffer.concat([execution.stdout, execution.stderr]),
            { mode: 0o600 },
        );
        verification = await runStage(request.verificationScript, {
            uid: 0,
            gid: 0,
            env: {
                ...process.env,
                HOME: "/root",
                USER: "root",
                LOGNAME: "root",
                SHELLBLOCKS_USER_SCRIPT_FILE: USER_SCRIPT_FILE,
                SHELLBLOCKS_LAST_CMD_OUT_FILE: LAST_COMMAND_OUTPUT_FILE,
                SHELLBLOCKS_FINAL_CWD: execution.finalCwd ?? "",
            },
        });
    }

    writeResult({
        status: "completed",
        setup: setup === null ? null : publicStage(setup),
        execution: publicStage(execution),
        verification: verification === null ? null : publicStage(verification),
    });
}

main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`Falha interna do runner: ${message}\n`, () =>
        process.exit(1),
    );
});
