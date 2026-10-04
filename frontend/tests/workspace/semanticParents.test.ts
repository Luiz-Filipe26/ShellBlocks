import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as IDs from "@/core/shellblocks/constants/blockIds";
import { getValidSemanticParents } from "@/core/shellblocks/workspace/semanticParents";
import { validateOperandSyntax } from "@/core/shellblocks/validation/syntaxValidator";
import { getErrors } from "@/core/shellblocks/validation/validationManager";
import { createBlock, connectInput, connectNext, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

let definitions: ReturnType<typeof validDefinitions>;
let echo: (typeof definitions.commands)[number];
let grep: (typeof definitions.commands)[number];
let workspace: Blockly.Workspace;
const block = (type: string): Blockly.Block => createBlock(workspace, type);
const command = (definition = echo): Blockly.Block => block(IDs.commandBlockType(definition));
const option = (flag = "-n"): Blockly.Block => {
    const result = block(IDs.commandOptionBlockType(echo));
    result.setFieldValue(flag, IDs.FIELDS.FLAG);
    return result;
};
const operand = (definition = echo, index = 0): Blockly.Block =>
    block(IDs.commandOperandBlockType(definition, definition.operands[index]));

beforeEach(() => {
    Blockly.Events.disable();
    definitions = validDefinitions();
    [echo, grep] = definitions.commands;
    echo.options.push({ flag: "-v", description: "Option independente" });
    workspace = createHeadlessWorkspace(definitions);
});
afterEach(() => {
    workspace.dispose();
    Blockly.Events.enable();
});

describe("pais semânticos durante drag", () => {
    it("option destaca somente comandos compatíveis, nunca irmãos da cadeia", () => {
        const parent = command();
        const sibling = option("-r");
        // Use a group-free command to isolate type/containment from exclusivity.
        echo.exclusiveOptions = [];
        connectInput(parent, IDs.INPUTS.OPTIONS, sibling);
        command(grep);
        const dragged = option();
        expect(getValidSemanticParents(dragged)).toEqual([parent]);
    });

    it("operand destaca somente seu comando, nunca operandos irmãos", () => {
        const parent = command();
        const sibling = operand();
        connectInput(parent, IDs.INPUTS.OPERANDS, sibling);
        command(grep);
        expect(getValidSemanticParents(operand())).toEqual([parent]);
    });

    it("command destaca Script Principal, control e operator, mas não comandos irmãos", () => {
        const root = block(IDs.ROOT_BLOCK_TYPE);
        const control = block(IDs.controlBlockType(definitions.controls[0]));
        const operator = block(IDs.operatorBlockType(definitions.operators[0]));
        const sibling = command(grep);
        connectInput(root, IDs.INPUTS.STACK, sibling);
        expect(new Set(getValidSemanticParents(command()))).toEqual(new Set([root, control, operator]));
    });

    it("operators e controls arrastados seguem o mesmo containment", () => {
        const root = block(IDs.ROOT_BLOCK_TYPE);
        command();
        const control = block(IDs.controlBlockType(definitions.controls[0]));
        const operator = block(IDs.operatorBlockType(definitions.operators[0]));
        expect(new Set(getValidSemanticParents(operator))).toEqual(new Set([root, control]));
        expect(new Set(getValidSemanticParents(control))).toEqual(new Set([root, operator]));
    });

    it("permite múltiplos comandos válidos sem missão ou toolboxGuidance", () => {
        const first = command();
        const second = command();
        expect(new Set(getValidSemanticParents(operand()))).toEqual(new Set([first, second]));
    });

    it("cardinalidade máxima exclui candidato e considera toda a cadeia arrastada", () => {
        const parent = command();
        const first = operand();
        const second = operand();
        connectInput(parent, IDs.INPUTS.OPERANDS, first);
        connectNext(first, second);
        expect(getValidSemanticParents(operand())).toEqual([]);
        second.unplug();
        const dragged = operand();
        connectNext(dragged, operand());
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("exclusividade e duplicatas excluem o comando", () => {
        const parent = command();
        connectInput(parent, IDs.INPUTS.OPTIONS, option());
        expect(getValidSemanticParents(option("-r"))).toEqual([]);
        expect(getValidSemanticParents(option())).toEqual([]);
    });

    it("conflito dentro da cadeia arrastada também exclui o comando", () => {
        command();
        const dragged = option();
        connectNext(dragged, option("-r"));
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("duplicata preexistente não bloqueia uma option independente", () => {
        const parent = command();
        const first = option();
        connectInput(parent, IDs.INPUTS.OPTIONS, first);
        connectNext(first, option());
        expect(getValidSemanticParents(option("-v"))).toEqual([parent]);
        expect(getValidSemanticParents(option())).toEqual([]);
    });

    it("conflito exclusivo preexistente não bloqueia uma option fora do grupo", () => {
        const parent = command();
        const first = option();
        connectInput(parent, IDs.INPUTS.OPTIONS, first);
        connectNext(first, option("-r"));
        expect(getValidSemanticParents(option("-v"))).toEqual([parent]);
    });

    it("excesso preexistente de outro operando não bloqueia uma inserção dentro do seu limite", () => {
        grep.operands[1].cardinality.max = 2;
        const parent = command(grep);
        const first = operand(grep);
        const second = operand(grep);
        const file = operand(grep, 1);
        connectInput(parent, IDs.INPUTS.OPERANDS, first);
        connectNext(first, second);
        connectNext(second, file);
        expect(getValidSemanticParents(operand(grep, 1))).toEqual([parent]);
        expect(getValidSemanticParents(operand(grep))).toEqual([]);
    });

    it("duplicação dentro da cadeia arrastada bloqueia mesmo com duplicata anterior não relacionada", () => {
        const parent = command();
        const first = option();
        connectInput(parent, IDs.INPUTS.OPTIONS, first);
        connectNext(first, option());
        const dragged = option("-v");
        connectNext(dragged, option("-v"));
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("novo conflito exclusivo bloqueia mesmo com duplicata anterior fora do grupo", () => {
        const parent = command();
        const first = option("-v");
        connectInput(parent, IDs.INPUTS.OPTIONS, first);
        connectNext(first, option("-v"));
        const dragged = option();
        expect(getValidSemanticParents(dragged)).toEqual([parent]);
        connectNext(dragged, option("-r"));
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("nova extrapolação bloqueia mesmo com excesso anterior em outro tipo", () => {
        grep.operands[1].cardinality.max = 2;
        const parent = command(grep);
        const first = operand(grep);
        const second = operand(grep);
        connectInput(parent, IDs.INPUTS.OPERANDS, first);
        connectNext(first, second);
        connectNext(second, operand(grep, 1));
        const dragged = operand(grep, 1);
        expect(getValidSemanticParents(dragged)).toEqual([parent]);
        connectNext(dragged, operand(grep, 1));
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("tipo incompatível exclui candidato", () => {
        command(grep);
        block(IDs.ROOT_BLOCK_TYPE);
        expect(getValidSemanticParents(operand())).toEqual([]);
    });

    it("ordem inválida não exclui candidato", () => {
        const parent = command(grep);
        const file = operand(grep, 1);
        connectInput(parent, IDs.INPUTS.OPERANDS, file);
        const pattern = operand(grep);
        validateOperandSyntax(parent, grep, [file, pattern]);
        expect(getErrors(parent)).not.toEqual([]);
        expect(getValidSemanticParents(pattern)).toEqual([parent]);
    });

    it("conta apenas blocos que não fazem parte da montagem arrastada", () => {
        const parent = command();
        const dragged = operand();
        connectInput(parent, IDs.INPUTS.OPERANDS, dragged);
        connectNext(dragged, operand());
        expect(getValidSemanticParents(dragged)).toEqual([parent]);
    });

    it("slot de operator ocupado e stacks maiores que uma expressão não são candidatos", () => {
        const operator = block(IDs.operatorBlockType(definitions.operators[0]));
        connectInput(operator, "A", command());
        connectInput(operator, "B", command());
        expect(getValidSemanticParents(command())).toEqual([]);
        operator.getInputTargetBlock("A")!.unplug();
        const dragged = command();
        connectNext(dragged, command());
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });

    it("não destaca descendentes do bloco arrastado nem conteúdo recolhido", () => {
        const root = block(IDs.ROOT_BLOCK_TYPE);
        root.setCollapsed(true);
        const dragged = block(IDs.controlBlockType(definitions.controls[0]));
        const inner = block(IDs.controlBlockType(definitions.controls[0]));
        connectInput(dragged, "DO", inner);
        expect(getValidSemanticParents(dragged)).toEqual([]);
    });
});
