function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Elemento ausente no HTML: ${id}`);
    return element as T;
}

const pageElements = {
    compactControls: getElement<HTMLElement>("compact-controls"),
    btnCompactInstructions: getElement<HTMLButtonElement>("btn-compact-instructions"),
    btnCompactResults: getElement<HTMLButtonElement>("btn-compact-results"),
    btnCloseInstructions: getElement<HTMLButtonElement>("btn-close-instructions"),
    blocklyArea: getElement<HTMLDivElement>("blockly-area"),
    btnMaximizeWorkspace: getElement<HTMLButtonElement>("btn-maximize-workspace"),
    workspaceMaximizeIcon: getElement<HTMLImageElement>("workspace-maximize-icon"),
    workspaceMinimizeIcon: getElement<HTMLImageElement>("workspace-minimize-icon"),
    editorToolbar: getElement<HTMLElement>("editor-toolbar"),
    btnDownloadShell: getElement<HTMLButtonElement>("btn-download-shell"),
    codeOutput: getElement<HTMLPreElement>("code-output"),
    cliOutput: getElement<HTMLDivElement>("cli-output"),
    runBtn: getElement<HTMLButtonElement>("run-btn"),
    clearBtn: getElement<HTMLButtonElement>("clear-btn"),
    btnClearAssembly: getElement<HTMLButtonElement>("btn-clear-assembly"),
    missionCompletion: getElement<HTMLElement>("mission-completion"),
    missionCompletionText: getElement<HTMLElement>("mission-completion-text"),
    continueBtn: getElement<HTMLButtonElement>("continue-btn"),
    assemblyTransitionNotice: getElement<HTMLElement>("assembly-transition-notice"),
    appHeader: getElement<HTMLElement>("app-header"),
    levelSelect: getElement<HTMLSelectElement>("level-select"),
    levelSummaryText: getElement<HTMLElement>("level-summary-text"),
    levelFullDetails: getElement<HTMLElement>("level-full-details"),
    progressBarFill: getElement<HTMLDivElement>("progress-bar-fill"),
    progressLabel: getElement<HTMLSpanElement>("progress-label"),
    validationModal: getElement<HTMLDialogElement>("validation-modal"),
    validationErrorList: getElement<HTMLUListElement>("validation-error-list"),
    closeModalBtn: getElement<HTMLButtonElement>("close-modal-btn"),
    systemLogContainer: getElement<HTMLDivElement>("system-log-container"),
    systemLogPanel: getElement<HTMLDetailsElement>("system-log-panel"),
    advancedControls: getElement<HTMLDetailsElement>("advanced-controls"),
    btnSaveScript: getElement<HTMLButtonElement>("btn-save-script"),
    btnLoadScript: getElement<HTMLButtonElement>("btn-load-script"),
    btnLoadDefs: getElement<HTMLButtonElement>("btn-load-defs"),
    btnLoadGame: getElement<HTMLButtonElement>("btn-load-game"),
    btnResetDefs: getElement<HTMLButtonElement>("btn-reset-defs"),
    instructionsSidebar: getElement<HTMLElement>("instructions-sidebar"),
    instructionsResizerGutter: getElement<HTMLDivElement>("instructions-resizer-gutter"),
    sidebar: getElement<HTMLElement>("sidebar"),
    sidebarResizerGutter: getElement<HTMLDivElement>("sidebar-resizer-gutter"),
    btnToggleSidebar: getElement<HTMLButtonElement>("btn-toggle-sidebar"),
    btnHelpGuide: getElement<HTMLButtonElement>("btn-help-guide"),
    helpModal: getElement<HTMLDialogElement>("help-modal"),
    helpTitle: getElement<HTMLElement>("help-title"),
    completeHelpBtn: getElement<HTMLButtonElement>("complete-help-btn"),
    onboardingInterceptor: getElement<HTMLDivElement>("onboarding-interceptor"),
    onboardingNotice: getElement<HTMLDivElement>("onboarding-notice"),
    closeHelpBtn: getElement<HTMLButtonElement>("close-help-btn"),
    initialChoiceModal: getElement<HTMLDialogElement>("initial-choice-modal"),
    guidedChoiceBtn: getElement<HTMLButtonElement>("guided-choice-btn"),
    freeChoiceBtn: getElement<HTMLButtonElement>("free-choice-btn"),
    guidedChoiceUnavailable: getElement<HTMLElement>("guided-choice-unavailable"),
};

export function getPageElements(): typeof pageElements {
    return pageElements;
}
