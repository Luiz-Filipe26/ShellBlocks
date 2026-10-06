import { describe, expect, it } from "vitest";
import { initialRootPosition, type PlacementBounds } from "@/core/shellblocks/workspace/initialRootPosition";

const root = { width: 120, height: 80 };
const treeAndHandle = { left: 0, top: 0, right: 270, bottom: 140 };
function expectContained(position: { x: number; y: number }, area: PlacementBounds) {
    expect(position.x).toBeGreaterThanOrEqual(area.left);
    expect(position.y).toBeGreaterThanOrEqual(area.top);
    expect(position.x + root.width).toBeLessThanOrEqual(area.right);
    expect(position.y + root.height).toBeLessThanOrEqual(area.bottom);
}

describe("initial root placement", () => {
    it("prefers the right of the tree and handle when the rendered root fits", () => {
        const area = { left: 0, top: 0, right: 800, bottom: 300 };
        const point = initialRootPosition(area, root, treeAndHandle);
        expect(point.x).toBeGreaterThan(treeAndHandle.right);
        expect(point.y).toBeLessThan(treeAndHandle.bottom);
        expectContained(point, area);
    });
    it("uses the region below when the root cannot fit on the right", () => {
        const area = { left: 0, top: 0, right: 380, bottom: 310 };
        const point = initialRootPosition(area, root, treeAndHandle);
        expect(point.y).toBeGreaterThan(treeAndHandle.bottom);
        expectContained(point, area);
    });
    it("reduces vertical margins to fit beside the tree above a bottom panel", () => {
        const area = { left: 0, top: 0, right: 800, bottom: root.height + 20 };
        const point = initialRootPosition(area, root, treeAndHandle);
        expect(point.x).toBeGreaterThan(treeAndHandle.right);
        expectContained(point, area);
    });
    it("uses actual root dimensions instead of viewport-specific thresholds", () => {
        const area = { left: 0, top: 0, right: 500, bottom: 400 };
        const small = initialRootPosition(area, root, treeAndHandle);
        const wide = initialRootPosition(area, { ...root, width: 250 }, treeAndHandle);
        expect(small.x).toBeGreaterThan(treeAndHandle.right);
        expect(wide.y).toBeGreaterThan(treeAndHandle.bottom);
    });
    it("supports page-space bounds with a nonzero origin", () => {
        const area = { left: 100, top: 200, right: 900, bottom: 500 };
        const obstruction = { left: 100, top: 200, right: 370, bottom: 340 };
        const point = initialRootPosition(area, root, obstruction);
        expect(point.x).toBeGreaterThan(obstruction.right);
        expectContained(point, area);
    });
    it("keeps the root in the visible area if neither unobstructed region fits", () => {
        const area = { left: 0, top: 0, right: 200, bottom: 120 };
        expectContained(initialRootPosition(area, root, treeAndHandle), area);
    });
    it("uses the available area when there is no toolbox", () => {
        const area = { left: 0, top: 0, right: 500, bottom: 300 };
        expectContained(initialRootPosition(area, root, null), area);
    });
});
