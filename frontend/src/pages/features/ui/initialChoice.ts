import * as PersistenceManager from "../session/persistenceManager";
import { getCachedLevelData, SANDBOX_LEVEL_ID } from "../session/levelLoader";

export function setupInitialChoice(elements: {
    initialChoiceModal: HTMLDialogElement;
    guidedChoiceBtn: HTMLButtonElement;
    freeChoiceBtn: HTMLButtonElement;
    guidedChoiceUnavailable: HTMLElement;
    levelSelect: HTMLSelectElement;
}): void {
    const { initialChoiceModal, guidedChoiceBtn, freeChoiceBtn, guidedChoiceUnavailable, levelSelect } = elements;
    if (PersistenceManager.hasMadeInitialChoice()) return;

    const firstActivity = [...levelSelect.options].find(
        (option) => option.value !== SANDBOX_LEVEL_ID && !option.disabled && getCachedLevelData(option.value),
    );
    guidedChoiceBtn.disabled = !firstActivity;
    guidedChoiceUnavailable.hidden = Boolean(firstActivity);
    freeChoiceBtn.disabled = false;

    function choose(contextId: string): void {
        levelSelect.value = contextId;
        levelSelect.dispatchEvent(new Event("change"));
        PersistenceManager.saveInitialChoiceMade();
        initialChoiceModal.close();
        levelSelect.focus();
    }

    guidedChoiceBtn.addEventListener("click", () => {
        if (firstActivity) choose(firstActivity.value);
    });
    freeChoiceBtn.addEventListener("click", () => choose(SANDBOX_LEVEL_ID));
    // Escape is not a third route: the user chooses one of the two contexts.
    initialChoiceModal.oncancel = (event) => event.preventDefault();
    if (!initialChoiceModal.open) initialChoiceModal.showModal();
    (firstActivity ? guidedChoiceBtn : freeChoiceBtn).focus();
}
