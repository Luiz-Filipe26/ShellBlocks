import { TextValueField, valuePlaceholder, valueTooltip } from "../ui/textValueField";
import * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import * as BlockComponents from "../ui/blockComponents";
import * as CLI from "../types/cli";
import { setBlockTypeSemanticData } from "../serialization/metadataManager";
import {
    clearScalarValueErrors,
    validateScalarValue,
} from "../validation/valueValidators";
import { renderBlockWarnings } from "../validation/validationWarnings";

const OPTION_ARGUMENT_ERROR_SCOPE = "option-argument";

export function createOptionBlock(commandDefinition: CLI.CLICommand): void {
    if (commandDefinition.options.length === 0) {
        return;
    }

    const blockType = BlockIDs.commandOptionBlockType(commandDefinition);
    setBlockTypeSemanticData(blockType, {
        nodeType: "option",
        name: commandDefinition.shellCommand,
        bindings: [
            {
                key: "flag",
                source: "field",
                name: BlockIDs.FIELDS.FLAG,
            },
            {
                key: "value",
                source: "field",
                name: BlockIDs.FIELDS.OPTION_ARG_VALUE,
            },
        ],
    });

    Blockly.Blocks[blockType] = {
        init: function(this: Blockly.Block) {
            appendOptionInputs(commandDefinition, this);

            BlockComponents.setupParentIndicator(
                this,
                commandDefinition,
                `(opção de: ${commandDefinition.shellCommand})`,
            );

            const flagField = this.getField(BlockIDs.FIELDS.FLAG);
            if (!flagField) return;
            const currentFlag = flagField.getValue();
            updateOptionBlockShape(this, currentFlag, commandDefinition);
        },
    };
}

/**
 * Adiciona ou remove o input de argumento dinamicamente baseado na flag selecionada.
 */
function updateOptionBlockShape(
    block: Blockly.Block,
    selectedFlag: string,
    commandDefinition: CLI.CLICommand,
) {
    const previousFlag = block.getFieldValue(BlockIDs.FIELDS.FLAG);
    const previousArgument = commandDefinition.options.find(
        (option) => option.flag === previousFlag,
    )?.argument;
    if (previousArgument) {
        clearScalarValueErrors(
            block,
            previousArgument,
            OPTION_ARGUMENT_ERROR_SCOPE,
        );
    }

    const optionDefinition = commandDefinition.options.find(
        (option) => option.flag === selectedFlag,
    );

    const inputExists = block.getInput(BlockIDs.INPUTS.OPTION_ARG_INPUT);
    if (!optionDefinition || !optionDefinition.argument) {
        if (inputExists) block.removeInput(BlockIDs.INPUTS.OPTION_ARG_INPUT);
        renderBlockWarnings(block);
        return;
    }
    const argumentDefinition = optionDefinition.argument;

    if (inputExists) block.removeInput(BlockIDs.INPUTS.OPTION_ARG_INPUT);
    const input = block.appendDummyInput(BlockIDs.INPUTS.OPTION_ARG_INPUT);
    input.appendField(argumentDefinition.label + ":");
    const argField = new TextValueField(
        argumentDefinition.defaultValue,
        valuePlaceholder(argumentDefinition.label, argumentDefinition.type),
    );
    argField.setTooltip(valueTooltip(argumentDefinition.type, optionDefinition.description, argumentDefinition.allowEmptyValue, argumentDefinition.validations));

    const validate = (newValue: string): void => {
        validateScalarValue(
            newValue,
            argumentDefinition,
            block,
            OPTION_ARGUMENT_ERROR_SCOPE,
        );
        renderBlockWarnings(block);
    };
    argField.setValidator((newValue) => {
        validate(newValue);
        return newValue;
    });

    input.appendField(argField, BlockIDs.FIELDS.OPTION_ARG_VALUE);
    validate(argumentDefinition.defaultValue);
}

function appendOptionInputs(
    commandDefinition: CLI.CLICommand,
    block: Blockly.Block,
): void {
    const dropdown = buildOptionDropdown(commandDefinition, block);

    const helpIcon = BlockComponents.createGenericHelpIcon(() => {
        const flag = block.getFieldValue(BlockIDs.FIELDS.FLAG);
        const optionDefinition = commandDefinition.options.find(
            (opt) => opt.flag === flag,
        );
        return optionDefinition ? optionDefinition.description : "";
    });

    block
        .appendDummyInput(BlockIDs.FIELDS.MAIN_INPUT)
        .appendField(
            `(opção de: ${commandDefinition.shellCommand})`,
            BlockIDs.FIELDS.PARENT_INDICATOR,
        )
        .appendField(" ")
        .appendField(dropdown, BlockIDs.FIELDS.FLAG)
        .appendField(helpIcon);

    block.setPreviousStatement(
        true,
        BlockIDs.commandOptionStatementType(commandDefinition),
    );
    block.setNextStatement(
        true,
        BlockIDs.commandOptionStatementType(commandDefinition),
    );

    block.setColour(commandDefinition.optionColor ?? commandDefinition.color);
}

function buildOptionDropdown(
    commandDefinition: CLI.CLICommand,
    block: Blockly.Block,
): Blockly.FieldDropdown {
    const dropdownPairs = commandDefinition.options.map((option) => {
        const longFlag = option.longFlag ? ` | ${option.longFlag}` : "";
        const summary = option.description.split(".")[0].substring(0, 30);
        const argIndicator = option.argument ? " [...]" : "";
        const label = `${option.flag}${longFlag} (${summary})${argIndicator}`;
        return [label, option.flag] as [string, string];
    });

    const descriptionByFlag = new Map(
        commandDefinition.options.map((option) => [
            option.flag,
            option.description,
        ]),
    );

    const validator = function(this: Blockly.FieldDropdown, newValue: string) {
        this.getSourceBlock()?.setTooltip(
            descriptionByFlag.get(newValue) || "",
        );
        if (!block.isInFlyout)
            updateOptionBlockShape(block, newValue, commandDefinition);

        return newValue;
    };

    return new Blockly.FieldDropdown(dropdownPairs, validator);
}
