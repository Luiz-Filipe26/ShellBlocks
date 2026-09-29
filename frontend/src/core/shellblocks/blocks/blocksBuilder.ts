import { createCommandBlock } from "./commandBlocks";
import { createOptionBlock } from "./optionBlocks";
import { createOperandBlocks } from "./operandBlocks";
import * as CLI from "../types/cli";
import { createControlBlock } from "./controlBlocks";
import { createOperatorBlock } from "./operatorBlocks";
import { initSystemBlocks } from "./systemBlocks";
import { clearBlockSemanticDataRegistry } from "../serialization/metadataManager";

export function createBlocksFromCommandDefinition(
    commandDefinition: CLI.CLICommand,
): void {
    createCommandBlock(commandDefinition);
    createOptionBlock(commandDefinition);
    createOperandBlocks(commandDefinition);
}

export function registerBlockTypesFromDefinitions(
    cliDefinitions: CLI.CliDefinitions,
) {
    clearBlockSemanticDataRegistry();
    initSystemBlocks();

    for (const definition of cliDefinitions.commands) {
        createBlocksFromCommandDefinition(definition);
    }

    for (const controlBlock of cliDefinitions.controls) {
        createControlBlock(controlBlock);
    }

    for (const operatorBlock of cliDefinitions.operators) {
        createOperatorBlock(operatorBlock);
    }
}
