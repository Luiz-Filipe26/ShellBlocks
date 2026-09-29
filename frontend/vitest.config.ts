import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "shellblocks": resolve("src/core/shellblocks/index.ts"),
            "@": resolve("src"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        restoreMocks: true,
    },
});
