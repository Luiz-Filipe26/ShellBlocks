import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import { OverlayWorkspaceMetrics } from "@/core/shellblocks/workspace/overlayToolbox";

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
