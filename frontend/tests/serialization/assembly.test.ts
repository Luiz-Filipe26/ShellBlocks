import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWorkspaceAssembly, hasWorkspaceAssembly } from "@/core/shellblocks/workspace/assembly";
import { findScriptRoot } from "@/core/shellblocks/blocks/systemBlocks";
import { initAutoSaver, loadSession, saveWorkspaceSession } from "@/core/shellblocks/serialization/workspaceAutoSaver";
import { serializeWorkspaceToAST } from "@/core/shellblocks/serialization/serializer";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";
import { createBlock, createHeadlessWorkspace, connectInput } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";
import { MemoryStorage } from "../helpers/navigation";

vi.mock("@/core/shellblocks/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/core/shellblocks/services/logging", () => ({ coreLog: vi.fn() }));

describe("limpeza da montagem", () => {
    let workspace: Blockly.Workspace;
    beforeEach(() => {
        workspace = createHeadlessWorkspace(validDefinitions());
        vi.stubGlobal("localStorage", new MemoryStorage());
    });
    afterEach(() => {
        workspace.dispose();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function assembly() {
        const defs = validDefinitions();
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const command = createBlock(workspace, BlockIDs.commandBlockType(defs.commands[0]));
        const operand = createBlock(workspace, BlockIDs.commandOperandBlockType(defs.commands[0], defs.commands[0].operands[0]));
        connectInput(root, BlockIDs.INPUTS.STACK, command);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, operand);
        createBlock(workspace, BlockIDs.commandBlockType(defs.commands[1]));
        return root;
    }

    it("remove filhos e blocos soltos, preservando a raiz e gerando Shell vazio", () => {
        const root = assembly();
        const confirm = vi.fn(() => true);
        expect(hasWorkspaceAssembly(workspace)).toBe(true);
        expect(clearWorkspaceAssembly(workspace, confirm)).toBe(true);
        expect(confirm).toHaveBeenCalledOnce();
        expect(workspace.getAllBlocks(false)).toEqual([root]);
        expect(findScriptRoot(workspace)).toBe(root);
        expect(generateShellScript(serializeWorkspaceToAST(workspace))).toBe("");
        expect(hasWorkspaceAssembly(workspace)).toBe(false);
    });

    it("cancelar preserva integralmente valores, conexões e blocos", () => {
        assembly();
        const before = Blockly.serialization.workspaces.save(workspace);
        expect(clearWorkspaceAssembly(workspace, () => false)).toBe(false);
        expect(Blockly.serialization.workspaces.save(workspace)).toEqual(before);
    });

    it("montagem vazia não pede confirmação", () => {
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const confirm = vi.fn(() => false);
        expect(clearWorkspaceAssembly(workspace, confirm)).toBe(true);
        expect(confirm).not.toHaveBeenCalled();
        expect(findScriptRoot(workspace)).toBe(root);
    });

    it("garante raiz quando o workspace está vazio e preserva o grupo de eventos externo", () => {
        Blockly.Events.setGroup("outer");
        try {
            clearWorkspaceAssembly(workspace, () => true);
            expect(findScriptRoot(workspace)).not.toBeNull();
            expect(Blockly.Events.getGroup()).toBe("outer");
        } finally { Blockly.Events.setGroup(false); }
    });

    it("autosave e restauração refletem a limpeza sem recuperar blocos antigos", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("window", { setTimeout, clearTimeout });
        assembly();
        await vi.runAllTimersAsync();
        const visualWorkspace = workspace as unknown as Blockly.WorkspaceSvg;
        initAutoSaver(visualWorkspace, "assembly");
        // First persist an actual edit, so an old non-empty save exists.
        findScriptRoot(workspace)!.setCommentText("montagem");
        await vi.runAllTimersAsync();
        expect(JSON.parse(localStorage.getItem("blockly_autosave_assembly")!).blocks.blocks.length).toBeGreaterThan(1);
        clearWorkspaceAssembly(workspace, () => true);
        saveWorkspaceSession(workspace, "assembly");
        expect(JSON.parse(localStorage.getItem("blockly_autosave_assembly")!).blocks.blocks).toHaveLength(1);
        await vi.runAllTimersAsync();
        const saved = JSON.parse(localStorage.getItem("blockly_autosave_assembly")!);
        expect(saved.blocks.blocks).toHaveLength(1);
        const restored = createHeadlessWorkspace(validDefinitions());
        try {
            expect(loadSession(restored as unknown as Blockly.WorkspaceSvg, "assembly")).toBe(true);
            expect(restored.getAllBlocks(false)).toHaveLength(1);
            expect(findScriptRoot(restored)).not.toBeNull();
        } finally { restored.dispose(); }
    });
});
