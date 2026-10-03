import "blockly/blocks";
import "blockly/msg/pt";
import {
    getCurrentLevelId,
    markLevelCompleted,
    setupLevelSelector,
} from "./features/session/levelLoader";
import { setupScriptHotReloader } from "./features/execution/scriptHotReloader";
import { setupOutputClearButton } from "./features/execution/executionOutput";
import { runScript } from "./features/execution/scriptRunner";
import * as Blockly from "blockly";
import * as Logger from "./features/ui/systemLogger";
import * as PersistenceManager from "./features/session/persistenceManager";
import { getDefinitions, getGameData } from "./features/session/dataManager";
import * as ShellBlocks from "shellblocks";
import { MAIN_WORKSPACE_ID } from "./features/constants/constants";
import { getPageElements } from "./features/ui/DOMProvider";
import type { GameData } from "./features/session/types";
import { SidebarResizer } from "./features/ui/SidebarResizer";
import { setupSidebarToggle } from "./features/ui/sidebarController";
import { setupGuidedOnboarding } from "./features/ui/guidedOnboarding";
import { setupHelpGuide } from "./features/ui/helpController";
import { setupInitialChoice } from "./features/ui/initialChoice";
import { clearWorkspaceAssembly, hasWorkspaceAssembly } from "@/core/shellblocks/workspace/assembly";
import type { SelectorDependencies } from "./features/session/levelLoader";
import { saveWorkspaceSession } from "@/core/shellblocks/serialization/workspaceAutoSaver";

const pageElements = getPageElements();
let gameData: GameData | null = null;
export const IS_EXPERIMENT_MODE =
    import.meta.env.VITE_EXPERIMENT_MODE === "true";
start();

async function start(): Promise<void> {
    if (!PersistenceManager.hasMadeInitialChoice()) {
        pageElements.initialChoiceModal.oncancel = (event) => event.preventDefault();
        pageElements.initialChoiceModal.showModal();
    }
    new SidebarResizer(
        pageElements.sidebarResizerGutter,
        pageElements.sidebar,
        "right",
    ).start();
    new SidebarResizer(
        pageElements.instructionsResizerGutter,
        pageElements.instructionsSidebar,
        "left",
    ).start();
    setupSidebarToggle(pageElements.btnToggleSidebar, pageElements.sidebar);
    Logger.initSystemLogger(pageElements.systemLogContainer);

    const definitions = getDefinitions();
    const workspace = await ShellBlocks.setupWorkspace(
        pageElements.blocklyArea,
        definitions,
        {
            externalLogger: Logger.log,
            workspaceId: MAIN_WORKSPACE_ID,
            shouldSetupAutosave: true,
        },
    );
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

    gameData = getGameData();
    const selectorDependencies: SelectorDependencies = {
        ...pageElements,
        hasWorkspaceAssembly: () => hasWorkspaceAssembly(workspace),
    };
    const onboarding = setupGuidedOnboarding({
        levelSelect: pageElements.levelSelect,
        workspaceSurface: workspace.getInjectionDiv(),
        interceptor: pageElements.onboardingInterceptor,
        notice: pageElements.onboardingNotice,
        helpButton: pageElements.btnHelpGuide,
        constructionControls: [pageElements.runBtn, pageElements.btnClearAssembly,
            pageElements.btnLoadScript, pageElements.btnLoadDefs, pageElements.btnResetDefs],
    }, () => {
        workspace.cancelCurrentGesture();
        workspace.hideChaff(true);
    });
    setupHelpGuide(pageElements, onboarding.refresh);
    setupLevelSelector(gameData, selectorDependencies, IS_EXPERIMENT_MODE);

    setupScriptHotReloader(workspace, pageElements.codeOutput);
    for (const area of [pageElements.advancedControls, pageElements.systemLogPanel]) {
        area.addEventListener("toggle", () => Blockly.svgResize(workspace));
    }
    registerButtonListeners(workspace, selectorDependencies);
    setupInitialChoice(pageElements);
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

function registerButtonListeners(
    workspace: Blockly.WorkspaceSvg,
    selectorDependencies: SelectorDependencies,
) {
    pageElements.runBtn.addEventListener("click", async () => {
        runScript(workspace, pageElements, getCurrentLevelId(), (levelId) =>
            markLevelCompleted(
                levelId,
                selectorDependencies,
                IS_EXPERIMENT_MODE,
            ),
        );
    });

    setupOutputClearButton(pageElements.cliOutput, pageElements.clearBtn);

    pageElements.btnClearAssembly.addEventListener("click", () => {
        const cleared = clearWorkspaceAssembly(workspace, () =>
            confirm("Remover os blocos da montagem? O Script Principal será mantido."),
        );
        if (cleared) saveWorkspaceSession(workspace, MAIN_WORKSPACE_ID);
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
            PersistenceManager.resetToFactorySettings(workspace, (data) => {
                gameData = data;
                setupLevelSelector(
                    gameData,
                    selectorDependencies,
                    IS_EXPERIMENT_MODE,
                );
            });
        }
    });

    pageElements.btnLoadGame.addEventListener("click", () => {
        PersistenceManager.uploadGameData(workspace, (data) => {
            gameData = data;
            setupLevelSelector(gameData, selectorDependencies, IS_EXPERIMENT_MODE);
        });
    });
}
