import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";
import { createToolbox } from "./toolboxBuilder";
import { OverlayToolbox, OverlayWorkspaceMetrics } from "./overlayToolbox";
import { findScriptRoot } from "../blocks/systemBlocks";
import { disableOrphanBlocks } from "./orphanHandler";
import { registerBlockTypesFromDefinitions } from "../blocks/blocksBuilder";
import {
    initAutoSaver,
    loadSession,
    saveWorkspaceSession,
} from "../serialization/workspaceAutoSaver";
import { LogFunction, LogLevel } from "../types/logger";
import { setLoggerForWorkspace } from "../services/logging";
import { clearWorkspaceAssembly } from "./assembly";

export interface WorkspaceConfig {
    externalLogger: LogFunction;
    workspaceId: string;
    shouldSetupAutosave?: boolean;
}

const FALLBACK_DEFINITIONS: CLI.CliDefinitions = {
    commands: [],
    categories: [
        {
            name: "Sistema Offline",
            entities: [],
        },
    ],
    operators: [],
    controls: [],
};

/**
 * Inicializa o Workspace principal.
 */
export async function setupWorkspace(
    blocklyArea: HTMLDivElement,
    definitions: CLI.CliDefinitions | null,
    config: WorkspaceConfig,
): Promise<Blockly.WorkspaceSvg | null> {
    if (!definitions) {
        config.externalLogger(
            "Backend indisponível. Iniciando em Modo de Segurança.",
            LogLevel.WARN,
        );
        definitions = FALLBACK_DEFINITIONS;
    }

    registerBlockTypesFromDefinitions(definitions);

    const workspace = Blockly.inject(
        blocklyArea,
        getBlocklyOptions(definitions),
    );

    setLoggerForWorkspace(workspace, config.externalLogger);
    disableOrphanBlocks(workspace);

    if (config.shouldSetupAutosave)
        loadSession(workspace, config.workspaceId);

    if (!findScriptRoot(workspace)) createScriptRoot(workspace);

    if (config.shouldSetupAutosave)
        initAutoSaver(workspace, config.workspaceId);

    initCustomContextMenu(config.workspaceId, config.shouldSetupAutosave ?? false);

    return workspace;
}

/**
 * Responsável por aplicar novas definições e resetar o workspace.
 */
export function refreshWorkspaceDefinitions(
    workspace: Blockly.WorkspaceSvg,
    definitions: CLI.CliDefinitions,
): void {
    registerBlockTypesFromDefinitions(definitions);
    const newToolbox = createToolbox(definitions);
    workspace.updateToolbox(newToolbox);
    Blockly.Events.disable();
    try {
        workspace.clear();
        createScriptRoot(workspace);
    } finally {
        Blockly.Events.enable();
    }
}

/**
 * Cria o bloco raiz (script_root) no workspace.
 * Exportada para ser usada em resets manuais.
 */
export function createScriptRoot(workspace: Blockly.WorkspaceSvg): void {
    const rootBlock = workspace.newBlock(BlockIDs.ROOT_BLOCK_TYPE);
    rootBlock.initSvg();
    rootBlock.render();
    rootBlock.moveBy(50, 50);
}

function getBlocklyOptions(
    cliDefinitions: CLI.CliDefinitions,
): Blockly.BlocklyOptions {
    return {
        toolbox: createToolbox(cliDefinitions),
        renderer: "zelos",
        plugins: { toolbox: OverlayToolbox, metricsManager: OverlayWorkspaceMetrics },
        trashcan: true,
        scrollbars: true,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.75,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2,
        },
        move: {
            scrollbars: true,
            drag: true,
            wheel: true,
        },
        grid: {
            spacing: 20,
            length: 3,
            colour: "#ccc",
            snap: true,
        },
    };
}

function initCustomContextMenu(workspaceId: string, hasAutosave: boolean): void {
    const { registry, ScopeType } = Blockly.ContextMenuRegistry;

    if (registry.getItem(BlockIDs.CONTEXT_MENU_IDS.CLEAR_OPTION))
        registry.unregister(BlockIDs.CONTEXT_MENU_IDS.CLEAR_OPTION);

    registry.register({
        scopeType: ScopeType.WORKSPACE,
        weight: 0,
        id: BlockIDs.CONTEXT_MENU_IDS.CLEAR_OPTION,
        preconditionFn: () => "enabled",
        callback: (scope) => {
            const workspace = scope.workspace as Blockly.WorkspaceSvg;
            if (!workspace) return;
            const cleared = clearWorkspaceAssembly(workspace, () =>
                confirm("Remover os blocos da montagem? O Script Principal será mantido."),
            );
            if (cleared && hasAutosave) saveWorkspaceSession(workspace, workspaceId);
        },
        displayText: "Limpar montagem",
    });
}
