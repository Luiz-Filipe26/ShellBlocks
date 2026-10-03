import { SANDBOX_LEVEL_ID } from "../session/levelLoader";
import { hasCompletedHelpGuide } from "../session/persistenceManager";

const NOTICE_DURATION_MS = 5000;
const NOTICE_TEXT = 'Clique no botão "Explicar Ferramenta" e leia toda a ajuda. Ao final, clique em "Concluir explicação" para começar as Atividades guiadas.';

/** Application onboarding: a presentation barrier, never a change to the assembly. */
export function setupGuidedOnboarding(elements: {
    levelSelect: HTMLSelectElement;
    workspaceSurface: HTMLElement;
    interceptor: HTMLElement;
    notice: HTMLElement;
    helpButton: HTMLButtonElement;
    constructionControls: HTMLButtonElement[];
}, stopWorkspaceInteraction: () => void): { refresh: () => void; dispose: () => void } {
    const { levelSelect, workspaceSurface, interceptor, notice, helpButton, constructionControls } = elements;
    const listeners = new AbortController();
    const { signal } = listeners;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const isBlocked = () => levelSelect.value !== SANDBOX_LEVEL_ID && !hasCompletedHelpGuide();

    function dismissNotice(): void {
        clearTimeout(noticeTimer);
        noticeTimer = undefined;
        notice.textContent = "";
        helpButton.classList.remove("onboarding-help-highlight");
    }

    function showNotice(): void {
        // Repeated attempts extend the same notice without repeating its live announcement.
        if (!notice.textContent) notice.textContent = NOTICE_TEXT;
        helpButton.classList.add("onboarding-help-highlight");
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(dismissNotice, NOTICE_DURATION_MS);
    }

    function intercept(event: Event): void {
        if (!isBlocked()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        showNotice();
    }

    function refresh(): void {
        const blocked = isBlocked();
        if (blocked && !workspaceSurface.inert) {
            stopWorkspaceInteraction();
            if (workspaceSurface.contains(document.activeElement)) helpButton.focus();
        }
        workspaceSurface.inert = blocked;
        interceptor.hidden = !blocked;
        for (const control of constructionControls) {
            // Keep native disabled states (execution in flight, experiment mode) untouched.
            if (blocked) control.setAttribute("aria-disabled", "true");
            else control.removeAttribute("aria-disabled");
        }
        dismissNotice();
    }

    for (const type of ["pointerdown", "mousedown", "touchstart", "click", "dblclick", "contextmenu", "wheel"]) {
        interceptor.addEventListener(type, intercept, { capture: true, passive: false, signal });
    }
    interceptor.addEventListener("keydown", (event) => {
        if (event.key === "Tab" || event.key === "Escape") return;
        intercept(event);
    }, { signal });
    for (const control of constructionControls) {
        control.addEventListener("click", intercept, { capture: true, signal });
    }
    levelSelect.addEventListener("change", refresh, { signal });
    helpButton.addEventListener("click", dismissNotice, { signal });
    refresh();
    return {
        refresh,
        dispose: () => {
            listeners.abort();
            dismissNotice();
            workspaceSurface.inert = false;
            interceptor.hidden = true;
            for (const control of constructionControls) control.removeAttribute("aria-disabled");
        },
    };
}
