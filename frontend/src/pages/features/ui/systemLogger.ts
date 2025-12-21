import * as ShellBlocks from "shellblocks"

let logContainer: HTMLDivElement | null = null;

export function initSystemLogger(
    container: HTMLDivElement,
): void {
    logContainer = container;
    log("Logger do Sistema inicializado.", ShellBlocks.LogLevel.INFO);
}

export function log(
    message: string,
    level: ShellBlocks.LogLevel = ShellBlocks.LogLevel.INFO,
): void {
    writeToPanel(message, level);
}

function writeToPanel(message: string, level: ShellBlocks.LogLevel): void {
    if (!logContainer) return;

    const entry = document.createElement("div");
    entry.classList.add("log-entry", level);

    const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });

    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg"></span>`;
    const msgSpan = entry.querySelector(".log-msg");
    if (msgSpan) msgSpan.textContent = message;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}
