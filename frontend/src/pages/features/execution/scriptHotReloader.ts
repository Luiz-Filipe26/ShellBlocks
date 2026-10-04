import * as ShellBlocks from "shellblocks";
import * as Blockly from "blockly";
import * as Logger from "../ui/systemLogger";
import { generateCurrentShell } from "./generatedShell";

const MIN_INTERVAL_MS = 700;

let lastStartTime = 0;
let pendingTimer: number | null = null;

export function setupScriptHotReloader(
    workspace: Blockly.WorkspaceSvg,
    codeOutput: HTMLPreElement,
): () => string | null {
    let currentShellScript = updateScriptOutput(workspace, codeOutput);

    workspace.addChangeListener((event) => {
        if (event.isUiEvent) return;

        const now = Date.now();
        const sinceStart = now - lastStartTime;

        if (sinceStart >= MIN_INTERVAL_MS) {
            if (pendingTimer !== null) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
            currentShellScript = updateScriptOutput(workspace, codeOutput);
            return;
        }

        const wait = MIN_INTERVAL_MS - sinceStart;
        if (pendingTimer !== null) clearTimeout(pendingTimer);

        pendingTimer = window.setTimeout(() => {
            pendingTimer = null;
            currentShellScript = updateScriptOutput(workspace, codeOutput);
        }, wait);
    });

    return () => currentShellScript;
}

function updateScriptOutput(
    workspace: Blockly.WorkspaceSvg,
    codeOutput: HTMLPreElement,
): string | null {
    lastStartTime = Date.now();

    const generated = generateCurrentShell(workspace);
    if (generated.kind === "empty") {
        codeOutput.textContent =
            '// Monte seu script dentro do bloco "Script Principal"';
        return null;
    }

    if (generated.kind === "error") {
        codeOutput.textContent = "// Erro ao gerar script localmente";
        Logger.log(
            "Erro interno na geração do script",
            ShellBlocks.LogLevel.ERROR,
        );
        return null;
    }
    codeOutput.textContent = generated.content;
    return generated.content;
}
