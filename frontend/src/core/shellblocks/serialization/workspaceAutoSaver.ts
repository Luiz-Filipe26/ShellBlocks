import * as Blockly from "blockly";
import { showToast } from "../ui/toast";
import { LogLevel } from "../types/logger";
import { coreLog } from "../services/logging";

const BASE_STORAGE_KEY = "blockly_autosave_";
const SAVE_DELAY_MS = 1000;

let saveTimeout: number | null = null;

/**
 * Carrega o estado salvo (se existir) para o workspace.
 * Retorna true se carregou algo, false se não havia nada salvo.
 */
export function loadSession(
    workspace: Blockly.WorkspaceSvg,
    workspaceId: string,
): boolean {
    const autoSaveStorageKey = getAutoSaveStorageKey(workspaceId);
    try {
        const serializedState = localStorage.getItem(autoSaveStorageKey);
        if (!serializedState) return false;

        const jsonState = JSON.parse(serializedState);
        secureLoadSerializedWorkspace(workspace, jsonState);

        const message = "Sessão anterior restaurada com sucesso.";
        showToast(workspace, message);
        coreLog(workspace, message, LogLevel.INFO);
        return true;
    } catch (error) {
        coreLog(
            workspace,
            `Erro ao carregar sessão automática: ${error}`,
            LogLevel.ERROR,
        );
        localStorage.removeItem(autoSaveStorageKey);
        return false;
    }
}

function secureLoadSerializedWorkspace(
    workspace: Blockly.WorkspaceSvg,
    jsonState: { [key: string]: any },
) {
    Blockly.Events.disable();
    try {
        workspace.clear();
        Blockly.serialization.workspaces.load(jsonState, workspace);
    } finally {
        Blockly.Events.enable();
    }
    Blockly.Events.fire(new Blockly.Events.FinishedLoading(workspace));
}

/**
 * Inicializa o listener que salva o workspace automaticamente.
 */
export function initAutoSaver(
    workspace: Blockly.WorkspaceSvg,
    workspaceId: string,
): void {
    workspace.addChangeListener((e) => {
        if (e.isUiEvent) return;

        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }

        saveTimeout = window.setTimeout(() => {
            saveWorkspaceSession(workspace, workspaceId);
            saveTimeout = null;
        }, SAVE_DELAY_MS);
    });
}

export function saveWorkspaceSession(workspace: Blockly.Workspace, workspaceId: string): void {
    const autoSaveStorageKey = getAutoSaveStorageKey(workspaceId);
    try {
        const state = Blockly.serialization.workspaces.save(workspace);
        const jsonState = JSON.stringify(state);
        localStorage.setItem(autoSaveStorageKey, jsonState);
    } catch (error) {
        console.error("Falha ao salvar workspace no localStorage", error);
    }
}

/**
 * Limpa o save automático (útil para o botão "Resetar")
 */
export function clearAutoSave(workspaceId: string): void {
    const autoSaveStorageKey = getAutoSaveStorageKey(workspaceId);
    localStorage.removeItem(autoSaveStorageKey);
}

function getAutoSaveStorageKey(workspaceId: string): string {
    return `${BASE_STORAGE_KEY}${workspaceId}`;
}
