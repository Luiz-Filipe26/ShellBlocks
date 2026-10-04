export function setupShellDownloadButton(
    button: HTMLButtonElement,
    getCurrentShell: () => string | null,
): void {
    button.addEventListener("click", () => {
        const content = getCurrentShell();
        if (content === null) return;
        downloadShellFile(content);
    });
}

export function downloadShellFile(content: string): void {
    const blob = new Blob([content], { type: "text/x-shellscript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "shellblocks.sh";
    try {
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}
