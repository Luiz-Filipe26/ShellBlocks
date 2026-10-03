import * as BlockIDs from "../constants/blockIds";
import * as Blockly from "blockly";
import { buildCommandHelpHTML } from "../ui/helpBalloon";
import { renderBlockWarnings } from "../validation/validationWarnings";
import * as BlockComponents from "../ui/blockComponents";
import * as BlockTraversal from "../helpers/blockTraversal";
import * as CLI from "../types/cli";
import { setBlockTypeSemanticData } from "../serialization/metadataManager";
import {
    unplugExclusiveOptionsFromCommand,
    unplugDuplicatesFromList,
    autoFixExcessOperands,
} from "../validation/autofix";
import { validateCardinality } from "../validation/cardinalityValidator";
import { addLocalChangeListener } from "../events/blockEventListeners";
import { validateOperandSyntax } from "../validation/syntaxValidator";

export function createCommandBlock(commandDefinition: CLI.CLICommand): void {
    const blockType = BlockIDs.commandBlockType(commandDefinition);
    setBlockTypeSemanticData(blockType, {
        nodeType: "command",
        name: commandDefinition.shellCommand,
        bindings: [
            {
                key: "options",
                source: "input",
                name: BlockIDs.INPUTS.OPTIONS,
            },
            {
                key: "operands",
                source: "input",
                name: BlockIDs.INPUTS.OPERANDS,
            },
        ],
    });

    Blockly.Blocks[blockType] = {
        init: function(this: Blockly.BlockSvg) {
            appendCommandHeader(commandDefinition, this);
            appendCommandInputs(commandDefinition, this);
            setupCommandIntegrityPipeline(commandDefinition, this);
        },
    };
}

function appendCommandHeader(
    commandDefinition: CLI.CLICommand,
    commandBlock: Blockly.BlockSvg,
): void {
    const helpIcon = BlockComponents.createGenericHelpIcon(() =>
        buildCommandHelpHTML(commandDefinition),
    );

    commandBlock
        .appendDummyInput(BlockIDs.DUMMY_INPUTS.HEADER)
        .appendField(commandDefinition.label)
        .appendField(" ")
        .appendField(helpIcon);
}

function appendCommandInputs(
    commandDefinition: CLI.CLICommand,
    commandBlock: Blockly.BlockSvg,
): void {
    if (commandDefinition.options.length > 0) {
        commandBlock
            .appendStatementInput(BlockIDs.INPUTS.OPTIONS)
            .setCheck(BlockIDs.commandOptionStatementType(commandDefinition))
            .appendField("Opções:");
    }

    if (commandDefinition.operands.length > 0) {
        commandBlock
            .appendStatementInput(BlockIDs.INPUTS.OPERANDS)
            .setCheck(BlockIDs.commandOperandStatementType(commandDefinition))
            .appendField("Operandos:");
    }

    commandBlock.setPreviousStatement(true, BlockIDs.commandStatementType());
    commandBlock.setNextStatement(true, BlockIDs.commandStatementType());
    commandBlock.setColour(commandDefinition.color);
    commandBlock.setTooltip(commandDefinition.description);
}

function setupCommandIntegrityPipeline(
    commandDefinition: CLI.CLICommand,
    commandBlock: Blockly.BlockSvg,
): void {
    const validate = (): void => {
        let optionBlocks = BlockTraversal.getBlocksList(
            commandBlock.getInputTargetBlock(BlockIDs.INPUTS.OPTIONS),
            { type: BlockIDs.commandOptionBlockType(commandDefinition) },
        );

        let operandBlocks = BlockTraversal.getBlocksList(
            commandBlock.getInputTargetBlock(BlockIDs.INPUTS.OPERANDS),
        );

        unplugDuplicatesFromList(optionBlocks, (child) =>
            child.getFieldValue(BlockIDs.FIELDS.FLAG),
        );
        optionBlocks = optionBlocks.filter(
            (block) => block.getParent() !== null,
        );

        unplugExclusiveOptionsFromCommand(
            optionBlocks,
            commandDefinition.exclusiveOptions,
        );
        optionBlocks = optionBlocks.filter(
            (block) => block.getParent() !== null,
        );

        autoFixExcessOperands(operandBlocks, commandDefinition);
        operandBlocks = operandBlocks.filter(
            (block) => block.getParent() !== null,
        );

        validateCardinality(
            commandBlock,
            commandDefinition,
            operandBlocks,
        );

        validateOperandSyntax(commandBlock, commandDefinition, operandBlocks);

        renderBlockWarnings(commandBlock);
    };
    addLocalChangeListener(commandBlock, validate);
    if (Blockly.Events.isEnabled()) validate();
}
