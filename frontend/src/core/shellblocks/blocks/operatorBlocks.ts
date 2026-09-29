import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";
import { setBlockTypeSemanticData } from "../serialization/metadataManager";
import * as BlockComponents from "../ui/blockComponents";
import { validateOperatorIntegrity } from "../validation/cardinalityValidator";
import { renderBlockWarnings } from "../validation/validationWarnings";
import { addLocalChangeListener } from "../events/blockEventListeners";
import { validateScalarValue } from "../validation/valueValidators";
import type { SemanticOperatorSlot } from "../types/semanticData";

const operatorDefinitionByBlockType = new Map<string, CLI.CLIOperator>();

export function createOperatorBlock(operatorDefinition: CLI.CLIOperator): void {
    const blockType = BlockIDs.operatorBlockType(operatorDefinition);
    operatorDefinitionByBlockType.set(blockType, operatorDefinition);

    setBlockTypeSemanticData(blockType, {
        nodeType: "operator",
        name: operatorDefinition.id,
        bindings: operatorDefinition.slots.map((slot) => ({
            key: slot.name,
            source: slot.type === "value" ? "field" : "input",
            name: slot.name,
        })),
        definition: {
            operator: {
                slots: operatorDefinition.slots.map(createSemanticOperatorSlot),
            },
        },
    });

    Blockly.Blocks[blockType] = {
        init: function(this: Blockly.BlockSvg) {
            this.setInputsInline(true);

            appendOperatorHeader(operatorDefinition, this);
            appendOperatorSlots(operatorDefinition, this);
            setupOperatorConnections(operatorDefinition, this);
            setupOperatorValidation(operatorDefinition, this);
        },
    };
}

function createSemanticOperatorSlot(
    slot: CLI.CLIOperatorSlot,
): SemanticOperatorSlot {
    if (slot.symbol === undefined) return { name: slot.name };
    return {
        name: slot.name,
        symbol: slot.symbol,
        symbolPlacement: slot.symbolPlacement,
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
        const slots = operatorDefinition.slots
            .map((slot) => {
                if (slot.type === CLI.OperatorSlotType.STATEMENT) {
                    return `<li>Slot <strong>${slot.label || slot.name}</strong>: encaixe um comando ou outra composição.</li>`;
                }

                const position = slot.symbol
                    ? ` no campo junto de <code>${slot.symbol}</code>`
                    : " no campo de texto";
                return `<li>Valor <strong>${slot.label || slot.name}</strong>: digite o conteúdo${position}.</li>`;
            })
            .join("");

        return `
            <div class="help-content">
                <h3>Operador: ${operatorDefinition.label}</h3>
                <p>${operatorDefinition.description}</p>
                <p>Os comandos que o operador combina devem ser encaixados dentro dele:</p>
                <ul>${slots}</ul>
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
            input = block
                .appendStatementInput(slot.name)
                .setCheck(BlockIDs.commandStatementType());
        }

        if (slot.symbol && slot.symbolPlacement === "before") {
            input.appendField(slot.symbol);
            if (slot.label) input.appendField(slot.label);
        } else if (!slot.symbol && slot.label) {
            input.appendField(slot.label);
        }

        if (slot.type === "value") {
            const textField = new Blockly.FieldTextInput(slot.defaultValue);
            textField.setValidator((newValue) => {
                validateScalarValue(
                    newValue,
                    slot,
                    block,
                    `operator-slot:${slot.name}`,
                );
                renderBlockWarnings(block);
                return newValue;
            });
            input.appendField(textField, slot.name);
            validateScalarValue(
                slot.defaultValue,
                slot,
                block,
                `operator-slot:${slot.name}`,
            );
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
    const validate = (): void => {
        validateOperatorIntegrity(block, operatorDefinition);
        renderBlockWarnings(block);
    };
    addLocalChangeListener(block, validate);
    if (Blockly.Events.isEnabled()) validate();
}
