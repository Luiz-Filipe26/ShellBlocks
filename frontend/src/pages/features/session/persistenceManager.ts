import * as Blockly from "blockly";
import * as ShellBlocks from "shellblocks";
import * as Logger from "../ui/systemLogger";
import * as API from "@/types/api";
import * as DataManager from "../session/dataManager";

const LAST_UNLOCKED_LEVEL_ID_KEY = "experiment_progress_v1";
const SIDEBAR_WIDTH_KEY = "sidebar_pref_width";
const SIDEBAR_COLLAPSED_KEY = "sidebar_pref_collapsed";
const KEY_HAS_SEEN_GUIDE = "shellblocks_has_seen_guide";

export function hasSeenHelpGuide(): boolean {
    return localStorage.getItem(KEY_HAS_SEEN_GUIDE) === "true";
}

export function saveHasSeenHelpGuide(): void {
    localStorage.setItem(KEY_HAS_SEEN_GUIDE, "true");
}

export function isSidebarCollapsed(): boolean {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}


export function saveSidebarCollapsed(collapsed: boolean): void {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed.toString());
}

export function getSidebarWidth(): string | null {
    return localStorage.getItem(SIDEBAR_WIDTH_KEY);
}

export function saveSidebarWidth(width: number): void {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, Math.floor(width).toString());
}

export function getLastUnlockedLevelId(): string | null {
    return localStorage.getItem(LAST_UNLOCKED_LEVEL_ID_KEY);
}

export function unlockLevel(levelId: string): void {
    localStorage.setItem(LAST_UNLOCKED_LEVEL_ID_KEY, levelId);
}

/**
 * Baixa o workspace atual como arquivo JSON.
 */
export function downloadScript(workspace: Blockly.WorkspaceSvg): void {
    try {
        const state = Blockly.serialization.workspaces.save(workspace);
        const json = JSON.stringify(state, null, 2);

        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `script_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        ShellBlocks.showToast(workspace, "Script baixado com sucesso.");
    } catch (error) {
        Logger.log(
            `Erro ao salvar script: ${error}`,
            ShellBlocks.LogLevel.ERROR,
        );
    }
}

/**
 * Carrega script do usuário no workspace.
 */
export function uploadScript(workspace: Blockly.WorkspaceSvg): void {
    triggerFileUpload((jsonContent) => {
        try {
            const state = JSON.parse(jsonContent);

            Blockly.Events.disable();
            workspace.clear();
            Blockly.serialization.workspaces.load(state, workspace);
            Blockly.Events.enable();

            ShellBlocks.showToast(workspace, "Script carregado com sucesso!");
        } catch (error) {
            const message = "Arquivo de script inválido.";
            ShellBlocks.showToast(
                workspace,
                message,
                ShellBlocks.LogLevel.ERROR,
            );
            Logger.log(message, ShellBlocks.LogLevel.ERROR);
        }
    });
}

/**
 * Carrega definições (CLI) e atualiza o ambiente.
 */
export function uploadDefinitions(workspace: Blockly.WorkspaceSvg): void {
    triggerFileUpload((jsonContent) => {
        try {
            const definitions: ShellBlocks.CLI.CliDefinitions =
                JSON.parse(jsonContent);

            if (!definitions.commands || !Array.isArray(definitions.commands)) {
                throw new Error('JSON inválido: falta array de "commands".');
            }

            DataManager.saveCustomDefinitions(definitions);
            ShellBlocks.refreshWorkspaceDefinitions(workspace, definitions);

            const message = "Definições atualizadas com sucesso!";
            ShellBlocks.showToast(workspace, message);
            Logger.log(message, ShellBlocks.LogLevel.INFO);
        } catch (error) {
            const message = `Erro ao carregar definições: ${error}`;
            ShellBlocks.showToast(workspace, message);
            Logger.log(message, ShellBlocks.LogLevel.ERROR);
        }
    });
}

/**
 * Reseta para padrão de fábrica.
 */
export async function resetToFactorySettings(
    workspace: Blockly.WorkspaceSvg,
    onLevelsReset: () => void,
): Promise<void> {
    try {
        Logger.log("Iniciando reset de fábrica...", ShellBlocks.LogLevel.INFO);

        const defaultDefs = DataManager.resetDefinitions();
        if (defaultDefs) {
            ShellBlocks.refreshWorkspaceDefinitions(workspace, defaultDefs);
        } else {
            throw new Error("Falha ao baixar definições padrão.");
        }

        DataManager.resetGameData();
        onLevelsReset();

        ShellBlocks.showToast(
            workspace,
            "Ambiente completo restaurado para padrões de fábrica.",
        );
    } catch (error) {
        const message = `Erro ao resetar fábrica: ${error}`;
        ShellBlocks.showToast(workspace, message, ShellBlocks.LogLevel.ERROR);
        Logger.log(message, ShellBlocks.LogLevel.ERROR);
    }
}

/**
 * Carrega níveis (Game Data) e atualiza UI.
 */
export function uploadGameData(
    workspace: Blockly.WorkspaceSvg,
    onSuccess: (data: API.GameData) => void,
): void {
    triggerFileUpload((jsonContent) => {
        try {
            const gameData: API.GameData = JSON.parse(jsonContent);

            if (!gameData.levels || !Array.isArray(gameData.levels)) {
                throw new Error('JSON inválido: falta array de "levels".');
            }

            DataManager.saveCustomGameData(gameData);
            onSuccess(gameData);

            ShellBlocks.showToast(workspace, "Níveis atualizados manualmente.");
        } catch (error) {
            const message = `Erro ao carregar níveis: ${error}`;
            ShellBlocks.showToast(workspace, message);
            Logger.log(message, ShellBlocks.LogLevel.ERROR);
        }
    });
}

function triggerFileUpload(onFileRead: (content: string) => void): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === "string") onFileRead(content);
        };
        reader.readAsText(file);
    };

    input.click();
}
