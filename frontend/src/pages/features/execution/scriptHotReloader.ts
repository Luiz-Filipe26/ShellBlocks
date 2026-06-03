import * as ShellBlocks from "shellblocks";
import * as Blockly from "blockly";
import * as Logger from "../ui/systemLogger";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";

const MIN_INTERVAL_MS = 700;

let lastStartTime = 0;
let pendingTimer: number | null = null;

export function setupScriptHotReloader(
    workspace: Blockly.WorkspaceSvg,
    codeOutput: HTMLPreElement,
): void {
    updateScriptOutput(workspace, codeOutput);

    workspace.addChangeListener((event) => {
        if (event.isUiEvent) return;

        const now = Date.now();
        const sinceStart = now - lastStartTime;

        if (sinceStart >= MIN_INTERVAL_MS) {
            if (pendingTimer !== null) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
            updateScriptOutput(workspace, codeOutput);
            return;
        }

        const wait = MIN_INTERVAL_MS - sinceStart;
        if (pendingTimer !== null) clearTimeout(pendingTimer);

        pendingTimer = window.setTimeout(() => {
            pendingTimer = null;
            updateScriptOutput(workspace, codeOutput);
        }, wait);
    });
}

function updateScriptOutput(
    workspace: Blockly.WorkspaceSvg,
    codeOutput: HTMLPreElement,
): void {
    lastStartTime = Date.now();

    const ast = ShellBlocks.serializeWorkspaceToAST(workspace);

    if (!ast) {
        codeOutput.textContent =
            '// Monte seu script dentro do bloco "Script Principal"';
        return;
    }

    try {
        const script = generateShellScript(ast);
        codeOutput.textContent = script;
    } catch (error) {
        codeOutput.textContent = "// Erro ao gerar script localmente";
        Logger.log(
            "Erro interno na geração do script",
            ShellBlocks.LogLevel.ERROR,
        );
    }
}
