import * as Blockly from "blockly";
import { afterEach, expect, it, vi } from "vitest";
import { ToolboxOptionDropdown } from "@/core/shellblocks/ui/toolboxOptionDropdown";
import { ParentIndicatorField } from "@/core/shellblocks/ui/compactBlockPresentation";
import { OverlayFlyout, OverlayToolbox } from "@/core/shellblocks/workspace/overlayToolbox";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("compacts closed labels while preserving option identity and full menu descriptions", () => {
    const field = new ToolboxOptionDropdown([["-p | --parents (Create parent folders)", "-p"], ["-v | --verbose (Show output)", "-v"]], () => undefined);
    const indicator = new ParentIndicatorField("(operando de: mkdir)", "mkdir");
    const before = field.getText();
    vi.stubGlobal("document", { documentElement: {} });
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "1" }));
    expect(field.getText()).toBe("-p"); expect(field.getValue()).toBe("-p");
    expect(field.getOptions(false)[0]).toEqual(["-p | --parents (Create parent folders)", "-p"]);
    expect(indicator.getText()).toBe("(mkdir)");
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "0" }));
    expect(field.getText()).toBe(before); expect(indicator.getText()).toBe("(operando de: mkdir)");
});
it("positions the same compact flyout below categories and keeps native desktop geometry", () => {
    vi.stubGlobal("document", { documentElement: {} });
    let compact = "1"; vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => compact }));
    const toolbox = Object.assign(Object.create(OverlayToolbox.prototype), { HtmlDiv: { getBoundingClientRect: () => ({ height: 140 }) } });
    const flyout = Object.assign(Object.create(OverlayFlyout.prototype), {
        CORNER_RADIUS: 8,
        svgBackground_: { setAttribute: vi.fn() },
        getTargetWorkspace: () => ({ getToolbox: () => toolbox, getMetricsManager: () => ({ getViewMetrics: () => ({ height: 600 }) }) }),
        isVisible: () => true, getWidth: () => 260,
    });
    const native = vi.spyOn(Blockly.VerticalFlyout.prototype, "position").mockImplementation(() => {});
    const position = vi.fn(); Object.assign(flyout, { positionAt_: position });
    flyout.position(); expect(position).toHaveBeenCalledWith(260, 460, 0, 140);
    // Both rounded corners plus the vertical edge cover exactly the visible height.
    const background = flyout.svgBackground_.setAttribute;
    expect(background).toHaveBeenCalledWith("d", "M 0,0 h 252 a 8,8 0 0 1 8,8 v 444 a 8,8 0 0 1 -8,8 h -252 z");
    toolbox.HtmlDiv.getBoundingClientRect = () => ({ height: 90 });
    flyout.position(); expect(position).toHaveBeenLastCalledWith(260, 510, 0, 90);
    expect(background).toHaveBeenLastCalledWith("d", expect.stringContaining("v 494"));
    compact = "0"; position.mockClear(); background.mockClear();
    flyout.position(); expect(position).not.toHaveBeenCalled(); expect(background).not.toHaveBeenCalled(); expect(native).toHaveBeenCalledTimes(3);
});
