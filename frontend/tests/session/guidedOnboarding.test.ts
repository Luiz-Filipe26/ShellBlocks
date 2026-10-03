import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupGuidedOnboarding } from "@/pages/features/ui/guidedOnboarding";
import { setupHelpGuide } from "@/pages/features/ui/helpController";
import { saveHelpGuideCompleted } from "@/pages/features/session/persistenceManager";
import { MemoryStorage, TestElement } from "../helpers/navigation";

class Element extends TestElement {
    inert = false;
    attributes = new Map<string, string>();
    classes = new Set<string>();
    classList = {
        add: (value: string) => this.classes.add(value),
        remove: (value: string) => this.classes.delete(value),
        replace: (from: string, to: string) => {
            if (!this.classes.delete(from)) return false;
            this.classes.add(to);
            return true;
        },
    };
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    contains() { return false; }
    focus = vi.fn();
}

function createOnboarding(context = "level-01") {
    const elements = {
        levelSelect: Object.assign(new Element(), { value: context }),
        workspaceSurface: new Element(), interceptor: new Element(), notice: new Element(),
        helpButton: new Element(), constructionControls: [new Element(), new Element()],
    };
    elements.constructionControls[1].disabled = true;
    const stop = vi.fn();
    const controller = setupGuidedOnboarding(elements as unknown as Parameters<typeof setupGuidedOnboarding>[0], stop);
    function select(value: string) {
        elements.levelSelect.value = value;
        elements.levelSelect.dispatchEvent(new Event("change"));
    }
    return { ...elements, ...controller, select, stop };
}

function attempt(target: EventTarget) {
    const event = new Event("click", { cancelable: true });
    target.dispatchEvent(event);
    return event;
}

describe("requisito de explicação nas atividades guiadas", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("localStorage", new MemoryStorage());
        vi.stubGlobal("document", { activeElement: null });
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    it("guiado pendente bloqueia sem aviso inicial e preserva outras desativações", () => {
        const ui = createOnboarding();
        expect(ui.workspaceSurface.inert).toBe(true);
        expect(ui.interceptor.hidden).toBe(false);
        expect(ui.notice.textContent).toBe("");
        expect(ui.stop).toHaveBeenCalledOnce();
        for (const control of ui.constructionControls) {
            expect(control.attributes.get("aria-disabled")).toBe("true");
            expect(attempt(control).defaultPrevented).toBe(true);
        }
        expect(ui.constructionControls[1].disabled).toBe(true);
        ui.dispose();
    });

    it("tentativa apresenta um aviso, repetições estendem sua duração e ele desaparece", () => {
        const ui = createOnboarding();
        expect(attempt(ui.interceptor).defaultPrevented).toBe(true);
        expect(ui.notice.textContent).toContain("Explicar Ferramenta");
        expect(ui.helpButton.classes.has("onboarding-help-highlight")).toBe(true);
        const message = ui.notice.textContent;
        vi.advanceTimersByTime(4000);
        attempt(ui.interceptor);
        expect(ui.notice.textContent).toBe(message);
        expect(vi.getTimerCount()).toBe(1);
        vi.advanceTimersByTime(4999);
        expect(ui.notice.textContent).toBe(message);
        vi.advanceTimersByTime(1);
        expect(ui.notice.textContent).toBe("");
        expect(ui.helpButton.classes.has("onboarding-help-highlight")).toBe(false);
        ui.dispose();
    });

    it("livre permite interação e alternar modos recalcula o requisito", () => {
        const ui = createOnboarding("sandbox");
        expect(ui.workspaceSurface.inert).toBe(false);
        expect(attempt(ui.interceptor).defaultPrevented).toBe(false);
        ui.select("level-01");
        expect(ui.workspaceSurface.inert).toBe(true);
        attempt(ui.interceptor);
        ui.select("sandbox");
        expect(ui.workspaceSurface.inert).toBe(false);
        expect(ui.interceptor.hidden).toBe(true);
        expect(ui.notice.textContent).toBe("");
        expect(ui.constructionControls[1].disabled).toBe(true);
        ui.select("level-02");
        expect(ui.workspaceSurface.inert).toBe(true);
        ui.dispose();
    });

    it.each(["level-01", "sandbox"])("conclusão em %s libera imediatamente e sobrevive ao retorno", (context) => {
        const ui = createOnboarding(context);
        saveHelpGuideCompleted();
        ui.refresh();
        expect(ui.workspaceSurface.inert).toBe(false);
        ui.select("level-02");
        expect(ui.workspaceSurface.inert).toBe(false);
        ui.dispose();
        const restored = createOnboarding();
        expect(restored.workspaceSurface.inert).toBe(false);
        expect(restored.interceptor.hidden).toBe(true);
        restored.dispose();
    });

    it("abrir/fechar a ajuda mantém o bloqueio, concluir o remove e consultas não o reativam", () => {
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));
        const ui = createOnboarding();
        class Dialog extends Element {
            open = false;
            scrollTop = 0;
            showModal() { this.open = true; }
            close() { this.open = false; this.dispatchEvent(new Event("close")); }
        }
        const helpModal = new Dialog();
        const closeHelpBtn = new Element();
        const completeHelpBtn = new Element();
        setupHelpGuide({ btnHelpGuide: ui.helpButton, helpModal, helpTitle: new Element(),
            closeHelpBtn, completeHelpBtn } as unknown as Parameters<typeof setupHelpGuide>[0], ui.refresh);
        ui.helpButton.click();
        closeHelpBtn.click();
        expect(ui.workspaceSurface.inert).toBe(true);
        ui.helpButton.click();
        completeHelpBtn.click();
        expect(ui.workspaceSurface.inert).toBe(false);
        expect(ui.interceptor.hidden).toBe(true);
        ui.helpButton.click();
        closeHelpBtn.click();
        expect(ui.workspaceSurface.inert).toBe(false);
        ui.dispose();
    });

    it("teclado solicita feedback sem prender Tab; descarte remove listeners e timer", () => {
        const ui = createOnboarding();
        const event = Object.assign(new Event("keydown", { cancelable: true }), { key: "Enter" });
        ui.interceptor.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(ui.notice.textContent).not.toBe("");
        const tab = Object.assign(new Event("keydown", { cancelable: true }), { key: "Tab" });
        ui.interceptor.dispatchEvent(tab);
        expect(tab.defaultPrevented).toBe(false);
        ui.dispose();
        expect(vi.getTimerCount()).toBe(0);
        expect(ui.workspaceSurface.inert).toBe(false);
        expect(attempt(ui.constructionControls[0]).defaultPrevented).toBe(false);
    });
});
