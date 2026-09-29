import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        restoreMocks: true,
        testTimeout: 15_000,
        hookTimeout: 120_000,
    },
});
