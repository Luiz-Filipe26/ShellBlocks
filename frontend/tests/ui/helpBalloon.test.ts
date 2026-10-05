import { afterEach, expect, it, vi } from "vitest";
import { showHelpBalloon } from "@/core/shellblocks/ui/helpBalloon";
class Surface extends EventTarget {
    style: Record<string, string> = {}; innerHTML = ""; className = "";
    remove = vi.fn(); contains() { return false; }
    getBoundingClientRect() { return { width: Math.min(320, Number.parseFloat(this.style.maxWidth)), height: Math.min(600, Number.parseFloat(this.style.maxHeight)) }; }
}
afterEach(() => vi.unstubAllGlobals());
it("chooses the available side, bounds tall content, and updates on viewport resize", () => {
    const balloon = new Surface(); const document = Object.assign(new EventTarget(), { body: { appendChild: vi.fn() }, createElement: () => balloon });
    const window = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0 });
    vi.stubGlobal("document", document); vi.stubGlobal("window", window); vi.stubGlobal("requestAnimationFrame", (f: () => void) => { f(); return 0; });
    const source = { getBoundingClientRect: () => ({ right: 380, left: 350, top: 800 }), contains: () => false };
    showHelpBalloon("help", source as unknown as SVGElement);
    expect(Number.parseFloat(balloon.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(balloon.style.left) + balloon.getBoundingClientRect().width).toBeLessThanOrEqual(382);
    expect(Number.parseFloat(balloon.style.top) + balloon.getBoundingClientRect().height).toBeLessThanOrEqual(836);
    expect(balloon.style.maxHeight).toBe("828px");
    window.innerHeight = 390; window.innerWidth = 844; window.dispatchEvent(new Event("resize"));
    expect(balloon.style.maxHeight).toBe("374px");
    expect(balloon.style.top).toBe("8px");
    expect(balloon.style.left).toBe("388px");
});
