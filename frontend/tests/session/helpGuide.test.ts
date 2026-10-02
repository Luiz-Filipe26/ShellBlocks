import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupHelpGuide } from "@/pages/features/ui/helpController";
import { MemoryStorage, TestElement } from "../helpers/navigation";

describe("ajuda operacional recuperável", () => {
    function createHelpButton() {
        const classes = new Set(["btn-guide-urgent"]);
        const button = Object.assign(new TestElement(), {
            classList: {
                replace(oldClass: string, newClass: string): boolean {
                    if (!classes.delete(oldClass)) return false;
                    classes.add(newClass);
                    return true;
                },
            },
        });
        return { button, classes };
    }

    beforeEach(() => {
        vi.stubGlobal("localStorage", new MemoryStorage());
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callback(0));
    });
    afterEach(() => vi.unstubAllGlobals());

    it("pode abrir, fechar e reabrir sem marcar a escolha inicial como feita", () => {
        const { button: btnHelpGuide, classes } = createHelpButton();
        const closeHelpBtn = new TestElement();
        const helpModal = { showModal: vi.fn(), close: vi.fn(), scrollTop: 100 };
        setupHelpGuide({ btnHelpGuide, closeHelpBtn, helpModal } as unknown as Parameters<typeof setupHelpGuide>[0]);
        expect(classes.has("btn-guide-urgent")).toBe(true);
        btnHelpGuide.click();
        expect(classes.has("btn-guide-urgent")).toBe(false);
        expect(classes.has("btn-guide-neutral")).toBe(true);
        closeHelpBtn.click();
        btnHelpGuide.click();
        expect(helpModal.showModal).toHaveBeenCalledTimes(2);
        expect(helpModal.close).toHaveBeenCalledOnce();
        expect(helpModal.scrollTop).toBe(0);
        expect(localStorage.getItem("shellblocks_has_seen_guide")).toBe("true");
        expect(localStorage.getItem("shellblocks_initial_choice_made")).toBeNull();
    });

    it("ao retornar depois da primeira abertura, inicia sem destaque e sem pulso", () => {
        localStorage.setItem("shellblocks_has_seen_guide", "true");
        const { button, classes } = createHelpButton();
        setupHelpGuide({
            btnHelpGuide: button,
            closeHelpBtn: new TestElement(),
            helpModal: { showModal: vi.fn(), close: vi.fn() },
        } as unknown as Parameters<typeof setupHelpGuide>[0]);
        expect(classes.has("btn-guide-urgent")).toBe(false);
        expect(classes.has("btn-guide-neutral")).toBe(true);
        expect(localStorage.getItem("shellblocks_initial_choice_made")).toBeNull();
    });
});
