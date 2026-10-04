import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSelectorDependencies, MemoryStorage, selectContext, TestElement } from "../helpers/navigation";
import { createBlock, createHeadlessWorkspace, connectInput } from "../helpers/blockly";
import { validDefinitions, validRawDefinitions } from "../helpers/cliFixtures";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import type { GameData } from "@/pages/features/session/types";

class Dialog extends TestElement {
    open = false;
    oncancel: ((event: Event) => void) | null = null;
    showModal = vi.fn(() => { this.open = true; });
    close = vi.fn(() => { this.open = false; });
}

let focusedElement: TestElement | null = null;
class Button extends TestElement {
    focus(): void { focusedElement = this; }
}

const game: GameData = {
    levels: [{ id: "a", title: "A", toolboxGuidance: [] }, { id: "b", title: "B", toolboxGuidance: [] }],
    levelOrder: ["b", "a"],
};

describe("escolha inicial", () => {
    let loader: typeof import("@/pages/features/session/levelLoader");
    let setup: typeof import("@/pages/features/ui/initialChoice").setupInitialChoice;
    let storage: MemoryStorage;
    let ui: ReturnType<typeof createSelectorDependencies>;
    let elements: {
        initialChoiceModal: Dialog;
        guidedChoiceBtn: Button;
        freeChoiceBtn: Button;
        guidedChoiceUnavailable: TestElement;
        levelSelect: ReturnType<typeof createSelectorDependencies>["elements"]["levelSelect"] & { focus: () => void };
    };

    beforeEach(async () => {
        vi.resetModules();
        focusedElement = null;
        loader = await import("@/pages/features/session/levelLoader");
        ({ setupInitialChoice: setup } = await import("@/pages/features/ui/initialChoice"));
        storage = new MemoryStorage();
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("document", { createElement: () => new TestElement() });
        ui = createSelectorDependencies();
        elements = {
            initialChoiceModal: new Dialog(),
            guidedChoiceBtn: new Button(),
            freeChoiceBtn: new Button(),
            guidedChoiceUnavailable: new TestElement(),
            levelSelect: Object.assign(ui.elements.levelSelect, {
                focus: () => { focusedElement = ui.elements.levelSelect; },
            }),
        };
    });
    afterEach(() => vi.unstubAllGlobals());

    function initialize(experiment = false) {
        loader.setupLevelSelector(game, ui.deps, experiment);
        setup(elements as unknown as Parameters<typeof setup>[0]);
    }

    it("primeiro acesso abre escolha e foca a ação guiada; Escape não a dispensa", () => {
        storage.setItem("shellblocks_has_seen_guide", "true");
        initialize();
        expect(elements.initialChoiceModal.open).toBe(true);
        expect(focusedElement).toBe(elements.guidedChoiceBtn);
        const cancel = new Event("cancel", { cancelable: true });
        elements.initialChoiceModal.oncancel!(cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(storage.getItem("shellblocks_initial_choice_made")).toBeNull();
    });

    it.each([false, true])("guiado segue a primeira atividade disponível na ordem (experimento=%s)", (experiment) => {
        initialize(experiment);
        elements.guidedChoiceBtn.click();
        expect(loader.getCurrentLevelId()).toBe("b");
        expect(storage.getItem("shellblocks_last_context")).toBe("b");
        expect(storage.getItem("shellblocks_initial_choice_made")).toBe("true");
        expect(elements.initialChoiceModal.open).toBe(false);
        expect(focusedElement).toBe(elements.levelSelect);
    });

    it("Modo Livre seleciona e persiste Sandbox", () => {
        initialize();
        elements.freeChoiceBtn.click();
        expect(loader.getCurrentLevelId()).toBe("sandbox");
        expect(storage.getItem("shellblocks_last_context")).toBe("sandbox");
        expect(storage.getItem("shellblocks_initial_choice_made")).toBe("true");
    });

    it.each(["a", "sandbox", "missing", null])("depois da escolha, não reabre nem substitui o contexto restaurado %s", (context) => {
        storage.setItem("shellblocks_initial_choice_made", "true");
        if (context) storage.setItem("shellblocks_last_context", context);
        initialize();
        expect(elements.initialChoiceModal.showModal).not.toHaveBeenCalled();
        expect(loader.getCurrentLevelId()).toBe(context === "a" ? "a" : "sandbox");
    });

    it("após escolher, voltar restaura o último contexto, não a escolha original", async () => {
        initialize();
        elements.guidedChoiceBtn.click();
        selectContext(ui.elements.levelSelect, "a");
        vi.resetModules();
        const reopened = await import("@/pages/features/session/levelLoader");
        const { setupInitialChoice } = await import("@/pages/features/ui/initialChoice");
        reopened.setupLevelSelector(game, ui.deps, false);
        elements.initialChoiceModal.showModal.mockClear();
        setupInitialChoice(elements as unknown as Parameters<typeof setupInitialChoice>[0]);
        expect(reopened.getCurrentLevelId()).toBe("a");
        expect(elements.initialChoiceModal.showModal).not.toHaveBeenCalled();
    });

    it("sem atividades, explica a indisponibilidade e permite Modo Livre", () => {
        loader.setupLevelSelector({ levels: [], levelOrder: [] }, ui.deps, false);
        setup(elements as unknown as Parameters<typeof setup>[0]);
        expect(elements.guidedChoiceBtn.disabled).toBe(true);
        expect(elements.guidedChoiceUnavailable.hidden).toBe(false);
        expect(elements.freeChoiceBtn.disabled).toBe(false);
        expect(focusedElement).toBe(elements.freeChoiceBtn);
        elements.freeChoiceBtn.click();
        expect(loader.getCurrentLevelId()).toBe("sandbox");
    });

    it.each(["guidedChoiceBtn", "freeChoiceBtn"] as const)("%s preserva montagem real e definições customizadas", (choice) => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
            const command = createBlock(workspace, BlockIDs.commandBlockType(definitions.commands[0]));
            connectInput(root, BlockIDs.INPUTS.STACK, command);
            const before = Blockly.serialization.workspaces.save(workspace);
            const storedDefinitions = JSON.stringify(validRawDefinitions());
            storage.setItem("cli_definitions_v1", storedDefinitions);
            initialize();
            elements[choice].click();
            expect(Blockly.serialization.workspaces.save(workspace)).toEqual(before);
            expect(storage.getItem("cli_definitions_v1")).toBe(storedDefinitions);
        } finally { workspace.dispose(); }
    });
});
