export type ThemePreference = "light" | "system" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_PREFERENCE_KEY = "shellblocks_theme_preference";

/** The preference belongs to the page; Blockly receives only the resolved theme. */
export function setupTheme(control: HTMLElement, applyWorkspaceTheme: (theme: ResolvedTheme) => void): { dispose(): void } {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const radios = control.querySelectorAll<HTMLInputElement>('input[name="theme"]');
    let preference: ThemePreference = "system";
    try {
        const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
        if (stored === "light" || stored === "dark") preference = stored;
        else if (stored !== null) localStorage.removeItem(THEME_PREFERENCE_KEY);
    } catch {
        // Theme selection remains usable when browser storage is unavailable.
    }

    function render(): void {
        const resolved: ResolvedTheme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.style.colorScheme = resolved;
        for (const radio of radios) radio.checked = radio.value === preference;
        applyWorkspaceTheme(resolved);
    }

    function select(event: Event): void {
        const radio = event.target;
        if (!(radio instanceof HTMLInputElement) || !radio.checked) return;
        if (radio.value !== "light" && radio.value !== "system" && radio.value !== "dark") return;
        preference = radio.value;
        try {
            if (preference === "system") localStorage.removeItem(THEME_PREFERENCE_KEY);
            else localStorage.setItem(THEME_PREFERENCE_KEY, preference);
        } catch {
            // Storage failure must not prevent applying the user's choice now.
        }
        render();
    }
    function followSystem(): void { if (preference === "system") render(); }
    control.addEventListener("change", select);
    media.addEventListener("change", followSystem);
    render();
    return { dispose() {
        control.removeEventListener("change", select);
        media.removeEventListener("change", followSystem);
    } };
}
