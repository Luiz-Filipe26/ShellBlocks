import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionResult } from "@shellblocks/shared/contracts/execution";
import { validDefinitions } from "../helpers/cliFixtures";
import { createSelectorDependencies, MemoryStorage, selectContext, TestElement } from "../helpers/navigation";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/core/shellblocks/ui/toast", () => ({ showToast }));

const stage = (exitCode = 0) => ({ exitCode, stdoutBase64: btoa("resultado\n"), stderrBase64: "" });
const success: ExecutionResult = { status: "completed", setup: null, execution: stage(), verification: stage() };
const failure: ExecutionResult = { ...success, verification: stage(1) };

describe("execução e conclusão da missão", () => {
    let workspace: Blockly.Workspace;
    let loader: typeof import("@/pages/features/session/levelLoader");
    let runner: typeof import("@/pages/features/execution/scriptRunner");
    let ui: ReturnType<typeof createSelectorDependencies>;
    let output: HTMLPreElement;
    let deps: Parameters<typeof runner.runScript>[1];
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        showToast.mockClear();
        vi.stubGlobal("localStorage", new MemoryStorage());
        loader = await import("@/pages/features/session/levelLoader");
        runner = await import("@/pages/features/execution/scriptRunner");
        const { createBlock, createHeadlessWorkspace, connectInput } = await import("../helpers/blockly");
        vi.stubGlobal("document", { createElement: () => new TestElement() });
        ui = createSelectorDependencies();
        loader.setupLevelSelector({
            levels: [
                { id: "a", title: "Missão A", verificationScript: "verify" },
                { id: "b", title: "Missão B", verificationScript: "verify" },
                { id: "unchecked", title: "Sem verificação" },
            ],
            levelOrder: ["a", "b", "unchecked"],
        }, ui.deps, false);
        selectContext(ui.elements.levelSelect, "a");
        const definitions = validDefinitions();
        definitions.commands[0].operands[0].cardinality.min = 0;
        workspace = createHeadlessWorkspace(definitions);
        const root = createBlock(workspace, BlockIDs.ROOT_BLOCK_TYPE);
        const command = createBlock(workspace, BlockIDs.commandBlockType(definitions.commands[0]));
        connectInput(root, BlockIDs.INPUTS.STACK, command);
        await new Promise((resolve) => setTimeout(resolve, 0));
        output = { textContent: "$", scrollTop: 0, scrollHeight: 1 } as HTMLPreElement;
        deps = {
            cliOutput: output,
            codeOutput: {} as HTMLPreElement,
            runBtn: { disabled: false, textContent: "Executar" } as HTMLButtonElement,
            validationModal: {} as HTMLDialogElement,
            validationErrorList: {} as HTMLUListElement,
            closeModalBtn: {} as HTMLButtonElement,
        };
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => {
        workspace.dispose();
        vi.unstubAllGlobals();
    });

    function respond(result: ExecutionResult): void {
        fetchMock.mockResolvedValue({ ok: true, json: async () => result });
    }

    async function run(id = loader.getCurrentLevelId()): Promise<void> {
        await runner.runScript(workspace as unknown as Blockly.WorkspaceSvg, deps, id,
            (origin) => loader.markLevelCompleted(origin, ui.deps, false));
    }

    it("sucesso preserva contexto e saída, e uma falha posterior não revoga Continuar", async () => {
        respond(success);
        await run();
        expect(loader.getCurrentLevelId()).toBe("a");
        expect(output.textContent).toContain("resultado");
        expect(ui.elements.continueBtn.hidden).toBe(false);
        respond(failure);
        await run();
        expect(ui.elements.continueBtn.hidden).toBe(false);
        expect(showToast).toHaveBeenLastCalledWith(
            expect.anything(), expect.stringContaining("nesta tentativa"), "warn",
        );
        ui.elements.continueBtn.click();
        expect(loader.getCurrentLevelId()).toBe("b");
    });

    it.each([
        ["verificação falha", failure],
        ["sem verificação", { ...success, verification: null }],
        ["setup falho", { status: "setup_failed", setup: stage(1), execution: null, verification: null }],
        ["infraestrutura", { status: "infrastructure_error", reason: "internal_error", message: "Falha" }],
    ] satisfies [string, ExecutionResult][])("%s não conclui nem libera Continuar", async (_name, result) => {
        respond(result);
        await run();
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        ui.elements.continueBtn.click();
        expect(loader.getCurrentLevelId()).toBe("a");
    });

    it("Sandbox ignora resultado pedagógico mesmo se recebido", async () => {
        selectContext(ui.elements.levelSelect, "sandbox");
        respond(success);
        await run();
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        expect(output.textContent).toContain("Modo Livre");
    });

    it("resposta pendente pertence à missão de origem, não à nova seleção", async () => {
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        selectContext(ui.elements.levelSelect, "b");
        resolveResponse({ ok: true, json: async () => success });
        await pending;
        expect(loader.getCurrentLevelId()).toBe("b");
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        expect(showToast).not.toHaveBeenCalled();
        expect(output.textContent).toContain("Execução: Missão A");
        selectContext(ui.elements.levelSelect, "a");
        expect(ui.elements.continueBtn.hidden).toBe(false);
    });

    it("uma missão substituída por upload não herda uma resposta pendente com o mesmo ID", async () => {
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        loader.setupLevelSelector({
            levels: [{ id: "a", title: "Nova missão", verificationScript: "new verification" }],
            levelOrder: ["a"],
        }, ui.deps, false);
        resolveResponse({ ok: true, json: async () => success });
        await pending;
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        expect(showToast).not.toHaveBeenCalled();
        expect(output.textContent).toContain("Execução: Missão A");
    });
});
