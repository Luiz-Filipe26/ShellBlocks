import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";
import { setBlockSemanticData } from "../serialization/metadataManager";
import * as BlockComponents from "../ui/blockComponents";
import { validateOperatorIntegrity } from "../validation/cardinalityValidator";
import { renderBlockWarnings } from "../validation/validationWarnings";
import { addLocalChangeListener } from "../events/blockEventListeners";

const operatorDefinitionByBlockType = new Map<string, CLI.CLIOperator>();

export function createOperatorBlock(operatorDefinition: CLI.CLIOperator): void {
    operatorDefinitionByBlockType.set(
        BlockIDs.operatorBlockType(operatorDefinition),
        operatorDefinition,
    );

    Blockly.Blocks[BlockIDs.operatorBlockType(operatorDefinition)] = {
        init: function(this: Blockly.BlockSvg) {
            setBlockSemanticData(this, {
                nodeType: "operator",
                name: operatorDefinition.id,
                bindings: operatorDefinition.slots.map((slot) => ({
                    key: slot.name,
                    source: slot.type === "value" ? "field" : "input",
                    name: slot.name,
                })),

                definition: {
                    operator: {
                        slots: operatorDefinition.slots.map((slot) => ({
                            name: slot.name,
                            symbol: slot.symbol || null,
                            symbolPlacement:
                                (slot.symbolPlacement as "before" | "after") ||
                                null,
                        })),
                    },
                },
            });

            this.setInputsInline(true);

            appendOperatorHeader(operatorDefinition, this);
            appendOperatorSlots(operatorDefinition, this);
            setupOperatorConnections(operatorDefinition, this);
            setupOperatorValidation(operatorDefinition, this);
        },
    };
}

export function getOperatorDefinition(
    blockType: string,
): CLI.CLIOperator | undefined {
    return operatorDefinitionByBlockType.get(blockType);
}

function appendOperatorHeader(
    operatorDefinition: CLI.CLIOperator,
    block: Blockly.BlockSvg,
): void {
    const helpIcon = BlockComponents.createGenericHelpIcon(() => {
        return `
            <div class="help-content">
                <h3>Operador: ${operatorDefinition.label}</h3>
                <p>${operatorDefinition.description}</p>
            </div>
        `;
    });

    block
        .appendDummyInput()
        .appendField(operatorDefinition.label)
        .appendField(" ")
        .appendField(helpIcon);
}

function appendOperatorSlots(
    operatorDefinition: CLI.CLIOperator,
    block: Blockly.BlockSvg,
): void {
    operatorDefinition.slots.forEach((slot) => {
        let input: Blockly.Input;

        if (slot.type === "value") {
            input = block.appendDummyInput(slot.name);
        } else {
            input = block.appendStatementInput(slot.name).setCheck(slot.check);
        }

        if (slot.symbol && slot.symbolPlacement === "before") {
            input.appendField(slot.symbol);
            if (slot.label) input.appendField(slot.label);
        } else if (!slot.symbol && slot.label) {
            input.appendField(slot.label);
        }

        if (slot.type === "value") {
            const textField = new Blockly.FieldTextInput("");
            input.appendField(textField, slot.name);
        }

        if (slot.symbol && slot.symbolPlacement === "after") {
            if (slot.label) input.appendField(slot.label);
            input.appendField(slot.symbol);
        }
    });
}

function setupOperatorConnections(
    operatorDefinition: CLI.CLIOperator,
    block: Blockly.BlockSvg,
): void {
    block.setPreviousStatement(true, BlockIDs.commandStatementType());
    block.setNextStatement(true, BlockIDs.commandStatementType());
    block.setColour(operatorDefinition.color);
    block.setTooltip(operatorDefinition.description);
}

function setupOperatorValidation(
    operatorDefinition: CLI.CLIOperator,
    block: Blockly.BlockSvg,
): void {
    addLocalChangeListener(block, () => {
        validateOperatorIntegrity(block, operatorDefinition);
        renderBlockWarnings(block);
    });
}
