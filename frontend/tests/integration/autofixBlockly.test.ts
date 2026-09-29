import { describe, expect, it } from "vitest";
import * as BlockIDs from "../../src/core/shellblocks/constants/blockIds";
import { createBlock, connectInput, connectNext, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

function waitForBlocklyEvents(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("autofix acionado pelos eventos Blockly", () => {
    it("desconecta automaticamente uma option duplicada", async () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const first = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );
        const duplicate = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );
        connectInput(command, BlockIDs.INPUTS.OPTIONS, first);
        connectNext(first, duplicate);

        await waitForBlocklyEvents();

        expect(first.getParent()).toBe(command);
        expect(duplicate.getParent()).toBeNull();
    });

    it("desconecta automaticamente uma option mutuamente exclusiva", async () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const first = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );
        const conflicting = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );
        first.setFieldValue("-n", BlockIDs.FIELDS.FLAG);
        conflicting.setFieldValue("-r", BlockIDs.FIELDS.FLAG);
        connectInput(command, BlockIDs.INPUTS.OPTIONS, first);
        connectNext(first, conflicting);

        await waitForBlocklyEvents();

        expect(first.getParent()).toBe(command);
        expect(conflicting.getParent()).toBeNull();
    });

    it("desconecta automaticamente operandos acima do máximo", async () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const operandType = BlockIDs.commandOperandBlockType(
            echo,
            echo.operands[0],
        );
        const first = createBlock(workspace, operandType);
        const second = createBlock(workspace, operandType);
        const excess = createBlock(workspace, operandType);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, first);
        connectNext(first, second);
        connectNext(second, excess);

        await waitForBlocklyEvents();

        expect(first.getParent()).toBe(command);
        expect(second.getParent()).toBe(first);
        expect(excess.getParent()).toBeNull();
    });

    it("preserva uma composição válida sem reorganizar os blocos", async () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const operandType = BlockIDs.commandOperandBlockType(
            echo,
            echo.operands[0],
        );
        const first = createBlock(workspace, operandType);
        const second = createBlock(workspace, operandType);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, first);
        connectNext(first, second);

        await waitForBlocklyEvents();

        expect(command.getInputTargetBlock(BlockIDs.INPUTS.OPERANDS)).toBe(
            first,
        );
        expect(first.getNextBlock()).toBe(second);
        expect(second.getParent()).toBe(first);
    });
});
