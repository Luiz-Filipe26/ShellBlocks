import * as Blockly from "blockly";

/** Component colours come from the page's palette; CLI block colours remain untouched. */
export function applyWorkspaceTheme(workspace: Pick<Blockly.WorkspaceSvg, "getTheme" | "setTheme">, mode: "light" | "dark"): void {
    const name = `shellblocks_${mode}`;
    if (workspace.getTheme().name === name) return;
    const palette = getComputedStyle(document.documentElement);
    const colour = (token: string): string => palette.getPropertyValue(token).trim();
    const theme = Blockly.Theme.defineTheme(name, {
        name,
        base: Blockly.Themes.Classic,
        componentStyles: {
            workspaceBackgroundColour: colour("--color-workspace"),
            toolboxBackgroundColour: colour("--color-toolbox"),
            toolboxForegroundColour: colour("--color-text-primary"),
            flyoutBackgroundColour: colour("--color-flyout"),
            flyoutForegroundColour: colour("--color-text-primary"),
            flyoutOpacity: 1,
            scrollbarColour: colour("--color-scrollbar"),
            scrollbarOpacity: 0.75,
            insertionMarkerColour: colour("--color-insertion-marker"),
            insertionMarkerOpacity: 0.4,
            cursorColour: colour("--color-focus"),
            markerColour: colour("--color-focus"),
            selectedGlowColour: colour("--color-block-selection"),
        },
    });
    workspace.setTheme(theme);
}
