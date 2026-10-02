import type { StageResult } from "@shellblocks/shared/contracts/execution";

export interface ExecutionAttempt {
    root: HTMLElement;
    execution: HTMLElement;
    context: HTMLElement;
    state: HTMLElement;
    scriptLabel: HTMLElement;
    output: HTMLElement;
    script: string;
}

function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function startExecutionAttempt(
    history: HTMLElement,
    script: string,
    context: string,
): ExecutionAttempt {
    const root = element("article", "execution-attempt");
    const contextMetadata = element("p", "attempt-context", context);
    const execution = element("section", "attempt-frame attempt-execution");
    execution.setAttribute("aria-label", "Execução");
    const heading = element("h3", "attempt-heading", "Execução · ");
    const state = element("span", "attempt-state", "Executando...");
    state.setAttribute("role", "status");
    heading.append(state);
    const scriptLabel = element("p", "attempt-label", "Script enviado");
    const output = element("div", "attempt-output");
    execution.append(heading, contextMetadata, scriptLabel, element("pre", "attempt-script", script), output);
    root.append(execution);
    history.append(root);
    history.scrollTop = history.scrollHeight;
    return { root, execution, context: contextMetadata, state, scriptLabel, output, script };
}

function appendStreams(container: HTMLElement, stage: StageResult): void {
    for (const [name, base64] of [
        ["stdout", stage.stdoutBase64],
        ["stderr", stage.stderrBase64],
    ] as const) {
        const text = decodeStageStream(base64);
        if (!text) continue;
        const stream = element("section", `attempt-stream attempt-${name}`);
        stream.setAttribute("aria-label", name);
        stream.append(element("h4", "attempt-label", name), element("pre", "", text));
        container.append(stream);
    }
}

export function finishExecutionAttempt(attempt: ExecutionAttempt, execution: StageResult): void {
    attempt.state.textContent = "Encerrada";
    attempt.scriptLabel.textContent = "Script executado";
    appendStreams(attempt.output, execution);
    if (!execution.stdoutBase64 && !execution.stderrBase64) {
        attempt.output.append(element("p", "attempt-empty", "Sem saída em stdout ou stderr."));
    }
    attempt.output.append(element("p", "attempt-exit-code", `exit code ${execution.exitCode}`));
}

export function showAttemptFeedback(
    attempt: ExecutionAttempt,
    kind: "verification" | "environment",
    message: string,
    diagnostics?: StageResult | string,
): HTMLElement {
    const frame = element("section", `attempt-frame attempt-${kind}`);
    const title = kind === "verification" ? "ShellBlocks · Verificação" : "ShellBlocks · Ambiente";
    frame.setAttribute("aria-label", title);
    frame.append(element("h3", "attempt-heading", title), element("p", "attempt-feedback", message));
    if (typeof diagnostics === "string") {
        frame.append(element("pre", "attempt-diagnostics", diagnostics));
    } else if (diagnostics) {
        appendStreams(frame, diagnostics);
    }
    attempt.root.append(frame);
    return frame;
}

export function failExecutionAttempt(
    attempt: ExecutionAttempt,
    message: string,
    diagnostics?: StageResult | string,
): void {
    // No execution result exists: do not imply an empty completed program.
    attempt.execution.remove();
    const frame = showAttemptFeedback(attempt, "environment", message, diagnostics);
    frame.insertBefore(attempt.context, frame.children[1]);
    frame.append(element("p", "attempt-label", "Script enviado"), element("pre", "attempt-script", attempt.script));
}

export function setupOutputClearButton(history: HTMLElement, clearBtn: HTMLButtonElement): void {
    clearBtn.addEventListener("click", () => {
        if (!clearBtn.disabled) history.replaceChildren();
    });
}

export function decodeStageStream(base64: string): string {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
