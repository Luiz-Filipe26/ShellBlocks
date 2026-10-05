import { afterEach, expect, it, vi } from "vitest";
import { setupCompactLayout } from "@/pages/features/ui/compactLayout";
class Element extends EventTarget {
    inert = false; parentElement: Element | null = null;
    get nextSibling(): Element | null { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] ?? null; }
    attributes = new Map<string, string>(); children: Element[] = [];
    classList = { toggle: vi.fn(), remove: vi.fn() }; focus = vi.fn();
    setAttribute(k: string, v: string) { this.attributes.set(k, v); }
    appendChild(child: Element) { child.parentElement?.children.splice(child.parentElement.children.indexOf(child), 1); this.children.push(child); child.parentElement = this; }
    insertBefore(child: Element, next: Element | null) {
        if (next && next.parentElement !== this) throw new Error("anchor is outside parent");
        this.appendChild(child);
        if (next) { this.children.splice(this.children.indexOf(child), 1); this.children.splice(this.children.indexOf(next), 0, child); }
    }
}
afterEach(() => vi.unstubAllGlobals());
it("keeps one run control and mutually exclusive panels across layout changes", () => {
    const media = Object.assign(new EventTarget(), { matches: true });
    const document = Object.assign(new EventTarget(), { documentElement: new Element(), querySelector: () => null });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { matchMedia: () => media })); vi.stubGlobal("document", document);
    const elements = { instructions: new Element(), results: new Element(), controls: new Element(), instructionsButton: new Element(), resultsButton: new Element(), closeInstructions: new Element(), closeResults: new Element(), runButton: new Element(), advancedControls: new Element(), systemLog: new Element(), toolbar: new Element() };
    const original = new Element(); original.appendChild(elements.toolbar); original.appendChild(elements.advancedControls); original.appendChild(elements.systemLog);
    const actions = new Element(); actions.appendChild(elements.runButton);
    const controller = setupCompactLayout(elements as unknown as Parameters<typeof setupCompactLayout>[0]);
    expect(elements.runButton.parentElement).toBe(elements.controls);
    expect(elements.instructions.inert).toBe(true); expect(elements.results.inert).toBe(true);
    elements.instructionsButton.dispatchEvent(new Event("click")); expect(elements.instructions.inert).toBe(false);
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
