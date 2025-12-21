import "blockly/blocks";
import "blockly/msg/pt";
import {
    getCurrentLevelId,
    onLevelSuccesEvent,
    setupLevelSelector,
} from "./features/session/levelLoader";
import { setupScriptHotReloader } from "./features/execution/scriptHotReloader";
import { runScript } from "./features/execution/scriptRunner";
import * as Blockly from "blockly";
import * as Logger from "./features/ui/systemLogger";
import * as PersistenceManager from "./features/session/persistenceManager";
import { setupHeaderBehavior } from "./features/ui/headerController";
import { getDefinitions, getGameData } from "./features/session/dataManager";
import * as ShellBlocks from "shellblocks";
import { MAIN_WORKSPACE_ID } from "./features/constants/constants";
import { getPageElements } from "./features/ui/DOMProvider";
import { GameData } from "@/types/api";
import { SidebarResizer } from "./features/ui/SidebarResizer";
import { setupSidebarToggle } from "./features/ui/sidebarController";
import { setupHelpGuide } from "./features/ui/helpController";

const pageElements = getPageElements();
let gameData: GameData | null = null;
export const IS_EXPERIMENT_MODE =
    import.meta.env.VITE_EXPERIMENT_MODE === "true";
start();

async function start(): Promise<void> {
    new SidebarResizer(
        pageElements.sidebarResizerGutter,
        pageElements.sidebar,
    ).start();
    setupSidebarToggle(pageElements.btnToggleSidebar, pageElements.sidebar);
    setupHelpGuide({
        btnHelpGuide: pageElements.btnHelpGuide,
        helpModal: pageElements.helpModal,
        closeHelpBtn: pageElements.closeHelpBtn,
    });

    const definitions = await getDefinitions();
    const workspace = await ShellBlocks.setupWorkspace(
        pageElements.blocklyArea,
        definitions,
        {
            externalLogger: Logger.log,
            workspaceId: MAIN_WORKSPACE_ID,
            shouldSetupAutosave: true,
        },
    );
    Logger.initSystemLogger(pageElements.systemLogContainer);

    if (workspace == null) {
        Logger.log(
            "Não foi possível criar o workspace! Aplicação abortada.",
            ShellBlocks.LogLevel.ERROR,
        );
        return;
    }

    if (IS_EXPERIMENT_MODE) {
        enforceExperimentRestrictions();
    }

    setupHeaderBehavior(pageElements.appHeader, pageElements.headerToggleBtn);

    gameData = await getGameData();
    await setupLevelSelector(gameData, pageElements, IS_EXPERIMENT_MODE);

    setupScriptHotReloader(workspace, pageElements.codeOutput);
    registerButtonListeners(workspace);
}

function enforceExperimentRestrictions() {
    Logger.log("Modo Experimento Ativo: Botões de personalização desativados.");

    const buttonsToDisable = [
        pageElements.btnLoadDefs,
        pageElements.btnLoadGame,
        pageElements.btnResetDefs,
    ];

    buttonsToDisable.forEach((button) => (button.disabled = true));
}

function registerButtonListeners(workspace: Blockly.WorkspaceSvg) {
    pageElements.runBtn.addEventListener("click", async () => {
        runScript(workspace, pageElements, getCurrentLevelId(), (levelId) =>
            onLevelSuccesEvent(
                levelId,
                pageElements.levelSelect,
                IS_EXPERIMENT_MODE,
            ),
        );
    });

    pageElements.clearBtn.addEventListener("click", () => {
        pageElements.cliOutput.textContent = "$";
    });

    pageElements.btnSaveScript.addEventListener("click", () => {
        PersistenceManager.downloadScript(workspace);
    });

    pageElements.btnLoadScript.addEventListener("click", () => {
        PersistenceManager.uploadScript(workspace);
    });

    if (IS_EXPERIMENT_MODE) return;

    pageElements.btnLoadDefs.addEventListener("click", () => {
        if (
            confirm(
                "Carregar novas definições limpará o workspace atual. Continuar?",
            )
        ) {
            PersistenceManager.uploadDefinitions(workspace);
        }
    });

    pageElements.btnResetDefs.addEventListener("click", () => {
        if (
            confirm(
                "ATENÇÃO: Isso apagará suas definições e níveis personalizados e voltará ao padrão do servidor. Continuar?",
            )
        ) {
            PersistenceManager.resetToFactorySettings(workspace, async () => {
                await setupLevelSelector(
                    gameData,
                    pageElements,
                    IS_EXPERIMENT_MODE,
                );
                pageElements.levelSelect.selectedIndex = 0;
                pageElements.levelSelect.dispatchEvent(new Event("change"));
            });
        }
    });

    pageElements.btnLoadGame.addEventListener("click", () => {
        PersistenceManager.uploadGameData(workspace, () => {
            setupLevelSelector(gameData, pageElements, IS_EXPERIMENT_MODE);
        });
    });
}
