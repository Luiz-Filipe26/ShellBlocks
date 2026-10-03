import { TextValueField, valuePlaceholder, valueTooltip } from "../ui/textValueField";
import * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import { validateScalarValue } from "../validation/valueValidators";
import * as BlockComponents from "../ui/blockComponents";
import * as CLI from "../types/cli";
import { setBlockTypeSemanticData } from "../serialization/metadataManager";
import { renderBlockWarnings } from "../validation/validationWarnings";

export function createOperandBlocks(commandDefinition: CLI.CLICommand): void {
    if (commandDefinition.operands.length === 0) return;

    for (const operandDef of commandDefinition.operands) {
        createSingleOperandBlock(commandDefinition, operandDef);
    }
}

function createSingleOperandBlock(
    commandDefinition: CLI.CLICommand,
    operandDefinition: CLI.CLIOperand,
): void {
    const blockType = BlockIDs.commandOperandBlockType(
        commandDefinition,
        operandDefinition,
    );
    setBlockTypeSemanticData(blockType, {
        nodeType: "operand",
        name: operandDefinition.id,
        bindings: [
            {
                key: "value",
                source: "field",
                name: BlockIDs.FIELDS.VALUE,
            },
        ],
    });

    Blockly.Blocks[blockType] = {
        init: function(this: Blockly.Block) {
            appendOperandInputs(commandDefinition, operandDefinition, this);

            BlockComponents.setupParentIndicator(
                this,
                commandDefinition,
                `(operando de: ${commandDefinition.shellCommand})`,
            );
        },
    };
}

function appendOperandInputs(
    commandDefinition: CLI.CLICommand,
    operandDefinition: CLI.CLIOperand,
    block: Blockly.Block,
): void {
    const field = buildOperandField(operandDefinition, block);

    block
        .appendDummyInput(BlockIDs.FIELDS.MAIN_INPUT)
        .appendField(
            `(operando de: ${commandDefinition.shellCommand})`,
            BlockIDs.FIELDS.PARENT_INDICATOR,
        )
        .appendField(`${operandDefinition.label}:`)
        .appendField(field, BlockIDs.FIELDS.VALUE);

    validateScalarValue(
        operandDefinition.defaultValue,
        operandDefinition,
        block,
        `operand:${operandDefinition.id}`,
    );
    renderBlockWarnings(block);

    block.setPreviousStatement(
        true,
        BlockIDs.commandOperandStatementType(commandDefinition),
    );
    block.setNextStatement(
        true,
        BlockIDs.commandOperandStatementType(commandDefinition),
    );
    block.setColour(operandDefinition.color ?? commandDefinition.color);
    block.setTooltip(operandDefinition.description);
}

function buildOperandField(
    operandDefinition: CLI.CLIOperand,
    block: Blockly.Block,
): Blockly.FieldTextInput {
    const textField = new TextValueField(
        operandDefinition.defaultValue,
        valuePlaceholder(operandDefinition.label, operandDefinition.type),
    );
    textField.setTooltip(valueTooltip(operandDefinition.type, operandDefinition.description, operandDefinition.allowEmptyValue, operandDefinition.validations));

    const validate = (newValue: string): void => {
        validateScalarValue(
            newValue,
            operandDefinition,
            block,
            `operand:${operandDefinition.id}`,
        );
        renderBlockWarnings(block);
    };

    textField.setValidator((newValue) => {
        validate(newValue);
        return newValue;
    });
    return textField;
}
