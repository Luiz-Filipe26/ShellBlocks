import * as Blockly from "blockly";
import { afterEach, describe, expect, it, vi } from "vitest";
import rawDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { createHeadlessWorkspace } from "../helpers/blockly";
import { OverlayToolbox } from "@/core/shellblocks/workspace/overlayToolbox";
import { ToolboxOptionDropdown } from "@/core/shellblocks/ui/toolboxOptionDropdown";

class Label {
    textContent = "";
    title = "";
    classes = new Set<string>();
    classList = { toggle: (name: string, active: boolean) => { if (active) this.classes.add(name); else this.classes.delete(name); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("flags relevantes no dropdown", () => {
    it("apresenta múltiplas flags sem abrir dropdown nem alterar valor ou serialização", () => {
        vi.stubGlobal("HTMLElement", Label);
        vi.stubGlobal("document", { createElement: () => new Label() });
        const workspace = createHeadlessWorkspace(parseCliDefinitions(rawDefinitions).definitions);
        try {
            const block = workspace.newBlock("option:ls");
            block.isInFlyout = true;
            const field = block.getField("FLAG") as ToolboxOptionDropdown;
            field.setValue("-a");
            const state = Blockly.serialization.blocks.save(block);
            const open = vi.fn();
            Object.assign(field, { showEditor_: open });
            field.setRelevantFlags(new Set(["-l", "-h"]));
            const options = field.getOptions(false).filter((option): option is [HTMLElement, string] => option !== "separator" && option[0] instanceof Label);
            expect(options.filter(([label]) => (label as unknown as Label).classes.size > 0).map(([, flag]) => flag)).toEqual(["-l", "-h"]);
            expect(field.getValue()).toBe("-a");
            expect(Blockly.serialization.blocks.save(block)).toEqual(state);
            expect(open).not.toHaveBeenCalled();
            // Existing open labels update when relevance changes or disappears.
            field.setRelevantFlags(new Set(["-a"]));
            expect(options.filter(([label]) => (label as unknown as Label).classes.size > 0).map(([, flag]) => flag)).toEqual(["-a"]);
            field.setRelevantFlags(new Set());
            expect(options.every(([label]) => (label as unknown as Label).classes.size === 0)).toBe(true);
            expect(field.getValue()).toBe("-a");
        } finally { workspace.dispose(); }
    });
    it("recupera o contexto somente quando Blockly confirma abertura do campo", () => {
        class Dropdown extends ToolboxOptionDropdown {
            pointerDown(event: PointerEvent) { this.onMouseDown_(event); }
            open() { this.showEditor_(); }
        }
        const toolbox = new OverlayToolbox({ options: new Blockly.Options({}), addChangeListener: vi.fn() } as unknown as Blockly.WorkspaceSvg);
        vi.spyOn(toolbox, "getSelectedItem").mockReturnValue({ getId: () => "selected" } as Blockly.ISelectableToolboxItem);
        vi.spyOn(toolbox, "getFlyout").mockReturnValue({ isVisible: () => true } as Blockly.IFlyout);
        const restore = vi.spyOn(toolbox, "restoreFlyoutSelection").mockImplementation(() => {});
        const setStartField = vi.fn();
        const workspace = Object.assign(Object.create(Blockly.WorkspaceSvg.prototype), {
            targetWorkspace: { getToolbox: () => toolbox }, getGesture: () => ({ setStartField }),
        });
        const source = { id: "preview", workspace, isInFlyout: true, isDeadOrDying: () => false } as Blockly.Block;
        const field = new Dropdown([["A", "a"], ["B", "b"]], () => undefined);
        field.setSourceBlock(source);
        const open = vi.spyOn(Blockly.FieldDropdown.prototype as unknown as { showEditor_: () => void }, "showEditor_").mockImplementation(() => {});
        expect(field.isClickableInFlyout()).toBe(true);
        field.pointerDown({} as PointerEvent);
        expect(setStartField).toHaveBeenCalledWith(field);
        expect(restore).not.toHaveBeenCalled();
        field.open();
        expect(restore).toHaveBeenCalledExactlyOnceWith({ toolbox, itemId: "selected", visible: true });
        expect(open).toHaveBeenCalledOnce();
        field.open();
        expect(restore).toHaveBeenCalledOnce();
        field.pointerDown({} as PointerEvent);
        field.dispose();
        field.open();
        expect(restore).toHaveBeenCalledOnce();
    });
    it("preserva os labels normais e valores no workspace fora da flyout", () => {
        const workspace = createHeadlessWorkspace(parseCliDefinitions(rawDefinitions).definitions);
        try {
            const block = workspace.newBlock("option:ls");
            const field = block.getField("FLAG") as ToolboxOptionDropdown;
            field.setRelevantFlags(new Set(["-l"]));
            const options = field.getOptions(false);
            expect(options.every((option) => option !== "separator" && typeof option[0] === "string")).toBe(true);
            expect(options.find((option) => option !== "separator" && option[1] === "-l")).toBeDefined();
        } finally { workspace.dispose(); }
    });
});
