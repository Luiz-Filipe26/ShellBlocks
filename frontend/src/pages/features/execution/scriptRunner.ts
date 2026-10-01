import {
    ExecutionResultSchema,
    ExecutionStatus,
    RunRequestSchema,
    type ExecutionResult,
    type RunRequest,
    type StageResult,
} from "@shellblocks/shared/contracts/execution";
import { API_REQUEST_TIMEOUT_MS } from "@shellblocks/shared/config/sandbox";
import * as ShellBlocks from "shellblocks";
import { executeWithTimeout } from "@/core/utils/async";
import { AppConfig } from "@/config/appConfig";
import { ApiRoutes } from "@/config/apiRoutes";
import * as Logger from "../ui/systemLogger";
import * as Blockly from "blockly";
import {
    getCachedLevelData,
    getCurrentLevelId,
    SANDBOX_LEVEL_ID,
} from "../session/levelLoader";
import type { Level } from "../session/types";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";

interface RunDependencies {
    cliOutput: HTMLPreElement;
    codeOutput: HTMLPreElement;
    runBtn: HTMLButtonElement;
    validationModal: HTMLDialogElement;
    validationErrorList: HTMLUListElement;
    closeModalBtn: HTMLButtonElement;
}

export type OnLevelSuccess = (levelId: string) => void;

export async function runScript(
    workspace: Blockly.WorkspaceSvg,
    deps: RunDependencies,
    currentLevelId: string,
    onLevelSuccess: OnLevelSuccess,
): Promise<void> {
    const { cliOutput, runBtn } = deps;

    const clientErrors = ShellBlocks.getWorkspaceErrors(workspace);
    if (clientErrors.length > 0) {
        showValidationModal(clientErrors, deps, workspace);
        return;
    }

    const ast = ShellBlocks.serializeWorkspaceToAST(workspace);
    if (!ast) {
        cliOutput.textContent += " \n$";
        cliOutput.scrollTop = cliOutput.scrollHeight;
        return;
    }

    let userScript = "";
    try {
        userScript = generateShellScript(ast);
    } catch (error) {
        const message = `Erro ao gerar script localmente: ${error}`;
        Logger.log(message, ShellBlocks.LogLevel.ERROR);
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
        return;
    }

    if (userScript.trim() === "") {
        const message = "Adicione um comando antes de executar.";
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.WARN);
        Logger.log(message, ShellBlocks.LogLevel.WARN);
        return;
    }

    const level = getCachedLevelData(currentLevelId);
    cliOutput.textContent += `\n[Execução: ${level?.title ?? "Modo Livre"}]\n executar-script-atual\n`;

    runBtn.disabled = true;
    runBtn.textContent = "Executando...";
    cliOutput.scrollTop = cliOutput.scrollHeight;

    try {
        const payload: RunRequest = RunRequestSchema.parse({
            userScript,
            setupScript: level?.setupScript,
            verificationScript: level?.verificationScript,
        });

        const result = await requestExecution(payload);
        renderExecutionOutput(
            result,
            cliOutput,
            workspace,
            currentLevelId,
            level,
            onLevelSuccess,
        );
    } catch (error) {
        const message = `Erro de Conexão: ${error}`;
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
        Logger.log(message, ShellBlocks.LogLevel.ERROR);
        cliOutput.textContent += "$";
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Executar";
        cliOutput.scrollTop = cliOutput.scrollHeight;
    }
}

function showValidationModal(
    errors: ShellBlocks.BlockErrorReport[],
    deps: RunDependencies,
    workspace: Blockly.WorkspaceSvg,
): void {
    const { validationModal, validationErrorList, closeModalBtn } = deps;

    validationErrorList.innerHTML = "";

    for (const item of errors) {
        const li = document.createElement("li");
        li.innerHTML = `<strong>[${item.blockName}]</strong>: ${item.messages.join(", ")}`;

        li.style.cursor = "pointer";
        li.title = "Clique para encontrar este bloco";
        li.onclick = () => {
            validationModal.close();
            Blockly.WidgetDiv.hide();
            workspace.centerOnBlock(item.blockId);
            workspace.getAllBlocks(false).forEach((block) => block.unselect());
            const block = workspace.getBlockById(item.blockId);
            block?.select();
        };

        validationErrorList.appendChild(li);
    }

    closeModalBtn.onclick = () => validationModal.close();
    validationModal.showModal();
}

