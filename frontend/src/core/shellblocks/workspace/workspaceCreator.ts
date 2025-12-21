import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";
import { createToolbox } from "./toolboxBuilder";
import { findScriptRoot, initSystemBlocks } from "../blocks/systemBlocks";
import { disableOrphanBlocks } from "./orphanHandler";
import { createAllBlocksFromDefinition } from "../blocks/blocksBuilder";
import {
    clearAutoSave,
    initAutoSaver,
    loadSession,
} from "../serialization/workspaceAutoSaver";
import { LogFunction, LogLevel } from "../types/logger";
import { setLoggerForWorkspace } from "../services/logging";

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
            commands: [],
        },
    ],
    operators: [],
    controls: [],
};

// --- Tipos Auxiliares para Normalização ---
interface RawCLICommand extends Omit<CLI.CLICommand, "id"> {
    id?: string;
}
interface RawCliDefinitions extends Omit<CLI.CliDefinitions, "commands"> {
    commands: RawCLICommand[];
}

/**
 * Inicializa o Workspace principal.
 */
export async function setupWorkspace(
    blocklyArea: HTMLDivElement,
    definitions: CLI.CliDefinitions | null,
    config: WorkspaceConfig,
): Promise<Blockly.WorkspaceSvg | null> {
    initSystemBlocks();
    if (!definitions) {
        config.externalLogger(
            "Backend indisponível. Iniciando em Modo de Segurança.",
            LogLevel.WARN,
        );
        definitions = FALLBACK_DEFINITIONS;
    }

    const normalizedDefinitions = normalizeCliDefinitions(definitions);
    createAllBlocksFromDefinition(normalizedDefinitions);

    const workspace = Blockly.inject(
        blocklyArea,
        getBlocklyOptions(normalizedDefinitions),
    );

    setLoggerForWorkspace(workspace, config.externalLogger);
    disableOrphanBlocks(workspace);

    if (config.shouldSetupAutosave)
        loadSession(workspace, config.workspaceId);

    if (!findScriptRoot(workspace)) createScriptRoot(workspace);

    if (config.shouldSetupAutosave)
        initAutoSaver(workspace, config.workspaceId);

    initCustomContextMenu(
        config.workspaceId,
        config.shouldSetupAutosave || false,
    );

    return workspace;
}

/**
 * Responsável por aplicar novas definições e resetar o workspace.
 */
export function refreshWorkspaceDefinitions(
    workspace: Blockly.WorkspaceSvg,
    definitions: CLI.CliDefinitions,
): void {
    const normalizedDefs = normalizeCliDefinitions(definitions);
    createAllBlocksFromDefinition(normalizedDefs);
    const newToolbox = createToolbox(normalizedDefs);
    workspace.updateToolbox(newToolbox);
    Blockly.Events.disable();
    workspace.clear();
    createScriptRoot(workspace);
    Blockly.Events.enable();
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
        trashcan: true,
        scrollbars: true,
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.9,
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

function normalizeCliDefinitions(
    raw: RawCliDefinitions | CLI.CliDefinitions,
): CLI.CliDefinitions {
    const defs = raw as RawCliDefinitions;
    return {
        ...defs,
        commands: defs.commands.map((command) => ({
            ...command,
            id: command.id || command.shellCommand,
        })),
    };
}

function initCustomContextMenu(
    workspaceId: string,
    hasAutosave: boolean,
): void {
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
            Blockly.Events.setGroup(true);

            try {
                const rootBlock = findScriptRoot(workspace);
                const allBlocks = workspace.getAllBlocks(false);

                allBlocks.forEach((block) => {
                    if (block !== rootBlock) {
                        block.dispose(false);
                    }
                });

                if (!rootBlock) {
                    createScriptRoot(workspace);
                }

                if (hasAutosave) {
                    clearAutoSave(workspaceId);
                }
            } finally {
                Blockly.Events.setGroup(false);
            }
        },
        displayText: "Limpar e Resetar",
    });
}
