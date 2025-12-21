function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Elemento ausente no HTML: ${id}`);
    return element as T;
}

const pageElements = {
    blocklyArea: getElement<HTMLDivElement>("blockly-area"),
    codeOutput: getElement<HTMLPreElement>("code-output"),
    cliOutput: getElement<HTMLPreElement>("cli-output"),
    runBtn: getElement<HTMLButtonElement>("run-btn"),
    clearBtn: getElement<HTMLButtonElement>("clear-btn"),
    appHeader: getElement<HTMLElement>("app-header"),
    headerToggleBtn: getElement<HTMLButtonElement>("header-toggle-btn"),
    levelSelect: getElement<HTMLSelectElement>("level-select"),
    levelSummaryText: getElement<HTMLElement>("level-summary-text"),
    levelFullDetails: getElement<HTMLElement>("level-full-details"),
    validationModal: getElement<HTMLDialogElement>("validation-modal"),
    validationErrorList: getElement<HTMLUListElement>("validation-error-list"),
    closeModalBtn: getElement<HTMLButtonElement>("close-modal-btn"),
    systemLogContainer: getElement<HTMLDivElement>("system-log-container"),
    btnSaveScript: getElement<HTMLButtonElement>("btn-save-script"),
    btnLoadScript: getElement<HTMLButtonElement>("btn-load-script"),
    btnLoadDefs: getElement<HTMLButtonElement>("btn-load-defs"),
    btnLoadGame: getElement<HTMLButtonElement>("btn-load-game"),
    btnResetDefs: getElement<HTMLButtonElement>("btn-reset-defs"),
    sidebar: getElement<HTMLElement>("sidebar"),
    sidebarResizerGutter: getElement<HTMLDivElement>("sidebar-resizer-gutter"),
    btnToggleSidebar: getElement<HTMLButtonElement>("btn-toggle-sidebar"),
    btnHelpGuide: getElement<HTMLButtonElement>("btn-help-guide"),
    helpModal: getElement<HTMLDialogElement>("help-modal"),
    closeHelpBtn: getElement<HTMLButtonElement>("close-help-btn"),
};

export function getPageElements(): typeof pageElements {
    return pageElements;
}
