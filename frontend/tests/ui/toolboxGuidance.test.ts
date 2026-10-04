import * as Blockly from "blockly";
import { afterEach, describe, expect, it, vi } from "vitest";
import rawDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { ToolboxRelevance, getRelevantCategories, getToolboxBlockTypes } from "@/core/shellblocks/workspace/toolboxRelevance";
import { OverlayToolbox, OverlayFlyout } from "@/core/shellblocks/workspace/overlayToolbox";
import { setupToolboxGuidance } from "@/pages/features/ui/toolboxGuidanceController";
import type { Level } from "@/pages/features/session/types";
import { ToolboxOptionDropdown } from "@/core/shellblocks/ui/toolboxOptionDropdown";

class VisualElement {
    classes = new Set<string>();
    classList = {
        add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name),
        toggle: (name: string, active: boolean) => { if (active) this.classes.add(name); else this.classes.delete(name); },
    };
    title = "";
    textContent = "";
}
function category(
    types: string[],
    parent: Blockly.ToolboxCategory | null = null,
    name = "Categoria",
) {
    const element = new VisualElement();
    const item = Object.assign(Object.create(Blockly.ToolboxCategory.prototype) as Blockly.ToolboxCategory, {
        getContents: () => types.map((type) => ({ kind: "block", type })),
        getParent: () => parent,
        getName: () => name,
        getDiv: () => element as unknown as HTMLDivElement,
        getClickTarget: () => element as unknown as Element,
        isExpanded: () => false,
    });
    return { item, element };
}
function block(type: string) {
    const element = new VisualElement();
    const field = Object.create(ToolboxOptionDropdown.prototype) as ToolboxOptionDropdown;
    const setFlags = vi.fn();
    field.setRelevantFlags = setFlags;
    return { type, element, field, setFlags, isInsertionMarker: () => false, getField: () => type.startsWith("option:") ? field : null,
        pathObject: { svgPath: element },
    };
}
function visuals() {
    const root = category([], null, "Toolbox");
    const parent = category([], root.item, "Diretórios");
    const first = category(["command:ls", "option:ls", "operand:ls:directory"], parent.item, "ls — Listar arquivos");
    const repeat = category(["command:ls"], parent.item, "Outra ocorrência de ls");
    const unrelatedParent = category([], null, "Filtros");
    const other = category(["command:grep"], unrelatedParent.item, "grep — Buscar texto");
    // Blockly exposes a flattened list; parents retain the native category hierarchy.
    let items = [root.item, parent.item, first.item, repeat.item, unrelatedParent.item, other.item];
    const blocks = [block("command:ls"), block("command:ls"), block("option:ls"), block("command:grep")];
    let contentsChanged = () => {};
    const unsubscribe = vi.fn();
    const toolbox = {
        getToolboxItems: () => items,
        getFlyout: () => ({ getWorkspace: () => ({ getAllBlocks: () => blocks }) }),
        onContentsChanged: (listener: () => void) => { contentsChanged = listener; return unsubscribe; },
        setRelevantBlocks: (targets: ReadonlyMap<string, ReadonlySet<string>>) => relevance.setTargets(targets, toolbox as unknown as Blockly.Toolbox),
    };
    const relevance = new ToolboxRelevance();
    return { root, parent, first, repeat, other, unrelatedParent, blocks, toolbox, relevance, unsubscribe,
        rebuild: () => {
            const old = items;
            const replacement = category(["command:ls", "option:ls", "command:grep"]);
            items = [replacement.item]; contentsChanged(); return { old, replacement };
        },
        notify: () => contentsChanged(),
    };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("apresentação da relevância na toolbox", () => {
    it("deriva categorias fechadas e ancestrais, incluindo todas as ocorrências", () => {
        const ui = visuals();
        const categories = getRelevantCategories(ui.toolbox.getToolboxItems(), new Set(["command:ls"]));
        expect(ui.first.item.getName()).toBe("ls — Listar arquivos");
        expect(ui.parent.item.getName()).toBe("Diretórios");
        expect(categories).toEqual(new Map([
            [ui.first.item, "direct"], [ui.parent.item, "ancestor"], [ui.root.item, "ancestor"],
            [ui.repeat.item, "direct"],
        ]));
        expect(ui.first.item.isExpanded()).toBe(false);
        expect(getToolboxBlockTypes(ui.toolbox.getToolboxItems())).toEqual(new Set(["command:ls", "option:ls", "operand:ls:directory", "command:grep"]));
    });
    it.each(["command:ls", "option:ls", "operand:ls:directory"])(
        "%s destaca a categoria ls direta e Diretórios ancestral, sem destacar outra categoria",
        (type) => {
            const ui = visuals();
            ui.toolbox.setRelevantBlocks(new Map([[type, new Set()]]));
            expect(ui.first.element.classes).toContain("shellblocks-toolbox-relevant-category");
            expect(ui.parent.element.classes).toContain("shellblocks-toolbox-relevant-category-ancestor");
            expect(ui.root.element.classes).toContain("shellblocks-toolbox-relevant-category-ancestor");
            if (type === "command:ls") expect(ui.repeat.element.classes).toContain("shellblocks-toolbox-relevant-category");
            else expect(ui.repeat.element.classes.size).toBe(0);
            expect(ui.other.element.classes.size).toBe(0);
        },
    );
    it("destaca todas as ocorrências sem incluir commands vizinhos", () => {
        const ui = visuals();
        ui.toolbox.setRelevantBlocks(new Map([["command:ls", new Set()]]));
        expect(ui.blocks.map((block) => block.element.classes.size > 0)).toEqual([true, true, false, false]);
        expect(ui.first.element.classes).toContain("shellblocks-toolbox-relevant-category");
        expect(ui.parent.element.classes).toContain("shellblocks-toolbox-relevant-category-ancestor");
        expect(ui.root.element.classes).toContain("shellblocks-toolbox-relevant-category-ancestor");
        expect(ui.other.element.classes.size).toBe(0);
        ui.relevance.dispose();
        expect(ui.blocks.every((block) => block.element.classes.size === 0)).toBe(true);
        expect(ui.first.element.classes.size).toBe(0);
        expect(ui.parent.element.classes.size).toBe(0);
        expect(ui.root.element.classes.size).toBe(0);
    });
    it("orienta todas as flags no bloco único e limpa conteúdo recriado", () => {
        const ui = visuals();
        ui.toolbox.setRelevantBlocks(new Map([["option:ls", new Set(["-l", "-h"])]]));
        expect(ui.blocks[2].setFlags).toHaveBeenLastCalledWith(new Set(["-l", "-h"]));
        const old = ui.blocks[2];
        const replacement = block("option:ls");
        ui.blocks.splice(2, 1, replacement);
        ui.relevance.refresh(ui.toolbox as unknown as Blockly.Toolbox);
        expect(old.element.classes.size).toBe(0);
        expect(old.setFlags).toHaveBeenLastCalledWith(new Set());
        expect(replacement.setFlags).toHaveBeenLastCalledWith(new Set(["-l", "-h"]));
    });
    it("os hooks locais reaplicam apresentação após render e show", () => {
        const workspace = { options: new Blockly.Options({}), addChangeListener: vi.fn() } as unknown as Blockly.WorkspaceSvg;
        const toolbox = new OverlayToolbox(workspace);
        const refresh = vi.spyOn(toolbox, "refreshRelevance").mockImplementation(() => {});
        const change = vi.fn();
        const unsubscribe = toolbox.onContentsChanged(change);
        vi.spyOn(Blockly.Toolbox.prototype, "render").mockImplementation(() => {});
        toolbox.render({ kind: "categoryToolbox", contents: [] });
        expect(change).toHaveBeenCalledOnce();
        expect(refresh).toHaveBeenCalledOnce();
        unsubscribe();
        toolbox.render({ kind: "categoryToolbox", contents: [] });
        expect(change).toHaveBeenCalledOnce();
        vi.spyOn(Blockly.VerticalFlyout.prototype, "show").mockImplementation(() => {});
        const flyout = Object.assign(Object.create(OverlayFlyout.prototype) as OverlayFlyout, {
            getTargetWorkspace: () => ({ getToolbox: () => toolbox }),
        });
        flyout.show([]);
        expect(refresh).toHaveBeenCalledTimes(3);
    });
});

describe("missão e definições", () => {
    it("recalcula, limpa, diagnostica sem spam e remove listeners no dispose", () => {
        const ui = visuals();
        const select = new EventTarget();
        let definitions = parseCliDefinitions(rawDefinitions).definitions;
        let level: Level | undefined = { id: "first", title: "First", toolboxGuidance: [{ entity: "command", commandId: "ls" }] };
        const diagnose = vi.fn();
        const controller = setupToolboxGuidance(ui.toolbox as unknown as OverlayToolbox, select as HTMLSelectElement, () => level, () => definitions, diagnose);
        expect(ui.blocks[0].element.classes.size).toBe(1);
        level = { id: "second", title: "Second", toolboxGuidance: [{ entity: "command", commandId: "grep" }] };
        select.dispatchEvent(new Event("change"));
        expect(ui.blocks[0].element.classes.size).toBe(0);
        expect(ui.blocks[3].element.classes.size).toBe(1);
        expect(ui.first.element.classes.size).toBe(0);
        expect(ui.parent.element.classes.size).toBe(0);
        expect(ui.root.element.classes.size).toBe(0);
        expect(ui.other.element.classes).toContain("shellblocks-toolbox-relevant-category");
        expect(ui.unrelatedParent.element.classes).toContain("shellblocks-toolbox-relevant-category-ancestor");
        const { replacement } = ui.rebuild();
        expect(ui.other.element.classes.size).toBe(0);
        expect(replacement.element.classes.size).toBe(1);
        level.toolboxGuidance.push({ entity: "command", commandId: "ls" });
        definitions = { ...definitions, commands: definitions.commands.filter((command) => command.id !== "ls") };
        ui.notify(); controller.refresh(); ui.notify();
        expect(diagnose).toHaveBeenCalledOnce();
        expect(diagnose).toHaveBeenCalledWith(expect.stringContaining('"command","ls"'));
        expect(ui.blocks[3].element.classes.size).toBe(1);
        level = { id: "none", title: "None", toolboxGuidance: [] };
        select.dispatchEvent(new Event("change"));
        expect(ui.blocks.every((block) => block.element.classes.size === 0)).toBe(true);
        level = undefined;
        controller.refresh();
        controller.dispose();
        expect(ui.unsubscribe).toHaveBeenCalledOnce();
        level = { id: "first", title: "First", toolboxGuidance: [{ entity: "command", commandId: "grep" }] };
        select.dispatchEvent(new Event("change"));
        expect(ui.blocks.every((block) => block.element.classes.size === 0)).toBe(true);
    });
});
