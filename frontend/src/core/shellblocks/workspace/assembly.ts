import * as Blockly from "blockly";
import { findScriptRoot } from "../blocks/systemBlocks";
import { ROOT_BLOCK_TYPE } from "../constants/blockIds";

export function hasWorkspaceAssembly(workspace: Blockly.Workspace): boolean {
    const root = findScriptRoot(workspace);
    return workspace.getAllBlocks(false).some((block) => block !== root);
}

/** Limpa somente a montagem, preservando a raiz e os demais estados da aplicação. */
export function clearWorkspaceAssembly(
    workspace: Blockly.Workspace,
    confirmDiscard: () => boolean,
): boolean {
    if (hasWorkspaceAssembly(workspace) && !confirmDiscard()) return false;

    const previousGroup = Blockly.Events.getGroup();
    Blockly.Events.setGroup(true);
    try {
        const root = findScriptRoot(workspace);
        for (const block of workspace.getAllBlocks(false)) {
            if (block !== root && !block.isDisposed()) block.dispose(false);
        }
        if (!root) {
            const newRoot = workspace.newBlock(ROOT_BLOCK_TYPE);
            if (newRoot instanceof Blockly.BlockSvg) {
                newRoot.initSvg();
                newRoot.render();
                newRoot.moveBy(50, 50);
            }
        }
    } finally {
        Blockly.Events.setGroup(previousGroup);
    }
    return true;
}
