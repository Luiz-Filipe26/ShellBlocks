import * as PersistenceManager from "../session/persistenceManager";

export function setupHelpGuide(elements: {
    btnHelpGuide: HTMLButtonElement;
    helpModal: HTMLDialogElement;
    closeHelpBtn: HTMLButtonElement;
}): void {
    const { btnHelpGuide, helpModal, closeHelpBtn } = elements;
    const makeGuideNeutral = () =>
        btnHelpGuide.classList.replace("btn-guide-urgent", "btn-guide-neutral");
    if (PersistenceManager.hasSeenHelpGuide()) makeGuideNeutral();
    btnHelpGuide.addEventListener("click", () => {
        helpModal.showModal();
        makeGuideNeutral();
        PersistenceManager.saveHasSeenHelpGuide();
        requestAnimationFrame(() => (helpModal.scrollTop = 0));
    });
    closeHelpBtn.addEventListener("click", () => {
        helpModal.close();
    });
}