async function requestExecution(
    payload: RunRequest,
): Promise<ExecutionResult> {
    const { response, responseBody } = await executeWithTimeout(
        API_REQUEST_TIMEOUT_MS,
        async (signal) => {
            const response = await fetch(`${AppConfig.API_BASE_URL}/${ApiRoutes.RUN_SCRIPT}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal,
            });
            const responseBody: unknown = await response.json();
            return { response, responseBody };
        },
    );

    const result = ExecutionResultSchema.parse(responseBody);

    if (!response.ok) {
        if (result.status === ExecutionStatus.INFRASTRUCTURE_ERROR) {
            return result;
        }
        throw new Error(`HTTP ${response.status}`);
    }

    return result;
}

function renderExecutionOutput(
    result: ExecutionResult,
    cliOutput: HTMLPreElement,
    workspace: Blockly.WorkspaceSvg,
    currentLevelId: string,
    originatingLevel: Level | undefined,
    onLevelSuccess: OnLevelSuccess,
): void {
    if (result.status === ExecutionStatus.INFRASTRUCTURE_ERROR) {
        showInfrastructureFailure(result, workspace);
        cliOutput.textContent += "$";
        return;
    }

    if (result.status === ExecutionStatus.SETUP_FAILED) {
        showSetupFailure(result.setup, workspace);
        cliOutput.textContent += "$";
        return;
    }

    renderStudentExecution(result.execution, cliOutput);

    if (currentLevelId === SANDBOX_LEVEL_ID) {
        cliOutput.textContent += "$";
        return;
    }

    if (!result.verification) {
        const message =
            "Este nível não possui verificação e não pode ser concluído automaticamente.";
        Logger.log(message, ShellBlocks.LogLevel.WARN);
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.WARN);
        cliOutput.textContent += "$";
        return;
    }

    renderVerificationFeedback(result.verification);
    const sameMission = getCachedLevelData(currentLevelId) === originatingLevel;
    const isCurrentMission = sameMission && currentLevelId === getCurrentLevelId();
    const missionTitle = originatingLevel?.title ?? currentLevelId;

    if (result.verification.exitCode === 0) {
        const message = `Objetivo concluído: ${missionTitle}.`;
        Logger.log(message, ShellBlocks.LogLevel.INFO);
        if (isCurrentMission) ShellBlocks.showToast(workspace, message);
        if (sameMission) onLevelSuccess(currentLevelId);
    } else {
        const message = `O objetivo não foi atingido nesta tentativa: ${missionTitle}.`;
        Logger.log(message, ShellBlocks.LogLevel.WARN);
        if (isCurrentMission) {
            ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.WARN);
        }
    }

    cliOutput.textContent += "$";
}

function renderStudentExecution(
    execution: StageResult,
    cliOutput: HTMLPreElement,
): void {
    const stdout = decodeStageStream(execution.stdoutBase64);
    const stderr = decodeStageStream(execution.stderrBase64);
    if (stdout) {
        cliOutput.textContent += stdout;
        if (!stdout.endsWith("\n")) {
            cliOutput.textContent += "\n";
        }
    }

    if (stderr) {
        cliOutput.textContent += "[STDERR DO COMANDO]\n";
        cliOutput.textContent += stderr;
        if (!stderr.endsWith("\n")) {
            cliOutput.textContent += "\n";
        }
    }

    if (execution.exitCode !== 0) {
        cliOutput.textContent += `(Exit code do comando: ${execution.exitCode})\n`;
    }
}

function renderVerificationFeedback(verification: StageResult): void {
    const stdout = decodeStageStream(verification.stdoutBase64);
    const stderr = decodeStageStream(verification.stderrBase64);
    if (stdout) {
        Logger.log(
            `Verificação: ${stdout.trimEnd()}`,
            verification.exitCode === 0
                ? ShellBlocks.LogLevel.INFO
                : ShellBlocks.LogLevel.WARN,
        );
    }

    if (stderr) {
        Logger.log(
            `Verificação (stderr): ${stderr.trimEnd()}`,
            ShellBlocks.LogLevel.ERROR,
        );
    }
}

function showSetupFailure(
    setup: StageResult,
    workspace: Blockly.WorkspaceSvg,
): void {
    const detail =
        decodeStageStream(setup.stderrBase64) ||
        decodeStageStream(setup.stdoutBase64);
    const message = detail
        ? `Falha ao preparar o ambiente: ${detail.trimEnd()}`
        : `Falha ao preparar o ambiente (exit code ${setup.exitCode}).`;
    Logger.log(message, ShellBlocks.LogLevel.ERROR);
    ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
}

function showInfrastructureFailure(
    result: Extract<
        ExecutionResult,
        { status: typeof ExecutionStatus.INFRASTRUCTURE_ERROR }
    >,
    workspace: Blockly.WorkspaceSvg,
): void {
    const message = `Falha de infraestrutura: ${result.message}`;
    Logger.log(
        result.details ? `${message} ${result.details}` : message,
        ShellBlocks.LogLevel.ERROR,
    );
    ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
}

export function decodeStageStream(base64: string): string {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
