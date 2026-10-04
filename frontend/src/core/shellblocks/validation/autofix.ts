import * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import * as CLI from "../types/cli";
import * as BlockTraversal from "../helpers/blockTraversal";
import { showToast } from "../ui/toast";
import { LogLevel } from "../types/logger";
import { coreLog } from "../services/logging";
import { findDuplicateBlock, findExclusiveOptionConflict, getExcessOperands } from "./structuralConstraints";

export function unplugDuplicatesFromList(
    blocks: Blockly.Block[],
    valueFn: (block: Blockly.Block) => string,
): void {
    const workspace = BlockTraversal.getWorkspaceFromBlocks(blocks);
    const block = findDuplicateBlock(blocks, valueFn);
    if (!block) return;
    const value = valueFn(block);
    block.unplug(true);
    const message = `Opção "${value}" removida por duplicata`;
    if (workspace) {
        showToast(workspace, message, LogLevel.WARN);
        coreLog(workspace, message, LogLevel.WARN);
    }
}

export function unplugExclusiveOptionsFromCommand(
    blocks: Blockly.Block[],
    exclusiveGroups: string[][],
): void {
    if (!exclusiveGroups || exclusiveGroups.length === 0) return;

    const remainingBlocks = [...blocks];

    for (const group of exclusiveGroups) {
        resolveGroupConflicts(group, remainingBlocks);
    }
}

function resolveGroupConflicts(
    group: string[],
    remainingBlocks: Blockly.Block[],
): void {
    const workspace = BlockTraversal.getWorkspaceFromBlocks(remainingBlocks);

    while (true) {
        const conflict = findExclusiveOptionConflict(remainingBlocks, group);
        if (!conflict) return;
        const [keeper, intruder] = conflict;

        const keeperFlag = String(keeper.getFieldValue(BlockIDs.FIELDS.FLAG));
        const intruderFlag = String(intruder.getFieldValue(BlockIDs.FIELDS.FLAG));

        intruder.unplug(true);
        const idx = remainingBlocks.indexOf(intruder);
        if (idx !== -1) remainingBlocks.splice(idx, 1);

        const message = `Conflito: A opção "${intruderFlag}" não pode ser usada com "${keeperFlag}".`;
        if (workspace) {
            showToast(workspace, message);
            coreLog(workspace, message, LogLevel.WARN);
        }
    }
}

export function autoFixExcessOperands(
    operandBlocks: Blockly.Block[],
    commandDefinition: CLI.CLICommand,
): void {
    if (operandBlocks.length === 0) return;

    const workspace = BlockTraversal.getWorkspaceFromBlocks(operandBlocks);
    for (const { operand, blocks } of getExcessOperands(operandBlocks, commandDefinition)) {
        blocks.forEach((block) => block.unplug(true));
        const message = `Limite de ${operand.cardinality.max} excedido para "${operand.label}".`;
        if (workspace) {
            showToast(workspace, message);
            coreLog(workspace, message, LogLevel.WARN);
        }
    }
}
