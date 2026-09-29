import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";
import { serializeWorkspaceToAST } from "@/core/shellblocks/serialization/serializer";
import { createBlock, connectInput, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

function serialize(workspace: Blockly.Workspace): string {
    const ast = serializeWorkspaceToAST(workspace);
    return generateShellScript(ast);
}

describe("Blockly → AST → Shell", () => {
    it("serializa comando com option argumentada vazia e operando", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const option = createBlock(workspace, BlockIDs.commandOptionBlockType(echo));
        const operand = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        option.setFieldValue("-r", BlockIDs.FIELDS.FLAG);
        option.setFieldValue("", BlockIDs.FIELDS.OPTION_ARG_VALUE);
        operand.setFieldValue("Olá mundo", BlockIDs.FIELDS.VALUE);
        connectInput(root, BlockIDs.INPUTS.STACK, command);
        connectInput(command, BlockIDs.INPUTS.OPTIONS, option);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, operand);

        expect(serialize(workspace)).toBe("echo -r '' 'Olá mundo'");
    });

    it("serializa pipe com grep recebendo stdin sem operando de arquivo", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const grep = definitions.commands[1];
        const pipe = definitions.operators[0];
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const pipeBlock = createBlock(workspace, BlockIDs.operatorBlockType(pipe));
        const source = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const sourceText = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        const receiver = createBlock(workspace, BlockIDs.commandBlockType(grep));
        const pattern = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[0]),
        );
        sourceText.setFieldValue("Ana", BlockIDs.FIELDS.VALUE);
        pattern.setFieldValue("Ana", BlockIDs.FIELDS.VALUE);
        connectInput(root, BlockIDs.INPUTS.STACK, pipeBlock);
        connectInput(pipeBlock, "A", source);
        connectInput(pipeBlock, "B", receiver);
        connectInput(source, BlockIDs.INPUTS.OPERANDS, sourceText);
        connectInput(receiver, BlockIDs.INPUTS.OPERANDS, pattern);

        expect(serialize(workspace)).toBe("echo Ana | grep Ana");
    });

    it("serializa operador com slot textual", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const redirect = definitions.operators[1];
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const operator = createBlock(
            workspace,
            BlockIDs.operatorBlockType(redirect),
        );
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const operand = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        operand.setFieldValue("resultado", BlockIDs.FIELDS.VALUE);
        operator.setFieldValue("saída final.txt", "B");
        connectInput(root, BlockIDs.INPUTS.STACK, operator);
        connectInput(operator, "A", command);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, operand);

        expect(serialize(workspace)).toBe(
            "echo resultado > 'saída final.txt'",
        );
    });

    it("serializa controle com slots conectados", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const controlDefinition = definitions.controls[0];
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const control = createBlock(
            workspace,
            BlockIDs.controlBlockType(controlDefinition),
        );
        const condition = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const action = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const conditionText = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        const actionText = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        conditionText.setFieldValue("condição", BlockIDs.FIELDS.VALUE);
        actionText.setFieldValue("ação", BlockIDs.FIELDS.VALUE);
        connectInput(root, BlockIDs.INPUTS.STACK, control);
        connectInput(control, "CONDITION", condition);
        connectInput(control, "DO", action);
        connectInput(condition, BlockIDs.INPUTS.OPERANDS, conditionText);
        connectInput(action, BlockIDs.INPUTS.OPERANDS, actionText);

        expect(serialize(workspace)).toBe(
            "if \n  echo 'condição' ; then\n  echo 'ação'\nfi",
        );
    });
});
