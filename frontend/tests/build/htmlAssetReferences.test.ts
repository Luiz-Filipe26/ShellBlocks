import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { transformHtmlAssetReferences } from "../../vite.config";

describe("Vite HTML asset references", () => {
    const htmlRoot = path.resolve("src/pages");

    it("rewrites relative local src values to Vite filesystem URLs in dev", async () => {
        const html = '<img src="../assets/icons/lucid/trash.svg">';

        await expect(
            transformHtmlAssetReferences(html, htmlRoot, true),
        ).resolves.toContain(
            `/@fs${pathToFileURL(path.resolve(htmlRoot, "../assets/icons/lucid/trash.svg")).pathname}`,
        );
    });

    it("limits rewriting to image assets", async () => {
        const html = '<script src="./index.ts"></script><img src="../assets/icons/lucid/trash.svg">';

        const transformed = await transformHtmlAssetReferences(
            html,
            htmlRoot,
            true,
        );

        expect(transformed).toContain('<script src="./index.ts"></script>');
        expect(transformed).toContain("/@fs");
    });

    it("preserves external, data, absolute, and fragment URLs", async () => {
        const html = [
            '<img src="http://example.test/icon.svg">',
            '<img src="https://example.test/icon.svg">',
            '<img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E">',
            '<img src="blob:http://localhost/icon">',
            '<img src="/icons/icon.svg">',
            '<img src="//cdn.example.test/icon.svg">',
            '<img src="#icon">',
        ].join("");

        await expect(
            transformHtmlAssetReferences(html, htmlRoot, true),
        ).resolves.toBe(html);
    });

    it("leaves HTML unchanged for Vite's production asset pipeline", async () => {
        const html = '<img src="../assets/icons/lucid/trash.svg">';

        await expect(
            transformHtmlAssetReferences(html, htmlRoot, false),
        ).resolves.toBe(html);
    });
});
