import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupHelpGuide } from "@/pages/features/ui/helpController";
import { hasCompletedHelpGuide } from "@/pages/features/session/persistenceManager";
import { MemoryStorage, TestElement } from "../helpers/navigation";

function createGuide() {
    const classes = new Set(["btn-guide-urgent"]);
    const btnHelpGuide = Object.assign(new TestElement(), {
        focus: vi.fn(),
        classList: { replace: (from: string, to: string) => {
            if (!classes.delete(from)) return false;
            classes.add(to);
            return true;
        } },
    });
    class Dialog extends TestElement {
        open = false;
        scrollTop = 100;
        showModal() { this.open = true; }
        close() { this.open = false; this.dispatchEvent(new Event("close")); }
    }
    const helpModal = new Dialog();
    // Native dialog cancellation dispatches close; the guide does not suppress it.
    helpModal.addEventListener("cancel", () => helpModal.close());
    const elements = { btnHelpGuide, helpModal, helpTitle: { focus: vi.fn() },
        closeHelpBtn: new TestElement(), completeHelpBtn: new TestElement() };
    const onCompleted = vi.fn();
    setupHelpGuide(elements as unknown as Parameters<typeof setupHelpGuide>[0], onCompleted);
    return { ...elements, classes, onCompleted };
}

describe("explicação da ferramenta", () => {
    beforeEach(() => {
        vi.stubGlobal("localStorage", new MemoryStorage());
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("abrir e fechar marca apenas ajuda vista e devolve foco ao botão", () => {
        const guide = createGuide();
        guide.btnHelpGuide.click();
        expect(guide.helpTitle.focus).toHaveBeenCalled();
        expect(guide.helpModal.scrollTop).toBe(0);
        guide.closeHelpBtn.click();
        expect(hasCompletedHelpGuide()).toBe(false);
        expect(guide.onCompleted).not.toHaveBeenCalled();
        expect(guide.btnHelpGuide.focus).toHaveBeenCalled();
        expect(localStorage.getItem("shellblocks_has_seen_guide")).toBe("true");
        expect(localStorage.getItem("shellblocks_initial_choice_made")).toBeNull();
        expect(guide.classes.has("btn-guide-neutral")).toBe(true);
    });

    it("Escape fecha sem concluir", () => {
        const guide = createGuide();
        guide.btnHelpGuide.click();
        guide.helpModal.dispatchEvent(new Event("cancel"));
        expect(guide.helpModal.open).toBe(false);
        expect(hasCompletedHelpGuide()).toBe(false);
        expect(guide.onCompleted).not.toHaveBeenCalled();
    });

    it("concluir persiste, notifica a UI imediatamente e consultas não desfazem a conclusão", () => {
        const guide = createGuide();
        guide.btnHelpGuide.click();
        guide.completeHelpBtn.click();
        expect(hasCompletedHelpGuide()).toBe(true);
        expect(guide.onCompleted).toHaveBeenCalledOnce();
        expect(guide.helpModal.open).toBe(false);
        expect(guide.completeHelpBtn.hidden).toBe(true);
        const reopened = createGuide();
        expect(reopened.completeHelpBtn.hidden).toBe(true);
        reopened.btnHelpGuide.click();
        reopened.closeHelpBtn.click();
        expect(hasCompletedHelpGuide()).toBe(true);
        expect(reopened.onCompleted).not.toHaveBeenCalled();
    });

    it("ajuda vista não equivale à conclusão", () => {
        localStorage.setItem("shellblocks_has_seen_guide", "true");
        const guide = createGuide();
        expect(guide.classes.has("btn-guide-neutral")).toBe(true);
        expect(guide.completeHelpBtn.hidden).toBe(false);
        expect(hasCompletedHelpGuide()).toBe(false);
    });
});
