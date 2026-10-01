import type { SelectorDependencies } from "@/pages/features/session/levelLoader";

export class MemoryStorage {
    private readonly values = new Map<string, string>();
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    setItem(key: string, value: string): void { this.values.set(key, value); }
    removeItem(key: string): void { this.values.delete(key); }
}

// Minimal DOM boundary for selector tests; real events, no simulated Blockly API.
export class TestElement extends EventTarget {
    textContent = "";
    hidden = false;
    style = { width: "" };
    dataset: Record<string, string> = {};
    disabled = false;
    value = "";
    text = "";
    private html = "";
    get innerHTML(): string { return this.html; }
    set innerHTML(value: string) { this.html = value; }
    click(): void { this.dispatchEvent(new Event("click")); }
}

export class TestSelect extends TestElement {
    options: TestElement[] = [];
    override get innerHTML(): string { return ""; }
    override set innerHTML(_value: string) { this.options = []; }
    appendChild(option: TestElement): void { this.options.push(option); }
}

export function createSelectorDependencies(hasAssembly: () => boolean = () => false) {
    const elements = {
        levelSelect: new TestSelect(),
        levelSummaryText: new TestElement(),
        levelFullDetails: new TestElement(),
        progressBarFill: new TestElement(),
        progressLabel: new TestElement(),
        missionCompletion: new TestElement(),
        missionCompletionText: new TestElement(),
        continueBtn: new TestElement(),
        assemblyTransitionNotice: new TestElement(),
        hasWorkspaceAssembly: hasAssembly,
    };
    return { elements, deps: elements as unknown as SelectorDependencies };
}

export function selectContext(select: TestSelect, id: string): void {
    select.value = id;
    select.dispatchEvent(new Event("change"));
}
