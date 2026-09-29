import { describe, expect, it } from "vitest";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import {
    autoFixExcessOperands,
    unplugDuplicatesFromList,
    unplugExclusiveOptionsFromCommand,
} from "@/core/shellblocks/validation/autofix";
import { createBlock, connectInput, connectNext, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

describe("correções automáticas", () => {
    it("mantém a primeira option duplicada e desconecta a seguinte", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const first = createBlock(workspace, BlockIDs.commandOptionBlockType(echo));
        const duplicate = createBlock(workspace, BlockIDs.commandOptionBlockType(echo));
        connectInput(command, BlockIDs.INPUTS.OPTIONS, first);
        connectNext(first, duplicate);

        unplugDuplicatesFromList([first, duplicate], (block) =>
            String(block.getFieldValue(BlockIDs.FIELDS.FLAG)),
        );

        expect(command.getInputTargetBlock(BlockIDs.INPUTS.OPTIONS)).toBe(first);
        expect(first.getParent()).toBe(command);
        expect(duplicate.getParent()).toBeNull();
    });

    it("preserva a primeira option de um grupo exclusivo", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const first = createBlock(workspace, BlockIDs.commandOptionBlockType(echo));
        const conflicting = createBlock(workspace, BlockIDs.commandOptionBlockType(echo));
        first.setFieldValue("-n", BlockIDs.FIELDS.FLAG);
        conflicting.setFieldValue("-r", BlockIDs.FIELDS.FLAG);
        connectInput(command, BlockIDs.INPUTS.OPTIONS, first);
        connectNext(first, conflicting);

        unplugExclusiveOptionsFromCommand(
            [first, conflicting],
            echo.exclusiveOptions,
        );

        expect(first.getParent()).toBe(command);
        expect(conflicting.getParent()).toBeNull();
    });

    it("mantém os operandos até o máximo e desconecta apenas o excesso", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const operandType = BlockIDs.commandOperandBlockType(echo, echo.operands[0]);
        const first = createBlock(workspace, operandType);
        const second = createBlock(workspace, operandType);
        const excess = createBlock(workspace, operandType);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, first);
        connectNext(first, second);
        connectNext(second, excess);

        autoFixExcessOperands([first, second, excess], echo);

        expect(first.getParent()).toBe(command);
        expect(second.getParent()).toBe(first);
        expect(excess.getParent()).toBeNull();
    });
});
