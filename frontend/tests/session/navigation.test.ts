import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameData } from "@/pages/features/session/types";
import { createSelectorDependencies, MemoryStorage, selectContext, TestElement } from "../helpers/navigation";
import { createBlock, createHeadlessWorkspace, connectInput } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";

const game: GameData = {
    levels: [
        { id: "first", title: "Primeiro", verificationScript: "verify", toolboxGuidance: [] },
        { id: "second", title: "Segundo", verificationScript: "verify", toolboxGuidance: [] },
        { id: "last", title: "Último", verificationScript: "verify", toolboxGuidance: [] },
    ],
    levelOrder: ["second", "first", "last"],
};

describe("contexto e conclusão das atividades", () => {
    let loader: typeof import("@/pages/features/session/levelLoader");
    let storage: MemoryStorage;
    let ui: ReturnType<typeof createSelectorDependencies>;

    beforeEach(async () => {
        vi.resetModules();
        storage = new MemoryStorage();
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("document", { createElement: () => new TestElement() });
        loader = await import("@/pages/features/session/levelLoader");
        ui = createSelectorDependencies();
    });
    afterEach(() => vi.unstubAllGlobals());

    it.each([false, true])("sucesso desbloqueia separadamente e Continuar navega uma vez (experimento=%s)", (experiment) => {
        loader.setupLevelSelector(game, ui.deps, experiment);
        selectContext(ui.elements.levelSelect, "second");
        loader.markLevelCompleted("second", ui.deps, experiment);
        expect(loader.getCurrentLevelId()).toBe("second");
        expect(ui.elements.missionCompletion.hidden).toBe(false);
        expect(ui.elements.continueBtn.hidden).toBe(false);
        expect(ui.elements.continueBtn.textContent).toContain("Primeiro");
        expect(ui.elements.levelSelect.options.find((o) => o.value === "first")?.disabled).toBe(false);
        expect(storage.getItem("experiment_progress_v1")).toBe(experiment ? "first" : null);
        const change = vi.fn();
        ui.elements.levelSelect.addEventListener("change", change);
        ui.elements.continueBtn.click();
        ui.elements.continueBtn.click();
        expect(change).toHaveBeenCalledOnce();
        expect(loader.getCurrentLevelId()).toBe("first");
    });

    it("usa a próxima atividade e não a fronteira de desbloqueio já alcançada", () => {
        storage.setItem("experiment_progress_v1", "last");
        loader.setupLevelSelector(game, ui.deps, true);
        selectContext(ui.elements.levelSelect, "second");
        loader.markLevelCompleted("second", ui.deps, true);
        ui.elements.continueBtn.click();
        expect(loader.getCurrentLevelId()).toBe("first");
        expect(storage.getItem("experiment_progress_v1")).toBe("last");
    });

    it("no último nível apresenta conclusão sem destino inexistente", () => {
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, "last");
        loader.markLevelCompleted("last", ui.deps, false);
        expect(ui.elements.missionCompletionText.textContent).toContain("Percurso concluído");
        expect(ui.elements.continueBtn.hidden).toBe(true);
        ui.elements.continueBtn.click();
        expect(loader.getCurrentLevelId()).toBe("last");
    });

    it("não oferece avanço antes do sucesso nem conclui Sandbox ou nível sem verificação", () => {
        const input = { ...game, levels: [...game.levels, { id: "unchecked", title: "Sem verificação", toolboxGuidance: [] }], levelOrder: [...game.levelOrder, "unchecked"] };
        loader.setupLevelSelector(input, ui.deps, false);
        loader.markLevelCompleted("sandbox", ui.deps, false);
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        selectContext(ui.elements.levelSelect, "unchecked");
        loader.markLevelCompleted("unchecked", ui.deps, false);
        ui.elements.continueBtn.click();
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        expect(loader.getCurrentLevelId()).toBe("unchecked");
    });

    it("conclusão de outra missão não aparece no contexto atualmente selecionado", () => {
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, "first");
        loader.markLevelCompleted("second", ui.deps, false);
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        selectContext(ui.elements.levelSelect, "second");
        expect(ui.elements.continueBtn.hidden).toBe(false);
    });

    it.each(["first", "sandbox"])("persiste e restaura %s após reabrir", async (id) => {
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, id);
        vi.resetModules();
        const reopened = await import("@/pages/features/session/levelLoader");
        const nextUi = createSelectorDependencies();
        reopened.setupLevelSelector(game, nextUi.deps, false);
        expect(reopened.getCurrentLevelId()).toBe(id);
        expect(nextUi.elements.levelSelect.value).toBe(id);
        expect(storage.getItem("shellblocks_last_context")).toBe(id);
    });

    it.each(["missing", "last"])("fallback para Sandbox quando %s não está disponível", (id) => {
        storage.setItem("shellblocks_last_context", id);
        loader.setupLevelSelector(game, ui.deps, true);
        expect(loader.getCurrentLevelId()).toBe("sandbox");
        expect(storage.getItem("shellblocks_last_context")).toBe("sandbox");
    });

    it("uploads/reset sucessivos mantêm um único handler e usam a ordem nova", () => {
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, "first");
        const newGame = { ...game, levelOrder: ["first", "second", "last"] };
        loader.setupLevelSelector(newGame, ui.deps, false);
        expect(loader.getCurrentLevelId()).toBe("first");
        loader.setupLevelSelector(newGame, ui.deps, false);
        loader.markLevelCompleted("first", ui.deps, false);
        const change = vi.fn();
        ui.elements.levelSelect.addEventListener("change", change);
        ui.elements.continueBtn.click();
        expect(change).toHaveBeenCalledOnce();
        expect(loader.getCurrentLevelId()).toBe("second");
    });

    it("dados nulos escondem conclusão e não deixam navegação ativa", () => {
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, "first");
        loader.markLevelCompleted("first", ui.deps, false);
        loader.setupLevelSelector(null, ui.deps, false);
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        ui.elements.continueBtn.click();
        expect(loader.getCurrentLevelId()).toBe("sandbox");
    });

    it("orientação espera uma montagem relevante e não se repete após reabrir", async () => {
        let hasAssembly = false;
        ui = createSelectorDependencies(() => hasAssembly);
        loader.setupLevelSelector(game, ui.deps, false);
        selectContext(ui.elements.levelSelect, "second");
        selectContext(ui.elements.levelSelect, "first");
        expect(ui.elements.assemblyTransitionNotice.hidden).toBe(true);
        hasAssembly = true;
        selectContext(ui.elements.levelSelect, "last");
        expect(ui.elements.assemblyTransitionNotice.hidden).toBe(false);
        vi.resetModules();
        const reopened = await import("@/pages/features/session/levelLoader");
        const nextUi = createSelectorDependencies(() => true);
        reopened.setupLevelSelector(game, nextUi.deps, false);
        selectContext(nextUi.elements.levelSelect, "first");
        expect(nextUi.elements.assemblyTransitionNotice.hidden).toBe(true);
    });

    it("mudanças de contexto preservam blocos e mostram a orientação apenas na primeira transição com montagem", () => {
        const defs = validDefinitions();
        const workspace = createHeadlessWorkspace(defs);
        try {
            const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
            const command = createBlock(workspace, BlockIDs.commandBlockType(defs.commands[0]));
            connectInput(root, BlockIDs.INPUTS.STACK, command);
            const before = Blockly.serialization.workspaces.save(workspace);
            ui = createSelectorDependencies(() => true);
            loader.setupLevelSelector(game, ui.deps, false);
            selectContext(ui.elements.levelSelect, "second");
            expect(ui.elements.assemblyTransitionNotice.hidden).toBe(true);
            selectContext(ui.elements.levelSelect, "first");
            expect(ui.elements.assemblyTransitionNotice.hidden).toBe(false);
            selectContext(ui.elements.levelSelect, "last");
            expect(ui.elements.assemblyTransitionNotice.hidden).toBe(true);
            selectContext(ui.elements.levelSelect, "sandbox");
            expect(Blockly.serialization.workspaces.save(workspace)).toEqual(before);
        } finally { workspace.dispose(); }
    });
});
