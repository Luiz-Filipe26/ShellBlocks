import type * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import type * as CLI from "../types/cli";

export function findDuplicateBlock(
    blocks: readonly Blockly.Block[],
    valueFn: (block: Blockly.Block) => string,
    existingValues: Iterable<string> = [],
): Blockly.Block | undefined {
    const seen = new Set(existingValues);
    return blocks.find((block) => {
        const value = valueFn(block);
        if (seen.has(value)) return true;
        seen.add(value);
        return false;
    });
}

/** Checks only duplicates introduced by the incoming chain. */
export function wouldIntroduceDuplicate(
    existing: readonly Blockly.Block[],
    incoming: readonly Blockly.Block[],
    valueFn: (block: Blockly.Block) => string,
): boolean {
    return Boolean(findDuplicateBlock(incoming, valueFn, existing.map(valueFn)));
}

function getOptionsInExclusiveGroup(blocks: readonly Blockly.Block[], group: readonly string[]): Blockly.Block[] {
    return blocks.filter((block) => group.includes(String(block.getFieldValue(BlockIDs.FIELDS.FLAG))));
}

export function findExclusiveOptionConflict(
    blocks: readonly Blockly.Block[],
    group: readonly string[],
): readonly [Blockly.Block, Blockly.Block] | undefined {
    const matching = getOptionsInExclusiveGroup(blocks, group);
    return matching.length > 1 ? [matching[0], matching[1]] : undefined;
}

export function wouldViolateExclusiveOptions(
    existing: readonly Blockly.Block[],
    incoming: readonly Blockly.Block[],
    groups: readonly (readonly string[])[],
): boolean {
    return groups.some((group) => {
        const additions = getOptionsInExclusiveGroup(incoming, group);
        return additions.length > 0 && Boolean(findExclusiveOptionConflict([...existing, ...additions], group));
    });
}

export function getExcessOperands(
    blocks: readonly Blockly.Block[],
    command: CLI.CLICommand,
): { operand: CLI.CLIOperand; blocks: Blockly.Block[] }[] {
    const byType = new Map<string, Blockly.Block[]>();
    for (const block of blocks) {
        const list = byType.get(block.type) ?? [];
        list.push(block);
        byType.set(block.type, list);
    }
    return command.operands.flatMap((operand) => {
        if (operand.cardinality.max === "unlimited") return [];
        const excess = (byType.get(BlockIDs.commandOperandBlockType(command, operand)) ?? [])
            .slice(operand.cardinality.max);
        return excess.length ? [{ operand, blocks: excess }] : [];
    });
}

export function wouldExceedOperandCardinality(
    existing: readonly Blockly.Block[],
    incoming: readonly Blockly.Block[],
    command: CLI.CLICommand,
): boolean {
    const additions = new Set(incoming);
    return getExcessOperands([...existing, ...incoming], command)
        .some(({ blocks }) => blocks.some((block) => additions.has(block)));
}

// Operator statement slots represent one expression, rather than a script stack.
export const OPERATOR_STATEMENT_CAPACITY = 1;
