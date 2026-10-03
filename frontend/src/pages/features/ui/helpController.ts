import * as PersistenceManager from "../session/persistenceManager";

export function setupHelpGuide(elements: {
    btnHelpGuide: HTMLButtonElement;
    helpModal: HTMLDialogElement;
    helpTitle: HTMLElement;
    closeHelpBtn: HTMLButtonElement;
    completeHelpBtn: HTMLButtonElement;
}, onCompleted: () => void): void {
    const { btnHelpGuide, helpModal, helpTitle, closeHelpBtn, completeHelpBtn } = elements;
    const makeGuideNeutral = () =>
        btnHelpGuide.classList.replace("btn-guide-urgent", "btn-guide-neutral");
    if (PersistenceManager.hasSeenHelpGuide()) makeGuideNeutral();
    completeHelpBtn.hidden = PersistenceManager.hasCompletedHelpGuide();
    btnHelpGuide.addEventListener("click", () => {
        helpModal.showModal();
        makeGuideNeutral();
        PersistenceManager.saveHasSeenHelpGuide();
        requestAnimationFrame(() => {
            if (!helpModal.open) return;
            helpModal.scrollTop = 0;
            helpTitle.focus({ preventScroll: true });
        });
    });
    closeHelpBtn.addEventListener("click", () => helpModal.close());
    helpModal.addEventListener("close", () => btnHelpGuide.focus());
    completeHelpBtn.addEventListener("click", () => {
        PersistenceManager.saveHelpGuideCompleted();
        completeHelpBtn.hidden = true;
        onCompleted();
        helpModal.close();
    });
}
