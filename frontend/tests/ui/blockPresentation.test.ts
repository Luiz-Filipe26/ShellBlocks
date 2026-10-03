import * as Blockly from "blockly";
import { describe, expect, it } from "vitest";
import * as IDs from "@/core/shellblocks/constants/blockIds";
import { getBlockProblemText, renderBlockWarnings } from "@/core/shellblocks/validation/validationWarnings";
import { clearError, getErrors, setError } from "@/core/shellblocks/validation/validationManager";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import officialDefinitions from "@/assets/data/cli_definitions.json";
import { TextValueField } from "@/core/shellblocks/ui/textValueField";
import { ProblemIcon } from "@/core/shellblocks/ui/problemIcon";
import { formatCardinality } from "@/core/shellblocks/ui/helpBalloon";
import { createToolbox } from "@/core/shellblocks/workspace/toolboxBuilder";
import { serializeWorkspaceToAST } from "@/core/shellblocks/serialization/serializer";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";
import { validDefinitions } from "../helpers/cliFixtures";
import { createHeadlessWorkspace, createBlock, connectInput, connectNext } from "../helpers/blockly";

class PreviewField extends TextValueField {
    displayText(): string { return this.getDisplayText_(); }
}

describe("apresentação dos blocos sem alterar o programa", () => {
    it("mostra placeholder apenas na view, preservando vazio na serialização e no Shell", () => {
        const field = new PreviewField("", "Digite o destino");
        expect(field.displayText()).toContain("destino");
        expect(field.getValue()).toBe("");
        expect(field.getText()).toBe("");
        expect(field.saveState()).toBe("");
        field.setValue("real.txt");
        expect(field.displayText()).toBe("real.txt");
        field.setValue("");
        expect(field.displayText()).not.toBe("");
        expect(field.getValue()).toBe("");
        field.dispose();

        const definitions = validDefinitions();
        const command = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const root = createBlock(workspace, IDs.ROOT_BLOCK_TYPE);
            const block = createBlock(workspace, IDs.commandBlockType(command));
            const operand = createBlock(workspace, IDs.commandOperandBlockType(command, command.operands[0]));
            operand.setFieldValue("", IDs.FIELDS.VALUE);
            connectInput(root, IDs.INPUTS.STACK, block);
            connectInput(block, IDs.INPUTS.OPERANDS, operand);
            const ast = serializeWorkspaceToAST(workspace);
            expect(generateShellScript(ast)).toBe(`${command.shellCommand} ''`);
            const state = Blockly.serialization.workspaces.save(workspace);
            expect(JSON.stringify(state)).not.toContain("Digite");
            Blockly.serialization.workspaces.load(state, workspace);
            expect(serializeWorkspaceToAST(workspace)).toEqual(ast);
        } finally { workspace.dispose(); }
    });

    it("inicia operandos de preenchimento manual vazios e mantém defaults funcionais reais", () => {
        const { definitions } = parseCliDefinitions(officialDefinitions);
        const examples = [
            ["ls", "file"], ["mkdir", "directories"],
            ["cp", "source"], ["cp", "destination"],
            ["mv", "source"], ["mv", "destination"],
            ["rm", "target"], ["touch", "file"], ["cat", "file"],
            ["grep", "pattern"], ["grep", "files"], ["echo", "text"], ["curl", "url"],
        ];
        const workspace = createHeadlessWorkspace(definitions);
        try {
            for (const [commandId, operandId] of examples) {
                const command = definitions.commands.find((c) => c.id === commandId)!;
                const operand = command.operands.find((o) => o.id === operandId)!;
                const block = createBlock(workspace, IDs.commandOperandBlockType(command, operand));
                expect(block.getFieldValue(IDs.FIELDS.VALUE)).toBe("");
            }
            for (const [commandId, operandId, expected] of [
                ["ls", "folder", "."], ["cd", "directory", "~"], ["ping", "host", "127.0.0.1"],
            ]) {
                const command = definitions.commands.find((c) => c.id === commandId)!;
                const operand = command.operands.find((o) => o.id === operandId)!;
                const block = createBlock(workspace, IDs.commandOperandBlockType(command, operand));
                expect(block.getFieldValue(IDs.FIELDS.VALUE)).toBe(expected);
            }
            for (const [commandId, flag, expected] of [["ls", "--width", "80"], ["ps", "--sort", "-pcpu"]]) {
                const command = definitions.commands.find((c) => c.id === commandId)!;
                const block = createBlock(workspace, IDs.commandOptionBlockType(command));
                block.setFieldValue(flag, IDs.FIELDS.FLAG);
                expect(block.getFieldValue(IDs.FIELDS.OPTION_ARG_VALUE)).toBe(expected);
            }
        } finally { workspace.dispose(); }
    });

    it("serializa e gera cat com valor real vazio quando o operando não é preenchido", () => {
        const { definitions } = parseCliDefinitions(officialDefinitions);
        const command = definitions.commands.find((c) => c.id === "cat")!;
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const root = createBlock(workspace, IDs.ROOT_BLOCK_TYPE);
            const block = createBlock(workspace, IDs.commandBlockType(command));
            const operand = createBlock(workspace, IDs.commandOperandBlockType(command, command.operands[0]));
            connectInput(root, IDs.INPUTS.STACK, block);
            connectInput(block, IDs.INPUTS.OPERANDS, operand);
            const ast = serializeWorkspaceToAST(workspace);
            expect(generateShellScript(ast)).toBe("cat ''");
            const state = Blockly.serialization.workspaces.save(workspace);
            for (const value of [JSON.stringify(state), JSON.stringify(ast), generateShellScript(ast)]) {
                expect(value).not.toContain("arquivo.txt");
                expect(value).not.toContain("Digite");
            }
            Blockly.serialization.workspaces.load(state, workspace);
            expect(serializeWorkspaceToAST(workspace)).toEqual(ast);
            const loaded = workspace.getAllBlocks(false).find((b) => b.type === operand.type)!;
            loaded.setFieldValue("real.txt", IDs.FIELDS.VALUE);
            expect(generateShellScript(serializeWorkspaceToAST(workspace))).toBe("cat real.txt");
            // User-supplied values are preserved across serialization and loading.
            loaded.setFieldValue("arquivo.txt", IDs.FIELDS.VALUE);
            Blockly.serialization.workspaces.load(Blockly.serialization.workspaces.save(workspace), workspace);
            expect(generateShellScript(serializeWorkspaceToAST(workspace))).toBe("cat arquivo.txt");
        } finally { workspace.dispose(); }
    });

    it("placeholder não satisfaz allowEmptyValue=false nem a regex do campo", () => {
        const definitions = validDefinitions();
        const command = definitions.commands[0];
        const operand = command.operands[0];
        operand.defaultValue = "";
        operand.allowEmptyValue = false;
        operand.validations = [{ regex: "^.+$", errorMessage: "Preencha o valor." }];
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const block = createBlock(workspace, IDs.commandOperandBlockType(command, operand));
            expect(block.getFieldValue(IDs.FIELDS.VALUE)).toBe("");
            expect(getErrors(block)).toHaveLength(2);
            block.setFieldValue("real", IDs.FIELDS.VALUE);
            expect(getErrors(block)).toHaveLength(0);
            block.setFieldValue("", IDs.FIELDS.VALUE);
            expect(getErrors(block)).toHaveLength(2);
        } finally { workspace.dispose(); }
    });

    it("agrega erros ocultos sem incluir o próximo comando visível ou criar warning nativo", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        try {
            const command = definitions.commands[0];
            const parent = createBlock(workspace, IDs.commandBlockType(command));
            const child = createBlock(workspace, IDs.commandOperandBlockType(command, command.operands[0]));
            const next = createBlock(workspace, IDs.commandBlockType(command));
            connectInput(parent, IDs.INPUTS.OPERANDS, child);
            connectNext(parent, next);
            setError(child, "hidden", "erro oculto");
            setError(next, "visible", "erro do próximo");
            expect(getBlockProblemText(parent)).not.toContain("erro oculto");
            parent.setCollapsed(true);
            expect(getBlockProblemText(parent)).toContain("erro oculto");
            expect(getBlockProblemText(parent)).not.toContain("erro do próximo");
            renderBlockWarnings(child);
            expect(parent.getIcon(Blockly.icons.WarningIcon.TYPE)).toBeUndefined();
            expect(parent.getIcon(ProblemIcon.TYPE)).toBeUndefined(); // No SVG view in headless workspaces.
            clearError(child, "hidden");
            expect(getBlockProblemText(parent)).not.toContain("erro oculto");
        } finally { workspace.dispose(); }
    });

    it("usa label na toolbox e apresenta todos os intervalos de cardinalidade", () => {
        const definitions = validDefinitions();
        definitions.commands[0].label = "echo — Exibir texto";
        expect(JSON.stringify(createToolbox(definitions))).toContain(definitions.commands[0].label);
        expect(formatCardinality({ min: 1, max: 1 })).toBe("1");
        expect(formatCardinality({ min: 0, max: 1 })).toBe("0 ou 1");
        expect(formatCardinality({ min: 1, max: "unlimited" })).toBe("1 ou mais");
        expect(formatCardinality({ min: 2, max: 4 })).toBe("de 2 a 4");
    });
});
