import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticParentDragger } from "@/core/shellblocks/workspace/semanticParentDragger";
import { getValidSemanticParents } from "@/core/shellblocks/workspace/semanticParents";

vi.mock("@/core/shellblocks/workspace/semanticParents", () => ({ getValidSemanticParents: vi.fn() }));

// Exercise the addon lifecycle independently of native geometry and SVG markup.
function renderedBlock() {
    const classes = new Set<string>();
    const block = Object.assign(Object.create(Blockly.BlockSvg.prototype), {
        getRelativeToSurfaceXY: () => new Blockly.utils.Coordinate(0, 0),
        pathObject: { svgPath: { classList: {
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name),
        } } },
    }) as Blockly.BlockSvg;
    return { block, classes };
}

let dragger: SemanticParentDragger;
let parent: ReturnType<typeof renderedBlock>;
let domWindow: EventTarget;
let domDocument: EventTarget;
let cancel: ReturnType<typeof vi.fn>;
const pointer = (): PointerEvent => new Event("pointermove") as PointerEvent;

beforeEach(() => {
    domWindow = new EventTarget();
    domDocument = new EventTarget();
    vi.stubGlobal("window", domWindow);
    vi.stubGlobal("document", domDocument);
    vi.spyOn(Blockly.dragging.Dragger.prototype, "onDragStart").mockImplementation(() => {});
    vi.spyOn(Blockly.dragging.Dragger.prototype, "onDrag").mockImplementation(() => {});
    vi.spyOn(Blockly.dragging.Dragger.prototype, "onDragEnd").mockImplementation(() => {});
    parent = renderedBlock();
    vi.mocked(getValidSemanticParents).mockReturnValue([parent.block]);
    cancel = vi.fn(() => dragger.onDragEnd(pointer()));
    const workspace = { cancelCurrentGesture: cancel } as unknown as Blockly.WorkspaceSvg;
    dragger = new SemanticParentDragger(renderedBlock().block, workspace);
});
afterEach(() => {
    dragger.onDragEnd(pointer());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("lifecycle do contorno contextual", () => {
    it("não destaca antes do drag real e limpa no drop", () => {
        expect(parent.classes.size).toBe(0);
        dragger.onDragStart(pointer());
        expect(parent.classes.size).toBe(1);
        dragger.onDragEnd(pointer());
        expect(parent.classes.size).toBe(0);
    });

    it.each(["pointercancel", "Escape", "blur"])("limpa no cancelamento %s e remove listeners", (reason) => {
        dragger.onDragStart(pointer());
        const event = new Event(reason === "Escape" ? "keydown" : reason, { cancelable: true });
        if (reason === "Escape") Object.defineProperty(event, "key", { value: "Escape" });
        const target = reason === "blur" ? domWindow : domDocument;
        target.dispatchEvent(event);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(parent.classes.size).toBe(0);
        target.dispatchEvent(event);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("atualiza os candidatos durante drag sem deixar contornos anteriores", () => {
        dragger.onDragStart(pointer());
        const other = renderedBlock();
        vi.mocked(getValidSemanticParents).mockReturnValue([other.block]);
        dragger.onDrag(pointer(), new Blockly.utils.Coordinate(20, 30));
        expect(parent.classes.size).toBe(0);
        expect(other.classes.size).toBe(1);
        dragger.onDragEnd(pointer());
        expect(other.classes.size).toBe(0);
    });

    it("não acumula listeners em drags repetidos", () => {
        for (let index = 0; index < 3; index++) {
            dragger.onDragStart(pointer());
            dragger.onDragEnd(pointer());
        }
        domWindow.dispatchEvent(new Event("blur"));
        expect(cancel).not.toHaveBeenCalled();
    });

    it("limpa o efeito mesmo se o término nativo falhar", () => {
        dragger.onDragStart(pointer());
        vi.mocked(Blockly.dragging.Dragger.prototype.onDragEnd).mockImplementationOnce(() => { throw new Error("native end"); });
        expect(() => dragger.onDragEnd(pointer())).toThrow("native end");
        expect(parent.classes.size).toBe(0);
        domWindow.dispatchEvent(new Event("blur"));
        expect(cancel).not.toHaveBeenCalled();
    });

    it("limpa o efeito se a atualização nativa falhar", () => {
        dragger.onDragStart(pointer());
        vi.mocked(Blockly.dragging.Dragger.prototype.onDrag).mockImplementationOnce(() => { throw new Error("native drag"); });
        expect(() => dragger.onDrag(pointer(), new Blockly.utils.Coordinate(1, 1))).toThrow("native drag");
        expect(parent.classes.size).toBe(0);
    });
});
