import { afterEach, describe, expect, it, vi } from "vitest";
import { setupShellDownloadButton } from "@/pages/features/execution/scriptDownload";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("download do Shell gerado", () => {
    it("baixa o texto canônico sem alterações e libera a URL temporária", async () => {
        const script = "cat 'relatório.txt' | grep ERRO\n";
        const getCurrentShell = vi.fn(() => script);

        let clickHandler: (() => void) | undefined;
        const button = {
            addEventListener: (_type: string, listener: () => void) => {
                clickHandler = listener;
            },
        } as unknown as HTMLButtonElement;
        const anchor = {
            href: "",
            download: "",
            click: vi.fn(),
            remove: vi.fn(),
        };
        const append = vi.fn();
        const revokeObjectURL = vi.fn();
        let releaseUrl: (() => void) | undefined;
        const createObjectURL = vi.fn((_blob: Blob) => "blob:shellblocks");
        vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
        vi.stubGlobal("document", {
            createElement: () => anchor,
            body: { appendChild: append },
        });
        vi.stubGlobal("window", {
            setTimeout: (callback: () => void) => { releaseUrl = callback; return 1; },
        });

        setupShellDownloadButton(button, getCurrentShell);
        clickHandler?.();

        expect(getCurrentShell).toHaveBeenCalledOnce();
        expect(createObjectURL).toHaveBeenCalledOnce();
        const blob = createObjectURL.mock.calls[0]?.[0];
        expect(await blob.text()).toBe(script);
        expect(blob.type).toBe("text/x-shellscript;charset=utf-8");
        expect(anchor.download).toBe("shellblocks.sh");
        expect(anchor.href).toBe("blob:shellblocks");
        expect(append).toHaveBeenCalledWith(anchor);
        expect(anchor.click).toHaveBeenCalledOnce();
        expect(anchor.remove).toHaveBeenCalledOnce();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        releaseUrl?.();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:shellblocks");
    });

    it("não baixa texto de interface quando não há Shell válido", () => {
        const getCurrentShell = vi.fn(() => null);
        const click = vi.fn();
        const createElement = vi.fn();
        vi.stubGlobal("document", { createElement });
        const button = {
            addEventListener: (_type: string, listener: () => void) => { click.mockImplementation(listener); },
        } as unknown as HTMLButtonElement;
        setupShellDownloadButton(button, getCurrentShell);
        click();
        expect(getCurrentShell).toHaveBeenCalledOnce();
        expect(createElement).not.toHaveBeenCalled();
    });
});
