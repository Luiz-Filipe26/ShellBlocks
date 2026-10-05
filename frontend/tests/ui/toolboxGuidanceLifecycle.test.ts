import * as Blockly from "blockly";
import { afterEach, expect, it, vi } from "vitest";
import { OverlayToolbox } from "@/core/shellblocks/workspace/overlayToolbox";
import rawDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import type { GameData } from "@/pages/features/session/types";
import { setupToolboxGuidance } from "@/pages/features/ui/toolboxGuidanceController";

const state = vi.hoisted(() => ({
    elements: {} as Record<string, EventTarget>,
    workspace: {} as Blockly.WorkspaceSvg,
    definitions: undefined as ReturnType<typeof parseCliDefinitions>["definitions"] | undefined,
    data: { levels: [], levelOrder: [] } as GameData,
    importData: undefined as ((data: GameData) => void) | undefined,
    resetData: undefined as ((data: GameData) => void) | undefined,
}));
vi.mock("shellblocks", () => ({ setupWorkspace: vi.fn(async () => state.workspace), LogLevel: { WARN: "WARN", ERROR: "ERROR" } }));
vi.mock("@/pages/features/ui/DOMProvider", () => ({ getPageElements: () => state.elements }));
vi.mock("@/pages/features/session/dataManager", () => ({ getDefinitions: () => state.definitions, getGameData: () => state.data }));
vi.mock("@/pages/features/session/persistenceManager", () => ({
    hasMadeInitialChoice: () => true,
    uploadGameData: (_workspace: unknown, callback: (data: GameData) => void) => { state.importData = callback; },
    resetToFactorySettings: (_workspace: unknown, callback: (data: GameData) => void) => { state.resetData = callback; },
}));
vi.mock("@/pages/features/session/levelLoader", () => ({
    setupLevelSelector: (data: GameData) => { state.data = data; },
    getCurrentLevelId: () => state.data.levelOrder[0],
    getCachedLevelData: (id: string) => state.data.levels.find((level) => level.id === id),
}));
vi.mock("@/pages/features/ui/toolboxGuidanceController", async (original) => {
    const actual = await original<typeof import("@/pages/features/ui/toolboxGuidanceController")>();
    return { ...actual, setupToolboxGuidance: vi.fn(actual.setupToolboxGuidance) };
});
vi.mock("@/pages/features/ui/SidebarResizer", () => ({ SidebarResizer: class { start() {} } }));
vi.mock("@/pages/features/ui/compactLayout", () => ({ setupCompactLayout: vi.fn() }));
vi.mock("@/pages/features/ui/sidebarController", () => ({ setupSidebarToggle: vi.fn() }));
vi.mock("@/pages/features/ui/systemLogger", () => ({ initSystemLogger: vi.fn(), log: vi.fn() }));
vi.mock("@/pages/features/ui/guidedOnboarding", () => ({ setupGuidedOnboarding: () => ({ refresh: vi.fn() }) }));
vi.mock("@/pages/features/ui/helpController", () => ({ setupHelpGuide: vi.fn() }));
vi.mock("@/pages/features/ui/initialChoice", () => ({ setupInitialChoice: vi.fn() }));
vi.mock("@/pages/features/ui/workspaceMaximization", () => ({ setupWorkspaceMaximization: vi.fn() }));
vi.mock("@/pages/features/execution/scriptHotReloader", () => ({ setupScriptHotReloader: vi.fn() }));
vi.mock("@/pages/features/execution/executionOutput", () => ({ setupOutputClearButton: vi.fn() }));
vi.mock("@/pages/features/execution/scriptRunner", () => ({ runScript: vi.fn() }));

function mission(commandId: string): GameData {
    return { levels: [{ id: commandId, title: commandId, toolboxGuidance: [{ entity: "command", commandId }] }], levelOrder: [commandId] };
}

afterEach(() => { vi.unstubAllGlobals(); });

it("o bootstrap reutiliza um controller nas importações e no reset, consultando dados e definições atuais", async () => {
    const select = new EventTarget();
    const addListener = vi.spyOn(select, "addEventListener");
    for (const name of ["levelSelect", "initialChoiceModal", "sidebarResizerGutter", "sidebar", "instructionsResizerGutter",
        "instructionsSidebar", "btnToggleSidebar", "systemLogContainer", "blocklyArea", "onboardingInterceptor",
        "onboardingNotice", "btnHelpGuide", "runBtn", "btnClearAssembly", "btnLoadScript", "btnLoadDefs", "btnResetDefs",
        "advancedControls", "systemLogPanel", "cliOutput", "clearBtn", "btnSaveScript", "btnLoadGame", "btnMaximizeWorkspace",
        "workspaceMaximizeIcon", "workspaceMinimizeIcon", "appHeader", "editorToolbar", "btnDownloadShell"]) state.elements[name] = new EventTarget();
    state.elements.levelSelect = select;
    state.definitions = parseCliDefinitions(rawDefinitions).definitions;
    state.data = mission("ls");
    const listeners = new Set<() => void>();
    const category = Object.assign(Object.create(Blockly.ToolboxCategory.prototype) as Blockly.ToolboxCategory, {
        getContents: () => ["command:ls", "command:grep"].map((type) => ({ kind: "block", type })),
    });
    const apply = vi.fn();
    const toolbox = Object.assign(Object.create(OverlayToolbox.prototype) as OverlayToolbox, {
        getToolboxItems: () => [category],
        setRelevantBlocks: apply,
        onContentsChanged: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    });
    state.workspace = Object.assign(Object.create(Blockly.WorkspaceSvg.prototype) as Blockly.WorkspaceSvg, {
        getToolbox: () => toolbox,
        getInjectionDiv: () => ({}),
    });
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("confirm", () => true);
    await import("@/pages/index");
    await vi.waitFor(() => expect(vi.mocked(setupToolboxGuidance)).toHaveBeenCalled());
    for (const command of ["grep", "ls", "grep"]) {
        state.elements.btnLoadGame.dispatchEvent(new Event("click"));
        state.importData!(mission(command));
        expect(apply).toHaveBeenLastCalledWith(new Map([[`command:${command}`, new Set()]]));
    }
    expect(setupToolboxGuidance).toHaveBeenCalledOnce();
    expect(addListener.mock.calls.filter(([event]) => event === "change")).toHaveLength(1);
    expect(listeners.size).toBe(1);
    state.elements.btnResetDefs.dispatchEvent(new Event("click"));
    state.resetData!(mission("ls"));
    expect(apply).toHaveBeenLastCalledWith(new Map([["command:ls", new Set()]]));
    expect(setupToolboxGuidance).toHaveBeenCalledOnce();
    expect(addListener.mock.calls.filter(([event]) => event === "change")).toHaveLength(1);
    expect(listeners.size).toBe(1);
    state.definitions = { ...state.definitions, commands: state.definitions.commands.filter((command) => command.id !== "ls") };
    listeners.forEach((listener) => listener());
    expect(apply).toHaveBeenLastCalledWith(new Map());
    const controller = vi.mocked(setupToolboxGuidance).mock.results[0].value;
    controller.dispose();
    expect(listeners.size).toBe(0);
    apply.mockClear();
    select.dispatchEvent(new Event("change"));
    expect(apply).not.toHaveBeenCalled();
});
