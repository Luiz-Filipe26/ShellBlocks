import {
    ExecutionResultSchema,
    ExecutionStatus,
    InfrastructureErrorReason,
    RunRequestSchema,
    type ExecutionResult,
    type RunRequest,
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
    SANDBOX_LEVEL_ID,
} from "../session/levelLoader";
import type { Level } from "../session/types";
import {
    decodeStageStream,
    startExecutionAttempt,
    finishExecutionAttempt,
    failExecutionAttempt,
    showAttemptFeedback,
    type ExecutionAttempt,
} from "./executionOutput";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";

interface RunDependencies {
    cliOutput: HTMLElement;
    clearBtn: HTMLButtonElement;
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
    const { cliOutput, runBtn, clearBtn } = deps;
    if (runBtn.disabled) return;

    const clientErrors = ShellBlocks.getWorkspaceErrors(workspace);
    if (clientErrors.length > 0) {
        showValidationModal(clientErrors, deps, workspace);
        return;
    }

    const ast = ShellBlocks.serializeWorkspaceToAST(workspace);
    if (!ast) return;

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
    let payload: RunRequest;
    try {
        payload = RunRequestSchema.parse({
            userScript,
            setupScript: currentLevelId === SANDBOX_LEVEL_ID ? undefined : level?.setupScript,
            verificationScript: currentLevelId === SANDBOX_LEVEL_ID ? undefined : level?.verificationScript,
        });
    } catch (error) {
        const message = `Não foi possível preparar a requisição: ${error}`;
        Logger.log(message, ShellBlocks.LogLevel.ERROR);
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
        return;
    }

    const context = currentLevelId === SANDBOX_LEVEL_ID
        ? "Modo Livre"
        : `Atividade · ${level?.title ?? currentLevelId}`;
    const attempt = startExecutionAttempt(cliOutput, payload.userScript, context);
    runBtn.disabled = true;
    clearBtn.disabled = true;
    runBtn.textContent = "Executando...";

    try {
        let result: ExecutionResult;
        try {
            result = await requestExecution(payload);
        } catch (error) {
            const message = `Erro de conexão ou resposta inválida: ${error}`;
            Logger.log(message, ShellBlocks.LogLevel.ERROR);
            failExecutionAttempt(attempt, "Não foi possível confirmar o resultado da execução.", message);
            return;
        }
        renderExecutionOutput(result, attempt, currentLevelId, level, onLevelSuccess);
    } finally {
        runBtn.disabled = false;
        clearBtn.disabled = false;
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
        const label = document.createElement("strong");
        label.textContent = `[${item.blockName}]`;
        li.append(label, document.createTextNode(`: ${item.messages.join(", ")}`));

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
    attempt: ExecutionAttempt,
    currentLevelId: string,
    originatingLevel: Level | undefined,
    onLevelSuccess: OnLevelSuccess,
): void {
    if (result.status === ExecutionStatus.INFRASTRUCTURE_ERROR) {
        const message = `Falha de infraestrutura: ${result.message}`;
        Logger.log(result.details ? `${message} ${result.details}` : message, ShellBlocks.LogLevel.ERROR);
        failExecutionAttempt(
            attempt,
            result.reason === InfrastructureErrorReason.INVALID_REQUEST
                ? "Seu script não foi executado: a requisição foi recusada."
                : "Não foi possível confirmar a execução do seu script.",
            result.details ? `${message}\n${result.details}` : message,
        );
        return;
    }

    if (result.status === ExecutionStatus.SETUP_FAILED) {
        const message = `Falha ao preparar o ambiente (exit code da preparação: ${result.setup.exitCode}). Seu script não foi executado.`;
        const detail = decodeStageStream(result.setup.stderrBase64) || decodeStageStream(result.setup.stdoutBase64);
        Logger.log(detail ? `${message} ${detail.trimEnd()}` : message, ShellBlocks.LogLevel.ERROR);
        failExecutionAttempt(attempt, message, result.setup);
        return;
    }

    finishExecutionAttempt(attempt, result.execution);
    if (currentLevelId === SANDBOX_LEVEL_ID) return;

    if (!result.verification) {
        const message = "Esta missão não possui resultado de verificação e não pode ser concluída automaticamente.";
        Logger.log(message, ShellBlocks.LogLevel.WARN);
        showAttemptFeedback(attempt, "verification", message);
        return;
    }

    const completed = result.verification.exitCode === 0;
    showAttemptFeedback(
        attempt,
        "verification",
        completed ? "Missão concluída." : "O objetivo não foi atingido nesta tentativa.",
        result.verification,
    );
    const stdout = decodeStageStream(result.verification.stdoutBase64);
    const stderr = decodeStageStream(result.verification.stderrBase64);
    if (stdout) Logger.log(`Verificação: ${stdout.trimEnd()}`, completed ? ShellBlocks.LogLevel.INFO : ShellBlocks.LogLevel.WARN);
    if (stderr) Logger.log(`Verificação (stderr): ${stderr.trimEnd()}`, ShellBlocks.LogLevel.ERROR);
    Logger.log(
        `${completed ? "Objetivo concluído" : "Objetivo não atingido"}: ${originatingLevel?.title ?? currentLevelId}.`,
        completed ? ShellBlocks.LogLevel.INFO : ShellBlocks.LogLevel.WARN,
    );
    // Completion belongs to the original mission object, even after navigation.
    if (completed && getCachedLevelData(currentLevelId) === originatingLevel) {
        onLevelSuccess(currentLevelId);
    }
}
