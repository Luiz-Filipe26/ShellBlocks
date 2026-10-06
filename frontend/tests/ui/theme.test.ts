// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Blockly from "blockly";
import { setupTheme } from "@/pages/features/ui/theme";
import { applyWorkspaceTheme } from "@/core/shellblocks/workspace/workspaceTheme";
import { createHeadlessWorkspace } from "../helpers/blockly";
import { validRawDefinitions } from "../helpers/cliFixtures";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import header from "@/pages/components/app-header.html?raw";
import { ROOT_BLOCK_TYPE, INPUTS } from "@/core/shellblocks/constants/blockIds";
import page from "@/pages/index.html?raw";

class SystemTheme extends EventTarget {
    matches = false;
    change(dark: boolean): void { this.matches = dark; this.dispatchEvent(new Event("change")); }
}
let system: SystemTheme;
let control: HTMLElement;
const controllers: { dispose(): void }[] = [];
const key = "shellblocks_theme_preference";

beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.className = "";
    document.body.innerHTML = header;
    control = document.getElementById("theme-control")!;
    system = new SystemTheme();
    vi.stubGlobal("matchMedia", vi.fn(() => system));
});
afterEach(() => {
    controllers.splice(0).forEach(c => c.dispose());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
function start(apply = vi.fn()) {
    const controller = setupTheme(control, apply);
    controllers.push(controller);
    return { controller, apply };
}
function choose(value: string): void { control.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click(); }
function selected(): string { return control.querySelector<HTMLInputElement>("input:checked")!.value; }

describe("theme preference", () => {
    it("defaults to system and follows the system without persisting it", () => {
        const { apply } = start();
        expect(selected()).toBe("system");
        expect(document.documentElement.dataset.theme).toBe("light");
        system.change(true);
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(document.documentElement.style.colorScheme).toBe("dark");
        expect(apply).toHaveBeenLastCalledWith("dark");
        expect(localStorage.getItem(key)).toBeNull();
        expect(matchMedia).toHaveBeenCalledOnce();
    });
    it.each(["light", "dark"])("restores explicit %s and ignores system changes", mode => {
        localStorage.setItem(key, mode);
        const { apply } = start();
        expect(selected()).toBe(mode);
        expect(document.documentElement.dataset.theme).toBe(mode);
        apply.mockClear();
        system.change(true);
        system.change(false);
        expect(apply).not.toHaveBeenCalled();
        expect(localStorage.getItem(key)).toBe(mode);
    });
    it("persists explicit choices and removes the override when returning to system", () => {
        const { apply } = start();
        choose("dark");
        expect(localStorage.getItem(key)).toBe("dark");
        expect(apply).toHaveBeenLastCalledWith("dark");
        choose("light");
        expect(localStorage.getItem(key)).toBe("light");
        system.change(true);
        choose("system");
        expect(localStorage.getItem(key)).toBeNull();
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(selected()).toBe("system");
    });
    it("normalizes invalid persisted preference to system", () => {
        localStorage.setItem(key, "sepia");
        system.matches = true;
        start();
        expect(selected()).toBe("system");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(localStorage.getItem(key)).toBeNull();
    });
    it("keeps selection usable without browser storage", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
        start();
        choose("dark");
        expect(document.documentElement.dataset.theme).toBe("dark");
        expect(selected()).toBe("dark");
    });
    it("uses the same three-state control in compact layout", () => {
        document.documentElement.classList.add("compact-layout");
        start();
        for (const mode of ["dark", "light", "system"]) {
            choose(mode);
            expect(selected()).toBe(mode);
        }
    });
    it("removes control and system listeners on dispose", () => {
        const remove = vi.spyOn(system, "removeEventListener");
        const { apply, controller } = start();
        controller.dispose();
        apply.mockClear();
        choose("dark");
        system.change(true);
        expect(apply).not.toHaveBeenCalled();
        expect(localStorage.getItem(key)).toBeNull();
        expect(remove).toHaveBeenCalledOnce();
    });
});

describe("early theme bootstrap", () => {
    it.each([
        { stored: null, system: false, expected: "light" },
        { stored: null, system: true, expected: "dark" },
        { stored: "light", system: true, expected: "light" },
        { stored: "dark", system: false, expected: "dark" },
        { stored: "invalid", system: true, expected: "dark" },
    ])("resolves $stored with system=$system before page modules", ({ stored, system: dark, expected }) => {
        if (stored) localStorage.setItem(key, stored);
        system.matches = dark;
        const parsed = new DOMParser().parseFromString(page, "text/html");
        const script = parsed.head.querySelector("script:not([type])")!;
        new Function(script.textContent!)();
        expect(document.documentElement.dataset.theme).toBe(expected);
        expect(document.documentElement.style.colorScheme).toBe(expected);
    });
});

it("applies real Blockly themes without replacing blocks, IDs, connections or workspace", () => {
    const workspace = createHeadlessWorkspace(parseCliDefinitions(validRawDefinitions()).definitions);
    const root = workspace.newBlock(ROOT_BLOCK_TYPE);
    const command = workspace.newBlock("command:echo");
    root.getInput(INPUTS.STACK)!.connection!.connect(command.previousConnection!);
    const state = Blockly.serialization.workspaces.save(workspace);
    let theme = Blockly.Themes.Classic;
    const setTheme = vi.fn((next: Blockly.Theme) => { theme = next; });
    // Use real semantic blocks and the public theme boundary; SVG rendering is checked in browser QA.
    const target = { getTheme: () => theme, setTheme };
    const apply = (mode: "light" | "dark") => applyWorkspaceTheme(target, mode);
    try {
        start(vi.fn(apply));
        choose("dark");
        expect(theme.name).toBe("shellblocks_dark");
        choose("light");
        expect(theme.name).toBe("shellblocks_light");
        expect(workspace.getBlockById(root.id)).toBe(root);
        expect(workspace.getBlockById(command.id)).toBe(command);
        expect(Blockly.serialization.workspaces.save(workspace)).toEqual(state);
        expect(setTheme).toHaveBeenCalledTimes(3);
    } finally { workspace.dispose(); }
});
