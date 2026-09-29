import { describe, expect, it } from "vitest";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import { registerBlockTypesFromDefinitions } from "@/core/shellblocks/blocks/blocksBuilder";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";
import { getBlockSemanticData } from "@/core/shellblocks/serialization/metadataManager";
import { serializeWorkspaceToAST } from "@/core/shellblocks/serialization/serializer";
import { createBlock, connectInput, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

describe("registro de SemanticData por tipo", () => {
    it("compartilha metadata entre ocorrências sem compartilhar valores", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const type = BlockIDs.commandOperandBlockType(echo, echo.operands[0]);
        const first = createBlock(workspace, type);
        const second = createBlock(workspace, type);
        first.setFieldValue("primeiro", BlockIDs.FIELDS.VALUE);
        second.setFieldValue("segundo", BlockIDs.FIELDS.VALUE);

        expect(getBlockSemanticData(first)).toBe(getBlockSemanticData(second));
        expect(first.getFieldValue(BlockIDs.FIELDS.VALUE)).toBe("primeiro");
        expect(second.getFieldValue(BlockIDs.FIELDS.VALUE)).toBe("segundo");
    });

    it("substitui metadata ao redefinir o mesmo tipo", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const block = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[0]),
        );
        const redefined = validDefinitions();
        redefined.commands[0].shellCommand = "printf";

        registerBlockTypesFromDefinitions(redefined);

        expect(getBlockSemanticData(block)?.name).toBe("printf");
    });

    it("remove metadata de tipos ausentes na reconstrução", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const oldBlock = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[0]),
        );
        const withoutEcho = validDefinitions();
        withoutEcho.commands = withoutEcho.commands.slice(1);

        registerBlockTypesFromDefinitions(withoutEcho);

        expect(getBlockSemanticData(oldBlock)).toBeUndefined();
    });

    it("mantém uma AST construída independente de mudanças posteriores no registro", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const command = createBlock(workspace, BlockIDs.commandBlockType(echo));
        connectInput(root, BlockIDs.INPUTS.STACK, command);
        const ast = serializeWorkspaceToAST(workspace);

        registerBlockTypesFromDefinitions({
            commands: [],
            operators: [],
            controls: [],
            categories: [],
        });

        expect(generateShellScript(ast)).toBe("echo");
    });

    it("preserva operatorConfig depois que o registro é limpo", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const pipe = createBlock(
            workspace,
            BlockIDs.operatorBlockType(definitions.operators[0]),
        );
        const left = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[0]),
        );
        const right = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[1]),
        );
        connectInput(root, BlockIDs.INPUTS.STACK, pipe);
        connectInput(pipe, "A", left);
        connectInput(pipe, "B", right);
        const ast = serializeWorkspaceToAST(workspace);
        const operatorNode = ast?.parameters[0].children[0];

        registerBlockTypesFromDefinitions({
            commands: [],
            operators: [],
            controls: [],
            categories: [],
        });

        expect(operatorNode?.operatorConfig).toBeDefined();
        expect(generateShellScript(ast)).toBe("echo | grep");
    });

    it("preserva controlConfig depois que o registro é redefinido", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const control = createBlock(
            workspace,
            BlockIDs.controlBlockType(definitions.controls[0]),
        );
        const condition = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[0]),
        );
        const body = createBlock(
            workspace,
            BlockIDs.commandBlockType(definitions.commands[0]),
        );
        connectInput(root, BlockIDs.INPUTS.STACK, control);
        connectInput(control, "CONDITION", condition);
        connectInput(control, "DO", body);
        const ast = serializeWorkspaceToAST(workspace);
        const controlNode = ast?.parameters[0].children[0];

        const redefined = validDefinitions();
        redefined.controls[0].syntaxEnd = "end-if-alterado";
        redefined.controls[0].slots[1].syntaxPrefix = " then-alterado";
        registerBlockTypesFromDefinitions(redefined);

        expect(controlNode?.controlConfig).toBeDefined();
        expect(generateShellScript(ast)).toBe(
            "if \n  echo ; then\n  echo\nfi",
        );
    });
});
