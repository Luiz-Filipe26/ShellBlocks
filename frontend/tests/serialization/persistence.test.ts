import * as Blockly from "blockly";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BlockIDs from "../../src/core/shellblocks/constants/blockIds";
import { generateShellScript } from "../../src/core/shellblocks/generation/scriptGenerator";
import { serializeWorkspaceToAST } from "../../src/core/shellblocks/serialization/serializer";
import { loadSession } from "../../src/core/shellblocks/serialization/workspaceAutoSaver";
import { getErrors } from "../../src/core/shellblocks/validation/validationManager";
import { createBlock, connectInput, createHeadlessWorkspace } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

vi.mock("../../src/core/shellblocks/ui/toast", () => ({
    showToast: vi.fn(),
}));
vi.mock("../../src/core/shellblocks/services/logging", () => ({
    coreLog: vi.fn(),
}));

class MemoryStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }
}

describe("persistência do workspace", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", new MemoryStorage());
        if (!Blockly.Events.isEnabled()) Blockly.Events.enable();
    });

    it("preserva campos, conexões, AST e Shell em round-trip", () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const source = createHeadlessWorkspace(definitions);
        const root = createBlock(source, BlockIDs.ROOT_BLOCK_TYPE);
        const command = createBlock(source, BlockIDs.commandBlockType(echo));
        const operand = createBlock(
            source,
            BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
        );
        operand.setFieldValue("valor persistido", BlockIDs.FIELDS.VALUE);
        connectInput(root, BlockIDs.INPUTS.STACK, command);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, operand);
        const state = Blockly.serialization.workspaces.save(source);

        const restored = createHeadlessWorkspace(definitions);
        Blockly.serialization.workspaces.load(state, restored);
        const ast = serializeWorkspaceToAST(restored);

        expect(generateShellScript(ast)).toBe("echo 'valor persistido'");
        expect(
            restored
                .getBlocksByType(
                    BlockIDs.commandOperandBlockType(echo, echo.operands[0]),
                    false,
                )[0]
                .getFieldValue(BlockIDs.FIELDS.VALUE),
        ).toBe("valor persistido");
    });

    it("sempre reabilita eventos se a desserialização da sessão falhar", () => {
        const definitions = validDefinitions();
        const workspace = createHeadlessWorkspace(definitions);
        localStorage.setItem("blockly_autosave_failure", "{}");
        const loadSpy = vi.spyOn(Blockly.serialization.workspaces, "load").mockImplementation(
            () => {
                throw new Error("estado inválido");
            },
        );

        expect(Blockly.Events.isEnabled()).toBe(true);
        expect(
            loadSession(
                workspace as unknown as Blockly.WorkspaceSvg,
                "failure",
            ),
        ).toBe(false);
        expect(loadSpy).toHaveBeenCalledOnce();
        expect(Blockly.Events.isEnabled()).toBe(true);
        expect(localStorage.getItem("blockly_autosave_failure")).toBeNull();
    });

    it("recalcula os erros do workspace restaurado", async () => {
        const definitions = validDefinitions();
        const echo = definitions.commands[0];
        const source = createHeadlessWorkspace(definitions);
        const root = createBlock(source, BlockIDs.ROOT_BLOCK_TYPE);
        const invalidCommand = createBlock(
            source,
            BlockIDs.commandBlockType(echo),
        );
        connectInput(root, BlockIDs.INPUTS.STACK, invalidCommand);
        localStorage.setItem(
            "blockly_autosave_invalid",
            JSON.stringify(Blockly.serialization.workspaces.save(source)),
        );
        const restored = createHeadlessWorkspace(definitions);

        expect(
            loadSession(
                restored as unknown as Blockly.WorkspaceSvg,
                "invalid",
            ),
        ).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const restoredCommand = restored.getBlocksByType(
            BlockIDs.commandBlockType(echo),
            false,
        )[0];
        expect(getErrors(restoredCommand).map((error) => error.id)).toContain(
            "CARDINALITY_MISSING_OPERAND_text",
        );
        expect(Blockly.Events.isEnabled()).toBe(true);
    });
});
