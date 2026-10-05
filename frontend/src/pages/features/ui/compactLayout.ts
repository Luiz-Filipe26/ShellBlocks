/** Space, rather than input-device identity, determines panel composition. */
export const COMPACT_LAYOUT_QUERY = "(max-width: 1100px), (max-height: 500px)";
export function compactLayout(): boolean { return window.matchMedia(COMPACT_LAYOUT_QUERY).matches; }

export function setupCompactLayout(elements: {
    instructions: HTMLElement; results: HTMLElement; controls: HTMLElement;
    instructionsButton: HTMLButtonElement; resultsButton: HTMLButtonElement;
    closeInstructions: HTMLButtonElement; closeResults: HTMLButtonElement;
    runButton: HTMLButtonElement; advancedControls: HTMLElement; systemLog: HTMLElement; toolbar: HTMLElement;
}): { dispose(): void } {
    const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const listeners = new AbortController();
    const { signal } = listeners;
    const runParent = elements.runButton.parentElement!;
    const runNext = elements.runButton.nextSibling;
    const secondary = [elements.toolbar, elements.advancedControls, elements.systemLog].map(element => ({ element, parent: element.parentElement!, next: element.nextSibling }));
    let panel: "instructions" | "results" | null = null;
    const initialInert = [elements.instructions.inert, elements.results.inert];
    function render(): void {
        document.documentElement.classList.toggle("compact-layout", media.matches);
        for (const [name, element, button] of [
            ["instructions", elements.instructions, elements.instructionsButton],
            ["results", elements.results, elements.resultsButton],
        ] as const) {
            const open = media.matches && panel === name;
            document.documentElement.classList.toggle(`compact-${name}-open`, open);
            element.inert = media.matches ? !open : initialInert[name === "instructions" ? 0 : 1];
            button.setAttribute("aria-expanded", String(open));
        }
        elements.closeResults.setAttribute("aria-label", media.matches ? "Fechar resultado" : "Recolher ou expandir resultados");
        if (media.matches) {
            elements.controls.appendChild(elements.runButton);
            for (const { element } of secondary) elements.results.appendChild(element);
        } else {
            runParent.insertBefore(elements.runButton, runNext);
            for (const { element, parent, next } of [...secondary].reverse()) parent.insertBefore(element, next);
        }
    }
    const toggle = (name: typeof panel): void => { panel = panel === name ? null : name; render(); };
    elements.instructionsButton.addEventListener("click", () => toggle("instructions"), { signal });
    elements.resultsButton.addEventListener("click", () => toggle("results"), { signal });
    for (const button of [elements.closeInstructions, elements.closeResults]) {
        button.addEventListener("click", () => {
            if (!media.matches) return;
            const trigger = panel === "instructions" ? elements.instructionsButton : elements.resultsButton;
            panel = null; render(); trigger.focus();
        }, { signal });
    }
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !media.matches || !panel || document.querySelector(".blockly-workspace-area.is-maximized")) return;
        panel = null; render(); event.preventDefault();
    }, { signal });
    media.addEventListener("change", () => { render(); window.dispatchEvent(new Event("resize")); }, { signal });
    render();
    return { dispose() {
        listeners.abort();
        runParent.insertBefore(elements.runButton, runNext);
        for (const { element, parent, next } of [...secondary].reverse()) parent.insertBefore(element, next);
        elements.instructions.inert = initialInert[0]; elements.results.inert = initialInert[1];
        for (const name of ["compact-layout", "compact-instructions-open", "compact-results-open"]) document.documentElement.classList.remove(name);
    } };
}
