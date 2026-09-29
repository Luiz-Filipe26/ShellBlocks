import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";
import { clearError, setError } from "../validation/validationManager";
import * as BlockTraversal from "../helpers/blockTraversal";
import * as ValidationErrors from "../constants/validationErrors";
import { OperatorSlotType } from "../types/cli";
import { receivesImplicitInput } from "./implicitInput";

export function validateControlCardinality(
    block: Blockly.Block,
    controlDefinition: CLI.CLIControl,
): void {
    clearAllControlCardinalityErrors(block, controlDefinition);

    for (const slot of controlDefinition.slots) {
        if (!slot.obligatory) continue;

        const targetBlock = block.getInputTargetBlock(slot.name);
        const isEmpty =
            !targetBlock ||
            BlockTraversal.getBlocksList(targetBlock).length === 0;

        if (isEmpty) {
            setError(
                block,
                ValidationErrors.controlMissingSlotError(slot),
                `O campo "${(slot.label || slot.name).replace(":", "")}" é obrigatório.`,
            );
        }
    }
}

function clearAllControlCardinalityErrors(
    block: Blockly.Block,
    controlDefinition: CLI.CLIControl,
): void {
    controlDefinition.slots.forEach((slot) =>
        clearError(block, ValidationErrors.controlMissingSlotError(slot)),
    );
}

/**
 * Executa a validação de cardinalidade mínima do comando.
 */
export function validateCardinality(
    commandBlock: Blockly.Block,
    commandDefinition: CLI.CLICommand,
    operandBlocks: Blockly.Block[],
): void {
    clearAllOperandCardinalityErrors(commandBlock, commandDefinition);
    validateSpecificOperandsCardinality(
        commandBlock,
        commandDefinition,
        operandBlocks,
        receivesImplicitInput(commandBlock),
    );
}

function clearAllOperandCardinalityErrors(
    block: Blockly.Block,
    commandDefinition: CLI.CLICommand,
): void {
    commandDefinition.operands.forEach((operand) =>
        clearError(
            block,
            ValidationErrors.cardinalityMissingOperandError(operand),
        ),
    );
}

export function validateOperatorIntegrity(
    block: Blockly.Block,
    operatorDefinition: CLI.CLIOperator,
): void {
    for (const slot of operatorDefinition.slots) {
        const emptyError = ValidationErrors.operatorEmptySlotError(slot);
        const stackedError = ValidationErrors.operatorStackedSlotError(slot);

        clearError(block, emptyError);
        clearError(block, stackedError);

        if (
            slot.type === OperatorSlotType.STATEMENT &&
            isOperatorStatementSlotEmpty(block, slot)
        ) {
            setError(
                block,
                emptyError,
                `Conecte um comando ou outra composição no slot "${slot.label || slot.name}" deste operador.`,
            );
            continue;
        }

        if (
            slot.type === OperatorSlotType.STATEMENT &&
            isOperatorStatementSlotStacked(block, slot)
        ) {
            setError(
                block,
                stackedError,
                `Operadores aceitam apenas um comando por slot. Use um bloco de agrupamento ou subshell se precisar de sequência.`,
            );
        }
    }
}

function isOperatorStatementSlotEmpty(
    block: Blockly.Block,
    slot: CLI.CLIStatementOperatorSlot,
): boolean {
    const targetBlock = block.getInputTargetBlock(slot.name);
    return !targetBlock;
}

function isOperatorStatementSlotStacked(
    block: Blockly.Block,
    slot: CLI.CLIStatementOperatorSlot,
): boolean {
    const targetBlock = block.getInputTargetBlock(slot.name);
    return Boolean(targetBlock?.getNextBlock());
}

function validateSpecificOperandsCardinality(
    block: Blockly.Block,
    commandDefinition: CLI.CLICommand,
    operandBlocks: Blockly.Block[],
    hasImplicitInput: boolean,
): void {
    if (commandDefinition.operands.length === 0) return;

    const countsByType = new Map<string, number>();
    for (const child of operandBlocks) {
        const current = countsByType.get(child.type) || 0;
        countsByType.set(child.type, current + 1);
    }

    for (const operandDef of commandDefinition.operands) {
        const operandType = BlockIDs.commandOperandBlockType(
            commandDefinition,
            operandDef,
        );

        const count = countsByType.get(operandType) || 0;
        const min =
            hasImplicitInput && operandDef.optionalWithImplicitInput
                ? 0
                : operandDef.cardinality.min;

        const missing = Math.max(0, min - count);
        if (missing === 0) continue;

        setError(
            block,
            ValidationErrors.cardinalityMissingOperandError(operandDef),
            `Falta operando: ${operandDef.label} (precisa de ${missing}).`,
        );
    }
}
