import * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import * as CLI from "../types/cli";
import * as BlockTraversal from "../helpers/blockTraversal";
import { showToast } from "../ui/toast";
import { LogLevel } from "../types/logger";
import { coreLog } from "../services/logging";

export function unplugDuplicatesFromList(
    blocks: Blockly.Block[],
    valueFn: (block: Blockly.Block) => string,
): void {
    const seen = new Set<string>();
    const workspace = BlockTraversal.getWorkspaceFromBlocks(blocks);

    for (const block of blocks) {
        const value = valueFn(block);
        if (seen.has(value)) {
            block.unplug(true);
            const message = `Opção "${value}" removida por duplicata`;
            if (workspace) {
                showToast(workspace, message, LogLevel.WARN);
                coreLog(workspace, message, LogLevel.WARN);
            }
            return;
        }
        seen.add(value);
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
        const foundBlocks = remainingBlocks.filter((block) =>
            group.includes(String(block.getFieldValue(BlockIDs.FIELDS.FLAG))),
        );

        if (foundBlocks.length <= 1) return;

        const keeper = foundBlocks[0];
        const intruder = foundBlocks[1];

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
    const blocksByType = new Map<string, Blockly.Block[]>();

    for (const block of operandBlocks) {
        const list = blocksByType.get(block.type) || [];
        list.push(block);
        blocksByType.set(block.type, list);
    }

    for (const operandDef of commandDefinition.operands) {
        const max = operandDef.cardinality.max;
        if (max === "unlimited") continue;

        const operandType = BlockIDs.commandOperandBlockType(
            commandDefinition,
            operandDef,
        );
        const blocksOfType = blocksByType.get(operandType);

        if (!blocksOfType || blocksOfType.length <= max) continue;

        blocksOfType.slice(max).forEach((block) => block.unplug(true));

        const message = `Limite de ${max} excedido para "${operandDef.label}".`;
        if (workspace) {
            showToast(workspace, message);
            coreLog(workspace, message, LogLevel.WARN);
        }
    }
}
