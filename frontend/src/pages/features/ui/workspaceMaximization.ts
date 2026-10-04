import * as Blockly from "blockly";

/** Page layout only: the same Blockly workspace remains mounted in both states. */
export function setupWorkspaceMaximization(elements: {
    surface: HTMLElement;
    button: HTMLButtonElement;
    maximizeIcon: HTMLElement;
    minimizeIcon: HTMLElement;
    outside: HTMLElement[];
}, workspace: Blockly.WorkspaceSvg): { dispose: () => void } {
    const { surface, button, maximizeIcon, minimizeIcon, outside } = elements;
    const listeners = new AbortController();
    const { signal } = listeners;
    let maximized = false;
    let previousOverflow = "";
    let externalState: { element: HTMLElement; visibility: string; inert: boolean }[] = [];

    function resize(): void {
        const { scrollX, scrollY } = workspace;
        Blockly.svgResize(workspace);
        if (workspace.scrollX !== scrollX || workspace.scrollY !== scrollY) workspace.scroll(scrollX, scrollY);
    }

    function updateControl(): void {
        const action = maximized ? "Restaurar workspace" : "Maximizar workspace";
        button.setAttribute("aria-label", action);
        button.setAttribute("aria-pressed", String(maximized));
        button.title = action;
        maximizeIcon.hidden = maximized;
        minimizeIcon.hidden = !maximized;
    }

    function setMaximized(value: boolean): void {
        if (maximized === value) return;
        maximized = value;
        if (value) {
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            externalState = outside.map((element) => ({
                element, visibility: element.style.visibility, inert: element.inert,
            }));
            for (const { element } of externalState) {
                element.style.visibility = "hidden";
                element.inert = true;
            }
        } else {
            document.body.style.overflow = previousOverflow;
            for (const { element, visibility, inert } of externalState) {
                element.style.visibility = visibility;
                element.inert = inert;
            }
            externalState = [];
        }
        surface.classList.toggle("is-maximized", maximized);
        updateControl();
        resize();
    }

    // Mouse activation must not move focus away from the selected Blockly block.
    button.addEventListener("pointerdown", (event) => event.preventDefault(), { signal });
    button.addEventListener("click", () => setMaximized(!maximized), { signal });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !maximized) return;
        setMaximized(false);
        event.preventDefault();
    }, { signal });
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    updateControl();

    return { dispose: () => {
        listeners.abort();
        observer.disconnect();
        setMaximized(false);
    } };
}
