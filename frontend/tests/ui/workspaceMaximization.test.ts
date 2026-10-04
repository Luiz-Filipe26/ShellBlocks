import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupWorkspaceMaximization } from "@/pages/features/ui/workspaceMaximization";

vi.mock("blockly", () => ({ svgResize: vi.fn() }));

class Element extends EventTarget {
    hidden = false;
    inert = false;
    title = "";
    style = { visibility: "", overflow: "" };
    attributes = new Map<string, string>();
    classes = new Set<string>();
    classList = { toggle: (name: string, enabled: boolean) => {
        if (enabled) this.classes.add(name); else this.classes.delete(name);
    } };
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
}

let documentTarget: Element;
let observedResize: ResizeObserverCallback;
let disconnect: ReturnType<typeof vi.fn>;
let storageWrite: ReturnType<typeof vi.fn>;
const resize = vi.mocked(Blockly.svgResize);
const controllers: { dispose: () => void }[] = [];

beforeEach(() => {
    documentTarget = Object.assign(new Element(), { body: new Element() });
    vi.stubGlobal("document", documentTarget);
    disconnect = vi.fn();
    storageWrite = vi.fn();
    vi.stubGlobal("localStorage", { setItem: storageWrite });
    vi.stubGlobal("ResizeObserver", class {
        constructor(callback: ResizeObserverCallback) { observedResize = callback; }
        observe() {}
        disconnect = disconnect;
    });
    resize.mockReset().mockImplementation(() => {});
});
afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.dispose());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function setup() {
    const elements = {
        surface: new Element(), button: new Element(),
        maximizeIcon: new Element(), minimizeIcon: new Element(), outside: [new Element(), new Element()],
    };
    elements.outside[1].inert = true;
    elements.outside[1].style.visibility = "collapse";
    const workspace = { scrollX: -120, scrollY: 70, scale: .75, blocks: ["root", "command"], selected: "command", scroll: vi.fn() };
    workspace.scroll.mockImplementation((x: number, y: number) => { workspace.scrollX = x; workspace.scrollY = y; });
    const controller = setupWorkspaceMaximization(elements as unknown as Parameters<typeof setupWorkspaceMaximization>[0], workspace as unknown as Blockly.WorkspaceSvg);
    controllers.push(controller);
    return { ...elements, workspace, controller };
}

function escape() {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperty(event, "key", { value: "Escape" });
    documentTarget.dispatchEvent(event);
    return event;
}

describe("maximização interna do workspace", () => {
    it("maximiza e restaura pelo mesmo botão, preservando os estados externos", () => {
        const ui = setup();
        ui.button.dispatchEvent(new Event("click"));
        expect(ui.button.attributes.get("aria-pressed")).toBe("true");
        for (const element of ui.outside) {
            expect(element.style.visibility).toBe("hidden");
            expect(element.inert).toBe(true);
        }
        ui.button.dispatchEvent(new Event("click"));
        expect(ui.button.attributes.get("aria-pressed")).toBe("false");
        expect(ui.outside[0].style.visibility).toBe("");
        expect(ui.outside[0].inert).toBe(false);
        expect(ui.outside[1].style.visibility).toBe("collapse");
        expect(ui.outside[1].inert).toBe(true);
        expect(resize).toHaveBeenCalledTimes(2);
    });

    it("Escape restaura somente quando maximizado", () => {
        const ui = setup();
        expect(escape().defaultPrevented).toBe(false);
        expect(resize).not.toHaveBeenCalled();
        ui.button.dispatchEvent(new Event("click"));
        expect(escape().defaultPrevented).toBe(true);
        expect(ui.button.attributes.get("aria-pressed")).toBe("false");
    });

    it("alterna ícones, nome acessível e tooltip conforme a ação", () => {
        const ui = setup();
        expect(ui.maximizeIcon.hidden).toBe(false);
        expect(ui.minimizeIcon.hidden).toBe(true);
        expect(ui.button.attributes.get("aria-label")).toBe(ui.button.title);
        expect(ui.button.title).toMatch(/Maximizar/);
        ui.button.dispatchEvent(new Event("click"));
        expect(ui.maximizeIcon.hidden).toBe(true);
        expect(ui.minimizeIcon.hidden).toBe(false);
        expect(ui.button.attributes.get("aria-label")).toBe(ui.button.title);
        expect(ui.button.title).toMatch(/Restaurar/);
    });

    it("preserva workspace, blocos, seleção, zoom e scroll durante resize e restauração", () => {
        const ui = setup();
        const blocks = ui.workspace.blocks;
        resize.mockImplementation(() => { ui.workspace.scrollX = 0; ui.workspace.scrollY = 0; });
        ui.button.dispatchEvent(new Event("click"));
        observedResize([], {} as ResizeObserver);
        ui.button.dispatchEvent(new Event("click"));
        expect(ui.workspace.blocks).toBe(blocks);
        expect(ui.workspace.selected).toBe("command");
        expect(ui.workspace.scale).toBe(.75);
        expect(ui.workspace.scrollX).toBe(-120);
        expect(ui.workspace.scrollY).toBe(70);
        expect(resize).toHaveBeenCalledWith(ui.workspace);
    });

    it("não persiste e começa normal em uma nova inicialização", () => {
        const first = setup();
        first.button.dispatchEvent(new Event("click"));
        first.controller.dispose();
        const next = setup();
        expect(next.button.attributes.get("aria-pressed")).toBe("false");
        expect(next.maximizeIcon.hidden).toBe(false);
        expect(storageWrite).not.toHaveBeenCalled();
    });

    it("dispose restaura o layout, remove listeners e desconecta o observer", () => {
        const ui = setup();
        ui.button.dispatchEvent(new Event("click"));
        ui.controller.dispose();
        expect(disconnect).toHaveBeenCalledOnce();
        expect(ui.button.attributes.get("aria-pressed")).toBe("false");
        resize.mockClear();
        ui.button.dispatchEvent(new Event("click"));
        expect(escape().defaultPrevented).toBe(false);
        expect(resize).not.toHaveBeenCalled();
    });

    it("pointerdown preserva o foco do Blockly sem impedir ativação por click", () => {
        const ui = setup();
        const event = new Event("pointerdown", { cancelable: true });
        ui.button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(ui.button.attributes.get("aria-pressed")).toBe("false");
        ui.button.dispatchEvent(new Event("click"));
        expect(ui.button.attributes.get("aria-pressed")).toBe("true");
    });
});
