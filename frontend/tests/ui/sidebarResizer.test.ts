import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarResizer } from "@/pages/features/ui/SidebarResizer";
const layout = vi.hoisted(() => ({ compact: false, saved: null as string | null }));
vi.mock("@/pages/features/ui/compactLayout", () => ({ compactLayout: () => layout.compact }));
vi.mock("@/pages/features/session/persistenceManager", () => ({ getSidebarWidth: () => layout.saved, saveSidebarWidth: vi.fn() }));
let variables: Map<string, string>;
let gutter: EventTarget & { setPointerCapture: ReturnType<typeof vi.fn>; hasPointerCapture(id: number): boolean; releasePointerCapture: ReturnType<typeof vi.fn> };
let resizer: SidebarResizer;
function pointer(type: string, id = 1, x = 900, y = 500) {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, button: 0, clientX: x, clientY: y });
    gutter.dispatchEvent(event);
}
beforeEach(() => {
    layout.compact = false; layout.saved = null; variables = new Map();
    const capture = new Set<number>();
    gutter = Object.assign(new EventTarget(), { setPointerCapture: vi.fn((id: number) => capture.add(id)), hasPointerCapture: (id: number) => capture.has(id), releasePointerCapture: vi.fn((id: number) => capture.delete(id)) });
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", { body: { classList: { add: vi.fn(), remove: vi.fn() } }, documentElement: { style: { setProperty: (k: string, v: string) => variables.set(k, v) } } });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
    const panel = { getBoundingClientRect: () => ({ width: Number.parseFloat(variables.get("--sidebar-width") ?? "380"), height: 300 }), parentElement: {
        getBoundingClientRect: () => ({ width: 1400, height: 744 }), querySelector: () => ({ getBoundingClientRect: () => ({ width: 240 }) }),
    } };
    resizer = new SidebarResizer(gutter as unknown as HTMLElement, panel as unknown as HTMLElement);
});
afterEach(() => { resizer.stop(); vi.unstubAllGlobals(); });
it("resizes with a captured mouse or touch pointer using panel geometry", () => {
    resizer.start(); pointer("pointerdown"); pointer("pointermove", 1, 850);
    expect(gutter.setPointerCapture).toHaveBeenCalledWith(1);
    expect(variables.get("--sidebar-width")).toBe("430px"); pointer("pointerup");
    layout.compact = true; pointer("pointerdown", 2, 190, 500); pointer("pointermove", 2, 190, 450);
    expect(variables.get("--compact-results-height")).toBe("350px");
});
it("ignores other pointers and ends on cancellation or lost capture", () => {
    resizer.start(); pointer("pointerdown"); pointer("pointermove", 2, 800); expect(variables.size).toBe(0);
    pointer("pointercancel"); pointer("pointermove", 1, 800); expect(variables.size).toBe(0);
    pointer("pointerdown"); pointer("lostpointercapture"); pointer("pointermove", 1, 800); expect(variables.size).toBe(0);
});
it("bounds pointer resize and restored desktop widths", () => {
    layout.saved = "9999"; resizer.start(); expect(variables.get("--sidebar-width")).toBe("828px");
    pointer("pointerdown"); pointer("pointermove", 1, 9999); expect(variables.get("--sidebar-width")).toBe("250px");
});
it("does not restore desktop width into compact layout and removes listeners on stop", () => {
    layout.saved = "9999"; layout.compact = true; resizer.start(); expect(variables.size).toBe(0);
    pointer("pointerdown"); resizer.stop(); pointer("pointermove", 1, 700); pointer("pointerdown");
    expect(variables.size).toBe(0); expect(gutter.setPointerCapture).toHaveBeenCalledTimes(1);
});
