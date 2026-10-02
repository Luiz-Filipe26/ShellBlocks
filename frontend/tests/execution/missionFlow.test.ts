// @vitest-environment jsdom
import * as Blockly from "blockly";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionResult } from "@shellblocks/shared/contracts/execution";
import { validDefinitions } from "../helpers/cliFixtures";
import { createSelectorDependencies, MemoryStorage, selectContext } from "../helpers/navigation";
import * as BlockIDs from "@/core/shellblocks/constants/blockIds";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/core/shellblocks/ui/toast", () => ({ showToast }));

const encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const stage = (exitCode = 0) => ({ exitCode, stdoutBase64: encode("resultado\n"), stderrBase64: "" });
const success: ExecutionResult = { status: "completed", setup: null, execution: stage(), verification: stage() };
const failure: ExecutionResult = { ...success, verification: stage(1) };

describe("execução e conclusão da missão", () => {
    let workspace: Blockly.Workspace;
    let loader: typeof import("@/pages/features/session/levelLoader");
    let runner: typeof import("@/pages/features/execution/scriptRunner");
    let ui: ReturnType<typeof createSelectorDependencies>;
    let output: HTMLDivElement;
    let deps: Parameters<typeof runner.runScript>[1];
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        showToast.mockClear();
        vi.stubGlobal("localStorage", new MemoryStorage());
        loader = await import("@/pages/features/session/levelLoader");
        runner = await import("@/pages/features/execution/scriptRunner");
        const { createBlock, createHeadlessWorkspace, connectInput } = await import("../helpers/blockly");
        ui = createSelectorDependencies();
        loader.setupLevelSelector({
            levels: [
                { id: "a", title: "Missão A", verificationScript: "verify a" },
                { id: "b", title: "Missão B", verificationScript: "verify b" },
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
        output = document.createElement("div");
        document.body.replaceChildren(output);
        deps = {
            cliOutput: output,
            codeOutput: document.createElement("pre"),
            runBtn: document.createElement("button"),
            clearBtn: document.createElement("button"),
            validationModal: document.createElement("dialog"),
            validationErrorList: document.createElement("ul"),
            closeModalBtn: document.createElement("button"),
        };
        const { setupOutputClearButton } = await import("@/pages/features/execution/executionOutput");
        setupOutputClearButton(output, deps.clearBtn);
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
        expect(output.children).toHaveLength(2);
        expect(output.querySelectorAll(".attempt-verification")).toHaveLength(2);
        expect(showToast).not.toHaveBeenCalled();
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
        expect(output.querySelector(".attempt-execution .attempt-context")?.textContent).toBe("Modo Livre");
        expect(output.querySelector(".attempt-verification")).toBeNull();
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).verificationScript).toBeUndefined();
    });

    it("resposta pendente pertence à missão de origem, não à nova seleção", async () => {
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        const attempt = output.firstElementChild!;
        const context = attempt.querySelector(".attempt-context")!;
        expect(context.parentElement).toBe(attempt.querySelector(".attempt-execution"));
        const sentScript = JSON.parse(fetchMock.mock.calls[0][1].body).userScript;
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).verificationScript).toBe("verify a");
        expect(attempt.querySelector(".attempt-script")?.textContent).toBe(sentScript);
        expect(attempt.querySelector(".attempt-exit-code")).toBeNull();
        selectContext(ui.elements.levelSelect, "b");
        workspace.clear();
        deps.codeOutput.textContent = "outro script";
        resolveResponse({ ok: true, json: async () => success });
        await pending;
        expect(loader.getCurrentLevelId()).toBe("b");
        expect(ui.elements.missionCompletion.hidden).toBe(true);
        expect(showToast).not.toHaveBeenCalled();
        expect(context.textContent).toBe("Atividade · Missão A");
        expect(context.parentElement).toBe(attempt.querySelector(".attempt-execution"));
        expect(output.firstElementChild).toBe(attempt);
        expect(attempt.querySelector(".attempt-script")?.textContent).toBe(sentScript);
        expect(attempt.querySelector(".attempt-stdout pre")?.textContent).toBe("resultado\n");
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
        expect(output.textContent).toContain("Missão A");
    });

    it("preserva stdout e stderr do aluno em streams separados", async () => {
        const stdout = "saída do comando\n";
        const stderr = "erro do comando\n";
        respond({
            ...success,
            execution: { exitCode: 0, stdoutBase64: encode(stdout), stderrBase64: encode(stderr) },
        });
        await run();
        const execution = output.querySelector(".attempt-execution")!;
        expect(execution.querySelector(".attempt-stdout pre")?.textContent).toBe(stdout);
        expect(execution.querySelector(".attempt-stderr pre")?.textContent).toBe(stderr);
    });

    it("apresenta exit code do aluno como metadado fora dos streams", async () => {
        respond({ ...success, execution: { exitCode: 2, stdoutBase64: encode("saída"), stderrBase64: encode("erro") } });
        await run();
        const execution = output.querySelector(".attempt-execution")!;
        expect(execution.querySelector(".attempt-exit-code")?.textContent).toContain("2");
        expect(execution.querySelector(".attempt-stream .attempt-exit-code")).toBeNull();
        expect(execution.querySelector(".attempt-stdout pre")?.textContent).toBe("saída");
        expect(execution.querySelector(".attempt-stderr pre")?.textContent).toBe("erro");
    });

    it("mostra script e streams como texto sem interpretar HTML", async () => {
        const stdout = '<img src=x onerror="alert(1)">\n';
        const { createBlock, connectInput } = await import("../helpers/blockly");
        const echo = validDefinitions().commands[0];
        const command = workspace.getAllBlocks(false).find((block) => block.type === BlockIDs.commandBlockType(echo))!;
        const operand = createBlock(workspace, BlockIDs.commandOperandBlockType(echo, echo.operands[0]));
        operand.setFieldValue(stdout.trimEnd(), BlockIDs.FIELDS.VALUE);
        connectInput(command, BlockIDs.INPUTS.OPERANDS, operand);
        respond({
            ...success,
            execution: { exitCode: 0, stdoutBase64: encode(stdout), stderrBase64: encode("<script>erro</script>") },
            verification: { exitCode: 1, stdoutBase64: encode("<img src=x>"), stderrBase64: encode("<script>diagnóstico</script>") },
        });
        await run();
        const execution = output.querySelector(".attempt-execution")!;
        expect(output.querySelector("img, script")).toBeNull();
        expect(execution.querySelector(".attempt-stdout pre")?.textContent).toBe(stdout);
        expect(execution.querySelector(".attempt-stderr pre")?.textContent).toBe("<script>erro</script>");
        expect(execution.querySelector(".attempt-script")?.textContent).toBe(JSON.parse(fetchMock.mock.calls[0][1].body).userScript);
        expect(execution.querySelector(".attempt-script")?.textContent).toContain("<img");
        expect(output.querySelector(".attempt-verification .attempt-stdout pre")?.textContent).toBe("<img src=x>");
        expect(output.querySelector(".attempt-verification .attempt-stderr pre")?.textContent).toBe("<script>diagnóstico</script>");
    });

    it("associa feedback do verificador à tentativa sem misturá-lo à execução", async () => {
        const explanation = "explicação exclusiva do verificador\n";
        respond({
            ...success,
            verification: { exitCode: 1, stdoutBase64: encode(explanation), stderrBase64: encode("diagnóstico do verificador") },
        });
        await run();
        const execution = output.querySelector(".attempt-execution")!;
        const verification = output.querySelector(".attempt-verification")!;
        expect(execution.textContent).not.toContain(explanation);
        expect(verification.querySelector(".attempt-stdout pre")?.textContent).toBe(explanation);
        expect(verification.querySelector(".attempt-stderr pre")?.textContent).toBe("diagnóstico do verificador");
        expect(verification.parentElement).toBe(execution.parentElement);
    });

    it("representa ausência de saída fora dos streams e mostra exit code zero", async () => {
        respond({ ...success, execution: { exitCode: 0, stdoutBase64: "", stderrBase64: "" } });
        await run();
        const execution = output.querySelector(".attempt-execution")!;
        expect(execution.querySelector(".attempt-stdout")).toBeNull();
        expect(execution.querySelector(".attempt-stderr")).toBeNull();
        expect(execution.querySelector(".attempt-empty")).not.toBeNull();
        expect(execution.querySelector(".attempt-exit-code")?.textContent).toContain("0");
    });

    it("falha de preparação mostra diagnósticos de ambiente sem inventar execução", async () => {
        respond({
            status: "setup_failed", execution: null, verification: null,
            setup: { exitCode: 7, stdoutBase64: encode("preparação"), stderrBase64: encode("<script>falha</script>") },
        });
        await run();
        expect(output.querySelector(".attempt-execution")).toBeNull();
        expect(output.querySelector(".attempt-exit-code")).toBeNull();
        const environment = output.querySelector(".attempt-environment")!;
        expect(environment.querySelector(".attempt-context")?.textContent).toBe("Atividade · Missão A");
        expect(environment.textContent).toContain("não foi executado");
        expect(environment.querySelector(".attempt-stderr pre")?.textContent).toBe("<script>falha</script>");
        expect(environment.querySelector("script")).toBeNull();
        expect(environment.querySelector(".attempt-script")?.textContent).toBe(JSON.parse(fetchMock.mock.calls[0][1].body).userScript);
    });

    it("falha de conexão fica na tentativa e restaura os dois botões", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));
        await run();
        expect(output.querySelector(".attempt-execution")).toBeNull();
        expect(output.querySelector(".attempt-environment")?.textContent).toContain("offline");
        expect(output.querySelector(".attempt-exit-code")).toBeNull();
        expect(deps.runBtn.disabled).toBe(false);
        expect(deps.clearBtn.disabled).toBe(false);
    });

    it("ausência de verificação pertence ao feedback pedagógico, não ao ambiente", async () => {
        selectContext(ui.elements.levelSelect, "unchecked");
        respond({ ...success, verification: null });
        await run();
        expect(output.querySelector(".attempt-verification")).not.toBeNull();
        expect(output.querySelector(".attempt-environment")).toBeNull();
        expect(ui.elements.missionCompletion.hidden).toBe(true);
    });

    it("infraestrutura no Sandbox tem somente feedback real de ambiente", async () => {
        selectContext(ui.elements.levelSelect, "sandbox");
        fetchMock.mockResolvedValue({ ok: false, json: async () => ({ status: "infrastructure_error", reason: "timeout", message: "timeout" }) });
        await run();
        expect(output.querySelector(".attempt-environment")).not.toBeNull();
        expect(output.querySelector(".attempt-verification")).toBeNull();
        expect(output.querySelector(".attempt-exit-code")).toBeNull();
    });

    it("desabilita os dois botões durante execução e os restaura ao terminar", async () => {
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        expect(deps.runBtn.disabled).toBe(true);
        expect(deps.clearBtn.disabled).toBe(true);
        resolveResponse({ ok: true, json: async () => failure });
        await pending;
        expect(deps.runBtn.disabled).toBe(false);
        expect(deps.clearBtn.disabled).toBe(false);
    });

    it("Limpar Saída não descarta histórico enquanto há execução pendente", async () => {
        respond(success);
        await run();
        const firstAttempt = output.firstElementChild;
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        const attempts = [...output.children];
        deps.clearBtn.click();
        deps.clearBtn.dispatchEvent(new Event("click"));
        expect([...output.children]).toEqual(attempts);
        resolveResponse({ ok: true, json: async () => success });
        await pending;
        expect(output.children).toHaveLength(2);
        expect(output.firstElementChild).toBe(firstAttempt);
    });

    it("reentrada de runScript não cria outra tentativa nem requisição", async () => {
        let resolveResponse!: (response: { ok: boolean; json: () => Promise<ExecutionResult> }) => void;
        fetchMock.mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
        const pending = run();
        await run();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(output.children).toHaveLength(1);
        resolveResponse({ ok: true, json: async () => success });
        await pending;
    });

    it("Limpar Saída remove apenas o histórico, preservando montagem, código, conclusão e logs", async () => {
        const logContainer = document.createElement("div");
        const logger = await import("@/pages/features/ui/systemLogger");
        logger.initSystemLogger(logContainer);
        const persistence = await import("@/pages/features/session/persistenceManager");
        persistence.unlockLevel("b");
        deps.codeOutput.textContent = "código gerado";
        respond(success);
        await run();
        const blocks = workspace.getAllBlocks(false).map((block) => block.id);
        const savedProgress = persistence.getLastUnlockedLevelId();
        expect(savedProgress).toBe("b");
        const logs = logContainer.textContent;
        deps.clearBtn.click();
        expect(output.children).toHaveLength(0);
        expect(workspace.getAllBlocks(false).map((block) => block.id)).toEqual(blocks);
        expect(deps.codeOutput.textContent).toBe("código gerado");
        expect(ui.elements.continueBtn.hidden).toBe(false);
        expect(persistence.getLastUnlockedLevelId()).toBe(savedProgress);
        expect(logContainer.textContent).toBe(logs);
        await run();
        expect(output.children).toHaveLength(1);
    });

    it("workspace vazio não inicia requisição nem cria tentativa", async () => {
        workspace.clear();
        await run();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(output.children).toHaveLength(0);
        expect(deps.runBtn.disabled).toBe(false);
        expect(deps.clearBtn.disabled).toBe(false);
    });

    it("montagem inválida mantém o modal e não cria tentativa", async () => {
        const { createBlock, connectInput } = await import("../helpers/blockly");
        const root = workspace.getAllBlocks(false).find((block) => block.type === BlockIDs.ROOT_BLOCK_TYPE)!;
        root.getInput(BlockIDs.INPUTS.STACK)?.connection?.targetBlock()?.dispose(false);
        const grep = createBlock(workspace, BlockIDs.commandBlockType(validDefinitions().commands[1]));
        connectInput(root, BlockIDs.INPUTS.STACK, grep);
        const showModal = vi.fn();
        Object.assign(deps.validationModal, { showModal });
        await run();
        expect(showModal).toHaveBeenCalledOnce();
        expect(deps.validationErrorList.children.length).toBeGreaterThan(0);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(output.children).toHaveLength(0);
    });
});
