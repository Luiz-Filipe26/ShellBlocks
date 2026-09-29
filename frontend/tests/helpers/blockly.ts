import * as Blockly from "blockly";
import { registerBlockTypesFromDefinitions } from "@/core/shellblocks/blocks/blocksBuilder";
import type { CliDefinitions } from "@/core/shellblocks/types/cli";

export function createHeadlessWorkspace(
    definitions: CliDefinitions,
): Blockly.Workspace {
    registerBlockTypesFromDefinitions(definitions);
    return new Blockly.Workspace();
}

export function createBlock(
    workspace: Blockly.Workspace,
    type: string,
): Blockly.Block {
    return workspace.newBlock(type);
}

export function connectInput(
    parent: Blockly.Block,
    inputName: string,
    child: Blockly.Block,
): void {
    const inputConnection = parent.getInput(inputName)?.connection;
    if (!inputConnection || !child.previousConnection) {
        throw new Error(`Não foi possível conectar ${child.type} em ${inputName}.`);
    }
    inputConnection.connect(child.previousConnection);
}

export function connectNext(
    first: Blockly.Block,
    next: Blockly.Block,
): void {
    if (!first.nextConnection || !next.previousConnection) {
        throw new Error(`Não foi possível conectar ${first.type} a ${next.type}.`);
    }
    first.nextConnection.connect(next.previousConnection);
}
