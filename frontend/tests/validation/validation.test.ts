import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import * as BlockIDs from "../../src/core/shellblocks/constants/blockIds";
import { validateCardinality } from "../../src/core/shellblocks/validation/cardinalityValidator";
import { receivesImplicitInput } from "../../src/core/shellblocks/validation/implicitInput";
import { validateOperandSyntax } from "../../src/core/shellblocks/validation/syntaxValidator";
import { getErrors, setError } from "../../src/core/shellblocks/validation/validationManager";
import { validateScalarValue } from "../../src/core/shellblocks/validation/valueValidators";
import { createBlock, connectInput, connectNext, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

describe("validação semântica do workspace", () => {
    it("registra e limpa erros de valor vazio e regex", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const block = createBlock(workspace, BlockIDs.commandBlockType(definitions.commands[0]));
        const definition = {
            allowEmptyValue: false,
            validations: [
                { regex: "^[0-9]+$", errorMessage: "Use apenas dígitos." },
            ],
        };

        validateScalarValue("", definition, block, "test");
        expect(
            getErrors(block)
                .filter((error) => error.id.includes("test"))
                .map((error) => error.message),
        ).toEqual([
            "O valor não pode ser vazio.",
            "Use apenas dígitos.",
        ]);

        validateScalarValue("123", definition, block, "test");
        expect(getErrors(block).filter((error) => error.id.includes("test"))).toEqual([]);
    });

    it("permite vazio por default e mantém RegExp.test com match parcial", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const block = createBlock(workspace, BlockIDs.commandBlockType(definitions.commands[0]));

        validateScalarValue(
            "",
            { allowEmptyValue: true, validations: [] },
            block,
            "empty",
        );
        validateScalarValue(
            "prefix-12-suffix",
            {
                allowEmptyValue: true,
                validations: [{ regex: "[0-9]+", errorMessage: "sem número" }],
            },
            block,
            "partial",
        );

        expect(
            getErrors(block).filter(
                (error) =>
                    error.id.includes("empty") || error.id.includes("partial"),
            ),
        ).toEqual([]);
    });

    it("valida e limpa erros do argumento da option selecionada", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const option = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );
        option.setFieldValue("-r", BlockIDs.FIELDS.FLAG);

        expect(getErrors(option).map((error) => error.message)).toContain(
            "O valor não pode ser vazio.",
        );
        option.setFieldValue("abc", BlockIDs.FIELDS.OPTION_ARG_VALUE);
        expect(getErrors(option).map((error) => error.message)).toEqual([
            "Use um número.",
        ]);
        option.setFieldValue("2", BlockIDs.FIELDS.OPTION_ARG_VALUE);
        expect(getErrors(option)).toEqual([]);
    });

    it("remove erros do argumento anterior ao trocar de option e preserva erros independentes", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const option = createBlock(
            workspace,
            BlockIDs.commandOptionBlockType(echo),
        );

        option.setFieldValue("-r", BlockIDs.FIELDS.FLAG);
        option.setFieldValue("abc", BlockIDs.FIELDS.OPTION_ARG_VALUE);
        setError(option, "independent-error", "Erro independente.");
        expect(getErrors(option).map((error) => error.message)).toEqual([
            "Use um número.",
            "Erro independente.",
        ]);

        option.setFieldValue("-n", BlockIDs.FIELDS.FLAG);

        expect(option.getInput(BlockIDs.INPUTS.OPTION_ARG_INPUT)).toBeNull();
        expect(getErrors(option).map((error) => error.message)).toEqual([
            "Erro independente.",
        ]);
    });

    it("valida e limpa o destino textual de redirecionamento", () => {
        const definitions = validDefinitions();
        const redirect = definitions.operators[1];
        const workspace = createHeadlessWorkspace(definitions);
        const operator = createBlock(
            workspace,
            BlockIDs.operatorBlockType(redirect),
        );

        expect(getErrors(operator).map((error) => error.message)).toContain(
            "O valor não pode ser vazio.",
        );
        operator.setFieldValue("saida.txt", "B");
        expect(
            getErrors(operator).filter((error) =>
                error.id.startsWith("VALUE_"),
            ),
        ).toEqual([]);
    });

    it("aplica e remove a cardinalidade mínima conforme a causa é corrigida", () => {
        const definitions = validDefinitions();
        const grep = definitions.commands[1];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(grep));
        const pattern = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[0]),
        );
        const file = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[1]),
        );

        validateCardinality(command, grep, [pattern]);
        expect(getErrors(command).map((error) => error.id)).toContain(
            "CARDINALITY_MISSING_OPERAND_files",
        );

        validateCardinality(command, grep, [pattern, file]);
        expect(
            getErrors(command).filter((error) =>
                error.id.startsWith("CARDINALITY_"),
            ),
        ).toEqual([]);
    });

    it("dispensa somente o mínimo autorizado no receptor real de stdin", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const grep = definitions.commands[1];
        const pipe = definitions.operators[0];
        const workspace = createHeadlessWorkspace(definitions);
        const outerPipe = createBlock(workspace, BlockIDs.operatorBlockType(pipe));
        const innerPipe = createBlock(workspace, BlockIDs.operatorBlockType(pipe));
        const leftOuter = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const leftInner = createBlock(workspace, BlockIDs.commandBlockType(echo));
        const receiver = createBlock(workspace, BlockIDs.commandBlockType(grep));
        const pattern = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[0]),
        );
        connectInput(outerPipe, "A", leftOuter);
        connectInput(outerPipe, "B", innerPipe);
        connectInput(innerPipe, "A", leftInner);
        connectInput(innerPipe, "B", receiver);
        connectInput(receiver, BlockIDs.INPUTS.OPERANDS, pattern);

        expect(receivesImplicitInput(receiver)).toBe(true);
        expect(receivesImplicitInput(leftOuter)).toBe(false);
        expect(receivesImplicitInput(leftInner)).toBe(true);

        validateCardinality(receiver, grep, [pattern]);
        expect(
            getErrors(receiver).filter(
                (error) => error.id.startsWith("CARDINALITY_"),
            ),
        ).toEqual([]);
        validateCardinality(leftInner, echo, []);
        expect(getErrors(leftInner).map((error) => error.id)).toContain(
            "CARDINALITY_MISSING_OPERAND_text",
        );
    });

    it("não desativa operandSyntaxRules quando há entrada implícita", () => {
        const definitions = validDefinitions();
        const grep = definitions.commands[1];
        const pipe = definitions.operators[0];
        const workspace = createHeadlessWorkspace(definitions);
        const pipeBlock = createBlock(workspace, BlockIDs.operatorBlockType(pipe));
        const receiver = createBlock(workspace, BlockIDs.commandBlockType(grep));
        const source = createBlock(workspace, BlockIDs.commandBlockType(definitions.commands[0]));
        const file = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[1]),
        );
        const pattern = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[0]),
        );
        connectInput(pipeBlock, "A", source);
        connectInput(pipeBlock, "B", receiver);
        connectNext(file, pattern);

        validateOperandSyntax(receiver, grep, [file, pattern]);
        expect(getErrors(receiver).map((error) => error.message)).toContain(
            "O padrão deve vir antes do arquivo.",
        );

        validateOperandSyntax(receiver, grep, [pattern]);
        expect(
            getErrors(receiver).filter(
                (error) => error.id === "syntax_operand_sequence",
            ),
        ).toEqual([]);
    });

    it("considera a sequência inteira e usa erro genérico quando nenhuma regra casa", () => {
        const definitions = validDefinitions();
        const grep = definitions.commands[1];
        const workspace = createHeadlessWorkspace(definitions);
        const command = createBlock(workspace, BlockIDs.commandBlockType(grep));
        const file = createBlock(
            workspace,
            BlockIDs.commandOperandBlockType(grep, grep.operands[1]),
        );

        validateOperandSyntax(command, grep, [file]);
        expect(
            getErrors(command)
                .filter((error) => error.id === "syntax_operand_sequence")
                .map((error) => error.message),
        ).toEqual([
            "A ordem ou combinação de blocos é inválida para este comando.",
        ]);
    });
});
