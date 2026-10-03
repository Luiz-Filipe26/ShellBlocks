import * as Blockly from "blockly";
import { getErrors } from "./validationManager";
import { ProblemIcon } from "../ui/problemIcon";

const observedWorkspaces = new WeakSet<Blockly.Workspace>();

export function getBlockProblemText(block: Blockly.Block): string {
    const messages = getErrors(block).map((error) => error.message);
    if (block.isCollapsed()) {
        // The following statement remains visible when this block is collapsed.
        const descendants = block.getChildren(false)
            .filter((child) => child !== block.getNextBlock())
            .flatMap((child) => child.getDescendants(false));
        const hiddenMessages = descendants.flatMap((child) => getErrors(child).map((error) => error.message));
        if (hiddenMessages.length) messages.push("Problemas no conteúdo recolhido:", ...hiddenMessages);
    }
    return messages.join("\n");
}

function updateProblemIcon(block: Blockly.Block): void {
    // Toolbox templates are not an executable assembly to diagnose.
    if (!(block instanceof Blockly.BlockSvg) || block.isInFlyout || block.isInsertionMarker()) return;
    const text = getBlockProblemText(block);
    if (!text) {
        block.removeIcon(ProblemIcon.TYPE);
        return;
    }
    const icon = block.getIcon(ProblemIcon.TYPE) ?? block.addIcon(new ProblemIcon(block));
    icon.setProblems(text);
}

export function renderBlockWarnings(block: Blockly.Block): void {
    const workspace = block.workspace;
    if (!observedWorkspaces.has(workspace)) {
        observedWorkspaces.add(workspace);
        workspace.addChangeListener((event) => {
            if (event.isUiEvent) return;
            if (event.type === Blockly.Events.BLOCK_MOVE || event.type === Blockly.Events.BLOCK_DELETE || event.type === Blockly.Events.FINISHED_LOADING ||
                (event instanceof Blockly.Events.BlockChange && event.element === "collapsed")) {
                workspace.getAllBlocks(false).forEach(updateProblemIcon);
            }
        });
    }
    updateProblemIcon(block);
    let parent = block.getSurroundParent();
    while (parent) {
        if (parent.isCollapsed()) updateProblemIcon(parent);
        parent = parent.getSurroundParent();
    }
}
