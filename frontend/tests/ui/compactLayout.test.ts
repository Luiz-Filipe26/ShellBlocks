import { afterEach, expect, it, vi } from "vitest";
import { MemoryStorage } from "../helpers/navigation";
import { setupCompactLayout } from "@/pages/features/ui/compactLayout";
class Element extends EventTarget {
    inert = false; parentElement: Element | null = null;
    get nextSibling(): Element | null { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
    attributes = new Map<string, string>(); children: Element[] = [];
    classList = { toggle: vi.fn(), remove: vi.fn(), contains: () => false }; focus = vi.fn();
    bounds = { left: 0, top: 0, right: 600, bottom: 400 };
    getBoundingClientRect() { return this.bounds; }
    setAttribute(k: string, v: string) { this.attributes.set(k, v); }
    appendChild(child: Element) { child.parentElement?.children.splice(child.parentElement.children.indexOf(child), 1); this.children.push(child); child.parentElement = this; }
    insertBefore(child: Element, next: Element | null) {
        if (next && next.parentElement !== this) throw new Error("anchor is outside parent");
        this.appendChild(child);
        if (next) { this.children.splice(this.children.indexOf(child), 1); this.children.splice(this.children.indexOf(next), 0, child); }
    }
}
const controllers: ReturnType<typeof setupCompactLayout>[] = [];
afterEach(() => {
    controllers.splice(0).forEach(controller => controller.dispose());
    vi.unstubAllGlobals();
});

function compactFixture(matches: boolean, storage = new MemoryStorage()) {
    const media = Object.assign(new EventTarget(), { matches });
    const document = Object.assign(new EventTarget(), { documentElement: new Element(), querySelector: () => null });
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", Object.assign(new EventTarget(), { matchMedia: () => media, innerWidth: 600, innerHeight: 400 }));
    vi.stubGlobal("document", document);
    const elements = { instructions: new Element(), results: new Element(), controls: new Element(), instructionsButton: new Element(), resultsButton: new Element(), closeInstructions: new Element(), closeResults: new Element(), runButton: new Element(), advancedControls: new Element(), systemLog: new Element(), toolbar: new Element() };
    const original = new Element(); original.appendChild(elements.toolbar); original.appendChild(elements.advancedControls); original.appendChild(elements.systemLog);
    const actions = new Element(); actions.appendChild(elements.runButton);
    const controller = setupCompactLayout(elements as unknown as Parameters<typeof setupCompactLayout>[0]);
    controllers.push(controller);
    const changeLayout = (compact: boolean) => {
        media.matches = compact;
        media.dispatchEvent(new Event("change"));
    };
    return { elements, storage, document, original, actions, changeLayout, controller };
}

const PANEL_KEY = "shellblocks_compact_bottom_panel";

it.each(["instructions", "result", "closed"])("run explicitly selects result from %s, overriding storage", (previous) => {
    const { elements, storage, changeLayout } = compactFixture(true);
    if (previous === "result") elements.resultsButton.dispatchEvent(new Event("click"));
    if (previous === "closed") elements.closeInstructions.dispatchEvent(new Event("click"));
    storage.setItem(PANEL_KEY, "instructions");
    elements.runButton.dispatchEvent(new Event("click"));
    expect(elements.results.inert).toBe(false);
    expect(elements.instructions.inert).toBe(true);
    expect(storage.getItem(PANEL_KEY)).toBe("result");
    elements.runButton.dispatchEvent(new Event("click"));
    expect(elements.results.inert).toBe(false);
    changeLayout(false); changeLayout(true);
    expect(elements.results.inert).toBe(false);
});

it.each(["instructions", "result", "closed"])("continuation explicitly selects instructions from %s, overriding storage", (previous) => {
    const { elements, storage, changeLayout, controller } = compactFixture(true);
    if (previous === "result") elements.resultsButton.dispatchEvent(new Event("click"));
    if (previous === "closed") elements.closeInstructions.dispatchEvent(new Event("click"));
    storage.setItem(PANEL_KEY, "result");
    controller.showInstructions();
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(true);
    expect(storage.getItem(PANEL_KEY)).toBe("instructions");
    controller.showInstructions();
    expect(elements.instructions.inert).toBe(false);
    changeLayout(false); changeLayout(true);
    expect(elements.instructions.inert).toBe(false);
});

it("run and continuation leave desktop UI and compact preference unchanged", () => {
    const storage = new MemoryStorage(); storage.setItem(PANEL_KEY, "result");
    const { elements, controller, original, actions } = compactFixture(false, storage);
    const render = vi.spyOn(elements.instructionsButton, "setAttribute");
    elements.runButton.dispatchEvent(new Event("click"));
    controller.showInstructions();
    expect(render).not.toHaveBeenCalled();
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(false);
    expect(elements.instructionsButton.attributes.get("aria-expanded")).toBe("false");
    expect(elements.resultsButton.attributes.get("aria-expanded")).toBe("false");
    expect(storage.getItem(PANEL_KEY)).toBe("result");
    expect(elements.runButton.parentElement).toBe(actions);
    expect(original.children).toEqual([elements.toolbar, elements.advancedControls, elements.systemLog]);
});

it("dispose removes the run listener", () => {
    const { elements, storage, controller } = compactFixture(true);
    controller.dispose();
    elements.runButton.dispatchEvent(new Event("click"));
    expect(storage.getItem(PANEL_KEY)).toBeNull();
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(false);
});

it.each([true, false])("opens instructions by default on first compact entry (initial compact=%s)", (initialCompact) => {
    const { elements, storage, changeLayout } = compactFixture(initialCompact);
    if (!initialCompact) changeLayout(true);
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(true);
    expect(elements.instructionsButton.attributes.get("aria-expanded")).toBe("true");
    expect(storage.getItem(PANEL_KEY)).toBeNull();
});

it("persists each panel only when opened, retaining the last choice when closed", () => {
    const { elements, storage, document } = compactFixture(true);
    elements.resultsButton.dispatchEvent(new Event("click"));
    expect(storage.getItem(PANEL_KEY)).toBe("result");
    expect(elements.results.inert).toBe(false);
    expect(elements.instructions.inert).toBe(true);
    elements.closeResults.dispatchEvent(new Event("click"));
    expect(storage.getItem(PANEL_KEY)).toBe("result");
    elements.instructionsButton.dispatchEvent(new Event("click"));
    expect(storage.getItem(PANEL_KEY)).toBe("instructions");
    expect(elements.instructions.inert).toBe(false);
    document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
    expect(elements.instructions.inert).toBe(true);
    expect(storage.getItem(PANEL_KEY)).toBe("instructions");
});

it("restores the persisted result on desktop to compact transitions, even after closing it", () => {
    const { elements, storage, changeLayout } = compactFixture(true);
    elements.resultsButton.dispatchEvent(new Event("click"));
    elements.closeResults.dispatchEvent(new Event("click"));
    changeLayout(false);
    changeLayout(true);
    expect(elements.results.inert).toBe(false);
    expect(elements.instructions.inert).toBe(true);
    changeLayout(false);
    storage.setItem(PANEL_KEY, "instructions");
    changeLayout(true);
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(true);
});

it.each([true, false])("restores result from storage on a new setup (initial compact=%s)", (initialCompact) => {
    const storage = new MemoryStorage(); storage.setItem(PANEL_KEY, "result");
    const { elements, changeLayout } = compactFixture(initialCompact, storage);
    if (!initialCompact) changeLayout(true);
    expect(elements.results.inert).toBe(false);
    expect(elements.instructions.inert).toBe(true);
    expect(elements.resultsButton.attributes.get("aria-expanded")).toBe("true");
});

it.each(["invalid", "null", "results", ""])("falls back to instructions for invalid storage: %s", (stored) => {
    const storage = new MemoryStorage(); storage.setItem(PANEL_KEY, stored);
    const { elements } = compactFixture(true, storage);
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(true);
});

it("preserves desktop panel state and original controls without writing a compact choice", () => {
    const storage = new MemoryStorage(); storage.setItem(PANEL_KEY, "result");
    const { elements, original, actions, changeLayout } = compactFixture(false, storage);
    elements.instructionsButton.dispatchEvent(new Event("click"));
    expect(storage.getItem(PANEL_KEY)).toBe("result");
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(false);
    expect(elements.runButton.parentElement).toBe(actions);
    expect(original.children).toEqual([elements.toolbar, elements.advancedControls, elements.systemLog]);
    changeLayout(true);
    changeLayout(false);
    expect(elements.instructions.inert).toBe(false);
    expect(elements.results.inert).toBe(false);
    expect(elements.instructionsButton.attributes.get("aria-expanded")).toBe("false");
    expect(elements.resultsButton.attributes.get("aria-expanded")).toBe("false");
    expect(elements.runButton.parentElement).toBe(actions);
    expect(original.children).toEqual([elements.toolbar, elements.advancedControls, elements.systemLog]);
    expect(storage.getItem(PANEL_KEY)).toBe("result");
});

it("keeps one run control and mutually exclusive panels across layout changes", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const media = Object.assign(new EventTarget(), { matches: true });
    const document = Object.assign(new EventTarget(), { documentElement: new Element(), querySelector: () => null });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { matchMedia: () => media, innerWidth: 600, innerHeight: 400 })); vi.stubGlobal("document", document);
    const elements = { instructions: new Element(), results: new Element(), controls: new Element(), instructionsButton: new Element(), resultsButton: new Element(), closeInstructions: new Element(), closeResults: new Element(), runButton: new Element(), advancedControls: new Element(), systemLog: new Element(), toolbar: new Element() };
    const original = new Element(); original.appendChild(elements.toolbar); original.appendChild(elements.advancedControls); original.appendChild(elements.systemLog);
    const actions = new Element(); actions.appendChild(elements.runButton);
    const controller = setupCompactLayout(elements as unknown as Parameters<typeof setupCompactLayout>[0]);
    expect(elements.runButton.parentElement).toBe(elements.controls);
    expect(elements.instructions.inert).toBe(false); expect(elements.results.inert).toBe(true);
    elements.resultsButton.dispatchEvent(new Event("click")); expect(elements.instructions.inert).toBe(true); expect(elements.results.inert).toBe(false);
    const escape = Object.assign(new Event("keydown", { cancelable: true }), { key: "Escape" });
    document.dispatchEvent(escape); expect(elements.results.inert).toBe(true);
    elements.resultsButton.dispatchEvent(new Event("click"));
    elements.closeResults.dispatchEvent(new Event("click")); expect(elements.results.inert).toBe(true); expect(elements.resultsButton.focus).toHaveBeenCalled();
    media.matches = false; media.dispatchEvent(new Event("change")); expect(elements.runButton.parentElement).toBe(actions); expect(elements.instructions.inert).toBe(false);
    media.matches = true; media.dispatchEvent(new Event("change")); expect(elements.runButton.parentElement).toBe(elements.controls);
    expect(original.children).toEqual([]);
    controller.dispose();
    expect(original.children).toEqual([elements.toolbar, elements.advancedControls, elements.systemLog]); expect(elements.runButton.parentElement).toBe(actions);
    elements.resultsButton.dispatchEvent(new Event("click")); expect(elements.results.inert).toBe(false);
});

it("reports visible space above the selected compact panel without changing panel state", () => {
    const { controller, elements, changeLayout } = compactFixture(true);
    const surface = new Element(); surface.bounds.top = 50;
    elements.instructions.bounds.top = 250;
    elements.results.bounds.top = 200;
    const getArea = () => controller.getVisibleWorkspaceArea(surface as unknown as HTMLElement);
    expect(getArea()).toEqual({ left: 0, top: 50, right: 600, bottom: 250 });
    elements.resultsButton.dispatchEvent(new Event("click"));
    expect(getArea().bottom).toBe(200);
    elements.closeResults.dispatchEvent(new Event("click"));
    expect(getArea().bottom).toBe(400);
    changeLayout(false);
    expect(getArea().bottom).toBe(400);
});
