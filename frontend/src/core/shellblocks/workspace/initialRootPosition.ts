/** Screen-space bounds keep placement independent of workspace zoom and scroll. */
export type PlacementBounds = Pick<DOMRectReadOnly, "left" | "top" | "right" | "bottom">;

const ROOT_GAP = 24;

export function initialRootPosition(
    area: PlacementBounds,
    root: { width: number; height: number },
    toolbox: PlacementBounds | null,
): { x: number; y: number } {
    const marginX = Math.min(ROOT_GAP, Math.max(0, (area.right - area.left - root.width) / 2));
    const marginY = Math.min(ROOT_GAP, Math.max(0, (area.bottom - area.top - root.height) / 2));
    const start = { x: area.left + marginX, y: area.top + marginY };
    if (!toolbox) return start;

    const right = { x: Math.max(start.x, toolbox.right + ROOT_GAP), y: start.y };
    const below = { x: start.x, y: Math.max(start.y, toolbox.bottom + ROOT_GAP) };
    const fits = (point: { x: number; y: number }) =>
        point.x + root.width <= area.right - marginX &&
        point.y + root.height <= area.bottom - marginY;
    if (fits(right)) return right;
    if (fits(below)) return below;

    // When no unobstructed region can contain the root, keep it within the
    // visible viewport rather than placing it past its bottom/right edge.
    return {
        x: Math.max(area.left, Math.min(right.x, area.right - root.width)),
        y: Math.max(area.top, Math.min(right.y, area.bottom - root.height)),
    };
}
