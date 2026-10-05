import * as Blockly from "blockly";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlayToolbox, OverlayWorkspaceMetrics } from "@/core/shellblocks/workspace/overlayToolbox";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// A metrics-only workspace: no SVG or DOM required for this contract.
function metricsWorkspace(toolboxWidth = 250): Blockly.WorkspaceSvg {
    return {
        scale: 0.75, scrollX: -40, scrollY: 25,
        toolboxPosition: Blockly.utils.toolbox.Position.LEFT,
        getCachedParentSvgSize: () => new Blockly.utils.Size(800, 600),
        getToolbox: () => ({ getWidth: () => toolboxWidth, getHeight: () => 600 }),
    } as unknown as Blockly.WorkspaceSvg;
}

describe("toolbox sobreposta", () => {
    it("mantém o viewport e o scroll quando categorias alargam ou a toolbox é ocultada", () => {
        const views = [0, 120, 320].map((width) => {
            const workspace = metricsWorkspace(width);
            const metrics = new OverlayWorkspaceMetrics(workspace);
            const view = metrics.getViewMetrics();
            expect(workspace.scrollX).toBe(-40);
            expect(workspace.scrollY).toBe(25);
            expect(workspace.scale).toBe(.75);
            return view;
        });
        expect(views[0]).toEqual(views[1]);
        expect(views[1]).toEqual(views[2]);
    });

    it("não reserva espaço, mas preserva a largura real para posicionar o flyout", () => {
        const workspace = metricsWorkspace();
        const metrics = new OverlayWorkspaceMetrics(workspace);
        expect(metrics.getAbsoluteMetrics()).toEqual({ left: 0, top: 0 });
        expect(metrics.getViewMetrics()).toEqual({ width: 800, height: 600, left: 40, top: -25 });
        expect(metrics.getToolboxMetrics().width).toBe(250);
        expect(metrics.getViewMetrics(true)).toEqual({
            width: 800 / .75, height: 600 / .75, left: 40 / .75, top: -25 / .75,
        });
    });
});

class DragToolbox extends OverlayToolbox {
    readonly treeAttributes = new Map<string, string>();
    constructor(workspace: Blockly.WorkspaceSvg) {
        super(workspace);
        // Keep native ARIA updates real without requiring a rendered tree.
        this.contentsDiv_ = {
            setAttribute: (name: string, value: string) => this.treeAttributes.set(name, value),
        } as unknown as HTMLDivElement;
    }
    pointerDown(): void { this.captureFlyoutSelection(); }
    addItem(item: Blockly.ToolboxCategory): void { this.contents.set(item.getId(), item); }
}

function dragToolbox() {
    // Native DOM/focus teardown is outside this SVG-free lifecycle test.
    vi.spyOn(Blockly.Toolbox.prototype, "dispose").mockImplementation(() => {});
    const listeners = new Set<(event: Blockly.Events.Abstract) => void>();
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    let dragging = true;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.set(++nextFrame, callback);
        return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const workspace = {
        options: new Blockly.Options({}),
        addChangeListener: (listener: (event: Blockly.Events.Abstract) => void) => listeners.add(listener),
        removeChangeListener: (listener: (event: Blockly.Events.Abstract) => void) => listeners.delete(listener),
        isDragging: () => dragging,
        recordDragTargets: vi.fn(),
        getComponentManager: () => ({ removeComponent: vi.fn() }),
    } as unknown as Blockly.WorkspaceSvg;
    const toolbox = new DragToolbox(workspace);
    const source = new Blockly.Workspace();
    Blockly.Blocks.overlay_drag_test = { init() {} };
    Blockly.Events.disable();
    const block = source.newBlock("overlay_drag_test");
    Blockly.Events.enable();
    const start = () => {
        toolbox.createFlyoutBlock(() => block as Blockly.BlockSvg);
        fire(true);
    };
    const fire = (isStart: boolean, draggedBlock = block) => {
        const event = new Blockly.Events.BlockDrag(draggedBlock, isStart);
        Blockly.Events.disable();
        try { listeners.forEach((listener) => listener(event)); }
        finally { Blockly.Events.enable(); }
    };
    return {
        toolbox, source, block, frames, listeners, start, fire,
        stopGesture: () => { dragging = false; },
        frame: () => {
            const callbacks = [...frames.values()];
            frames.clear();
            Blockly.Events.disable();
            try { callbacks.forEach((callback) => callback(0)); }
            finally { Blockly.Events.enable(); }
        },
        dispose: () => { toolbox.dispose(); source.dispose(); delete Blockly.Blocks.overlay_drag_test; },
    };
}

