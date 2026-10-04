import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";
import { serializeWorkspaceToAST } from "@/core/shellblocks/serialization/serializer";
import { createBlock, connectInput, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";
import officialDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { validateCardinality } from "@/core/shellblocks/validation/cardinalityValidator";
import { validateOperandSyntax } from "@/core/shellblocks/validation/syntaxValidator";
import { getErrors } from "@/core/shellblocks/validation/validationManager";

function serialize(workspace: Blockly.Workspace): string {
    const ast = serializeWorkspaceToAST(workspace);
    return generateShellScript(ast);
}

describe("Blockly → AST → Shell", () => {
    it.each([
        { level: 9, sourceId: "cat", value: "nomes.txt", pattern: "Ana", destination: "", expected: "cat nomes.txt | grep Ana" },
        { level: 18, sourceId: "curl", value: "http://127.0.0.1:8000/boletim.txt", pattern: "ERRO", destination: "incidentes.txt", expected: "curl 'http://127.0.0.1:8000/boletim.txt' | grep ERRO > incidentes.txt" },
        { level: 19, sourceId: "cat", value: "operacao.log", pattern: "ERRO", destination: "relatorios/erros.txt", expected: "cat operacao.log | grep ERRO > relatorios/erros.txt" },
    ])("permite a composição do nível $level com as definições oficiais, sem arquivo no grep", ({ sourceId, value, pattern, destination, expected }) => {
        const definitions = parseCliDefinitions(officialDefinitions).definitions;
        const sourceDefinition = definitions.commands.find((command) => command.id === sourceId)!;
        const grepDefinition = definitions.commands.find((command) => command.id === "grep")!;
        const pipeDefinition = definitions.operators.find((operator) => operator.id === "pipe")!;
        const redirectDefinition = definitions.operators.find((operator) => operator.id === "redirect_out")!;
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
            const pipe = createBlock(workspace, BlockIDs.operatorBlockType(pipeDefinition));
            const source = createBlock(workspace, BlockIDs.commandBlockType(sourceDefinition));
            const sourceOperand = createBlock(workspace, BlockIDs.commandOperandBlockType(sourceDefinition, sourceDefinition.operands[0]));
            const grep = createBlock(workspace, BlockIDs.commandBlockType(grepDefinition));
            const patternOperand = createBlock(workspace, BlockIDs.commandOperandBlockType(grepDefinition, grepDefinition.operands[0]));
            sourceOperand.setFieldValue(value, BlockIDs.FIELDS.VALUE);
            patternOperand.setFieldValue(pattern, BlockIDs.FIELDS.VALUE);
            connectInput(source, BlockIDs.INPUTS.OPERANDS, sourceOperand);
            connectInput(grep, BlockIDs.INPUTS.OPERANDS, patternOperand);
            connectInput(pipe, "A", source);
            connectInput(pipe, "B", grep);
            if (destination) {
                const redirect = createBlock(workspace, BlockIDs.operatorBlockType(redirectDefinition));
                redirect.setFieldValue(destination, "B");
                connectInput(redirect, "A", pipe);
                connectInput(root, BlockIDs.INPUTS.STACK, redirect);
            } else {
                connectInput(root, BlockIDs.INPUTS.STACK, pipe);
            }

            validateCardinality(grep, grepDefinition, [patternOperand]);
            validateOperandSyntax(grep, grepDefinition, [patternOperand]);
            expect(getErrors(grep)).toEqual([]);
            expect(getErrors(sourceOperand)).toEqual([]);
            expect(serialize(workspace)).toBe(expected);
        } finally {
            workspace.dispose();
        }
    });

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
