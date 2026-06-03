import * as API from "@/types/api";
import * as ShellBlocks from "shellblocks";
import { executeWithTimeout } from "@/core/utils/async";
import { AppConfig } from "@/config/appConfig";
import { ApiRoutes } from "@/config/apiRoutes";
import * as Logger from "../ui/systemLogger";
import * as Blockly from "blockly";
import { getCachedLevelData, SANDBOX_LEVEL_ID } from "../session/levelLoader";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";

interface RunDependencies {
    cliOutput: HTMLPreElement;
    codeOutput: HTMLPreElement;
    runBtn: HTMLButtonElement;
    validationModal: HTMLDialogElement;
    validationErrorList: HTMLUListElement;
    closeModalBtn: HTMLButtonElement;
}

export interface LevelSuccessResult {
    unlockedNewLevel: boolean;
    nextLevelTitle?: string;
}

export type OnLevelSuccess = (levelId: string) => LevelSuccessResult;

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
        Logger.log(`Erro ao gerar script localmente: ${error}`, ShellBlocks.LogLevel.ERROR);
        cliOutput.textContent += "[ERRO DE GERAÇÃO INTERNA]\n$";
        return;
    }

    cliOutput.textContent += " executar-script-atual\n";

    runBtn.disabled = true;
    runBtn.textContent = "Executando...";
    cliOutput.scrollTop = cliOutput.scrollHeight;

    try {
        const level = getCachedLevelData(currentLevelId);

        const payload: API.RunRequest = {
            userScript: userScript,
            setupCommands: level?.setupCommands || [],
            verificationScript: level?.verificationScript || "",
        };

        const result = await requestExecution(payload);
        renderExecutionOutput(
            result,
            cliOutput,
            currentLevelId,
            onLevelSuccess,
        );
    } catch (error) {
        const message = `Erro de Conexão: ${error}`;
        ShellBlocks.showToast(workspace, message);
        Logger.log(message, ShellBlocks.LogLevel.ERROR);
        cliOutput.textContent += `[ERRO DE CONEXÃO]: ${error}\n$`;
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
    payload: API.RunRequest,
): Promise<API.ExecutionResult> {
    const response = await executeWithTimeout(
        AppConfig.API_REQUEST_TIMEOUT_MS,
        (signal) =>
            fetch(`${AppConfig.API_BASE_URL}/${ApiRoutes.RUN_SCRIPT}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: signal,
            }),
    );

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

function renderExecutionOutput(
    result: API.ExecutionResult,
    cliOutput: HTMLPreElement,
    currentLevelId: string,
    onLevelSuccess: OnLevelSuccess,
): void {
    let output = "";

    if (result.stdout) {
        output += result.stdout;
        if (!output.endsWith("\n")) output += "\n";
    }

    if (result.stderr) {
        output += `[STDERR]: ${result.stderr}\n`;
    }

    cliOutput.textContent += output;

    if (currentLevelId !== SANDBOX_LEVEL_ID) {
        if (result.exitCode === 0) {
            cliOutput.textContent += "[SUCESSO] Objetivo concluído.\n";

            const status = onLevelSuccess(currentLevelId);

            if (status.unlockedNewLevel) {
                cliOutput.textContent +=
                    "------------------------------------------------\n";
                cliOutput.textContent += "SISTEMA: Novo nível desbloqueado!\n";
                if (status.nextLevelTitle) {
                    cliOutput.textContent += `PRÓXIMO: ${status.nextLevelTitle}\n`;
                }
                cliOutput.textContent +=
                    "------------------------------------------------\n";
            }
        } else {
            cliOutput.textContent += "[FALHA] O objetivo não foi atingido.\n";
        }
    } else if (result.exitCode !== 0) {
        cliOutput.textContent += `(Exit Code: ${result.exitCode})\n`;
    }

    cliOutput.textContent += "$";
    cliOutput.scrollTop = cliOutput.scrollHeight; // Garante que o usuário veja a mensagem final
}