describe("retração temporária durante drag da flyout", () => {
    it("oculta apenas a apresentação sem fechar, reselecionar ou reconstruir a toolbox", () => {
        const test = dragToolbox();
        const changes = [
            vi.spyOn(test.toolbox, "setExpanded"),
            vi.spyOn(test.toolbox, "setVisible"),
            vi.spyOn(test.toolbox, "setSelectedItem"),
            vi.spyOn(test.toolbox, "clearSelection"),
            vi.spyOn(test.toolbox, "refreshSelection"),
        ];
        try {
            test.toolbox.createFlyoutBlock(() => {
                // Blockly hides chaff and moves focus while creating the clone.
                test.toolbox.autoHide(false);
                test.toolbox.onTreeBlur(null);
                return test.block as Blockly.BlockSvg;
            });
            test.fire(true);
            test.toolbox.autoHide(false);
            test.toolbox.onTreeBlur(null);
            expect(test.toolbox.isTemporarilyRetracted()).toBe(true);
            test.fire(false);
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            changes.forEach((change) => expect(change).not.toHaveBeenCalled());
        } finally { test.dispose(); }
    });

    it("aguarda início confirmado, preserva o estado aberto e restaura após vários drags", () => {
        const test = dragToolbox();
        const autoHide = vi.spyOn(Blockly.Toolbox.prototype, "autoHide");
        try {
            for (let i = 0; i < 3; i++) {
                test.toolbox.createFlyoutBlock(() => {
                    test.toolbox.autoHide(false);
                    return test.block as Blockly.BlockSvg;
                });
                expect(autoHide).not.toHaveBeenCalled();
                expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
                test.fire(true);
                expect(test.toolbox.isTemporarilyRetracted()).toBe(true);
                expect(test.toolbox.isExpanded()).toBe(true);
                expect(test.toolbox.getClientRect()).toBeNull();
                test.fire(false);
                expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
                expect(test.toolbox.isExpanded()).toBe(true);
                expect(test.frames.size).toBe(0);
            }
            test.toolbox.autoHide(false);
            expect(autoHide).toHaveBeenCalledOnce();
        } finally { test.dispose(); }
    });

    it("ignora drags do workspace e mantém a toolbox manualmente recolhida", () => {
        const test = dragToolbox();
        try {
            test.toolbox.setExpanded(false);
            test.fire(true);
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            test.fire(false);
            expect(test.toolbox.isExpanded()).toBe(false);
        } finally { test.dispose(); }
    });

    it("restaura mesmo se o encerramento não entregar o evento de fim", () => {
        const test = dragToolbox();
        try {
            test.start();
            test.stopGesture();
            test.frame();
            test.frame();
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            expect(test.toolbox.isExpanded()).toBe(true);
            expect(test.frames.size).toBe(0);
        } finally { test.dispose(); }
    });

    it("não retrai para criação sem drag ou eventos atrasados de um gesto encerrado", () => {
        const test = dragToolbox();
        try {
            test.toolbox.createFlyoutBlock(() => test.block as Blockly.BlockSvg);
            test.stopGesture();
            test.fire(true);
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            test.frame();
            test.frame();
            expect(test.frames.size).toBe(0);
        } finally { test.dispose(); }
    });

    it("libera a proteção de auto-hide quando a criação falha", () => {
        const test = dragToolbox();
        const autoHide = vi.spyOn(Blockly.Toolbox.prototype, "autoHide");
        try {
            expect(() => test.toolbox.createFlyoutBlock(() => { throw new Error("creation failed"); })).toThrow();
            test.toolbox.autoHide(false);
            expect(autoHide).toHaveBeenCalledOnce();
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            expect(test.frames.size).toBe(0);
        } finally { test.dispose(); }
    });

    it("remove listener e recuperação pendente ao descartar durante o drag", () => {
        const test = dragToolbox();
        test.start();
        test.dispose();
        expect(test.listeners.size).toBe(0);
        expect(test.frames.size).toBe(0);
        expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
    });
});

function selectedFlyout(test: ReturnType<typeof dragToolbox>) {
    let visible = true;
    const flyout = {
        isVisible: () => visible,
        setVisible: vi.fn((value: boolean) => { visible = value; }),
    };
    vi.spyOn(test.toolbox, "getFlyout").mockReturnValue(flyout as unknown as Blockly.IFlyout);
    const item = new Blockly.ToolboxCategory({
        kind: "category", name: "cat", contents: [], id: "cat",
        categorystyle: "", colour: "", cssconfig: {}, hidden: "false",
    }, test.toolbox);
    test.toolbox.addItem(item);
    const setSelection = (selection: Blockly.IToolboxItem | null) => {
        Blockly.Events.disable();
        try { test.toolbox.setSelectedItem(selection); }
        finally { Blockly.Events.enable(); }
    };
    setSelection(item);
    return {
        item, flyout,
        loseSelection: () => { setSelection(null); visible = false; },
    };
}

describe("recuperação da seleção perdida no pointerdown da flyout", () => {
    it.each(["evento de fim", "recuperação sem evento de fim"])("recupera seleção e visibilidade sem repopular via %s", (ending) => {
        const test = dragToolbox();
        const { item, flyout, loseSelection } = selectedFlyout(test);
        try {
            test.toolbox.pointerDown();
            loseSelection();
            test.start();
            const nativeHooks = Blockly.Toolbox.prototype as unknown as {
                updateFlyout_(oldItem: Blockly.ISelectableToolboxItem | null, newItem: Blockly.ISelectableToolboxItem | null): void;
            };
            const updateFlyout = vi.spyOn(nativeHooks, "updateFlyout_");
            if (ending === "evento de fim") test.fire(false);
            else { test.stopGesture(); test.frame(); test.frame(); }
            expect(test.toolbox.getSelectedItem()).toBe(item);
            expect(test.toolbox.treeAttributes.get("aria-activedescendant")).toBe(item.getId());
            expect(flyout.isVisible()).toBe(true);
            expect(flyout.setVisible).toHaveBeenCalledExactlyOnceWith(true);
            expect(updateFlyout).not.toHaveBeenCalled();
            expect(test.toolbox.isExpanded()).toBe(true);
        } finally { test.dispose(); }
    });

    it("não reseleciona nem altera a flyout quando o navegador preserva o estado", () => {
        const test = dragToolbox();
        const { item, flyout } = selectedFlyout(test);
        const selection = vi.spyOn(test.toolbox, "setSelectedItem");
        try {
            test.toolbox.pointerDown();
            test.start();
            test.fire(false);
            expect(test.toolbox.getSelectedItem()).toBe(item);
            expect(selection).not.toHaveBeenCalled();
            expect(flyout.setVisible).not.toHaveBeenCalled();
        } finally { test.dispose(); }
    });

    it("não recupera uma candidatura sem drag confirmado", () => {
        const test = dragToolbox();
        const { flyout, loseSelection } = selectedFlyout(test);
        try {
            test.toolbox.pointerDown();
            loseSelection();
            test.toolbox.createFlyoutBlock(() => test.block as Blockly.BlockSvg);
            test.stopGesture();
            test.frame(); test.frame();
            expect(test.toolbox.getSelectedItem()).toBeNull();
            expect(flyout.isVisible()).toBe(false);
            expect(flyout.setVisible).not.toHaveBeenCalled();
        } finally { test.dispose(); }
    });

    it("recupera um drag rápido confirmado por eventos entregues após o gesto terminar", () => {
        const test = dragToolbox();
        const { item, flyout, loseSelection } = selectedFlyout(test);
        try {
            test.toolbox.pointerDown();
            loseSelection();
            test.toolbox.createFlyoutBlock(() => test.block as Blockly.BlockSvg);
            test.stopGesture();
            test.frame();
            test.fire(true);
            expect(test.toolbox.isTemporarilyRetracted()).toBe(false);
            test.fire(false);
            expect(test.toolbox.getSelectedItem()).toBe(item);
            expect(flyout.isVisible()).toBe(true);
            expect(test.frames.size).toBe(0);
        } finally { test.dispose(); }
    });

    it("descarta a captura sem recuperar seleção ao destruir a toolbox", () => {
        const test = dragToolbox();
        const { flyout, loseSelection } = selectedFlyout(test);
        test.toolbox.pointerDown();
        loseSelection();
        test.start();
        test.dispose();
        expect(flyout.setVisible).not.toHaveBeenCalled();
        expect(test.toolbox.getSelectedItem()).toBeNull();
    });
});

it("updates compact scroll hints from current tree geometry without retaining rebuild state", () => {
    vi.stubGlobal("document", { documentElement: {} });
    let compact = "1";
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => compact }));
    const test = dragToolbox();
    const attributes = new Set<string>();
    const tree = { scrollTop: 0, scrollHeight: 258, clientHeight: 140, getBoundingClientRect: () => ({ height: 140 }) };
    const handle = {
        classList: { toggle: vi.fn() },
        style: {}, setAttribute: vi.fn(), remove: vi.fn(),
        toggleAttribute: (name: string, enabled: boolean) => enabled ? attributes.add(name) : attributes.delete(name),
    };
    Object.assign(test.toolbox, { HtmlDiv: tree, handle });
    vi.spyOn(Blockly.Toolbox.prototype, "position").mockImplementation(() => {});
    vi.spyOn(test.toolbox, "getWidth").mockReturnValue(240);
    vi.spyOn(test.toolbox, "getFlyout").mockReturnValue(null);
    try {
        test.toolbox.position();
        expect(attributes).toEqual(new Set(["data-scroll-below"]));
        tree.scrollTop = 40; test.toolbox.position();
        expect(attributes).toEqual(new Set(["data-scroll-above", "data-scroll-below"]));
        tree.scrollTop = 118; test.toolbox.position();
        expect(attributes).toEqual(new Set(["data-scroll-above"]));
        // A rebuilt tree whose contents fit must clear both hints.
        tree.scrollTop = 0; tree.scrollHeight = 140; test.toolbox.position();
        expect(attributes.size).toBe(0);
        tree.scrollHeight = 258; compact = "0"; test.toolbox.position();
        expect(attributes.size).toBe(0);
        compact = "1"; test.toolbox.setExpanded(false);
        expect(attributes.size).toBe(0);
    } finally { test.dispose(); }
    expect(handle.remove).toHaveBeenCalledOnce();
    expect(test.listeners.size).toBe(0);
});
