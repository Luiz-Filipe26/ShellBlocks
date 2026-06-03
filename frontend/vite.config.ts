import { defineConfig, loadEnv } from "vite";
import path from "path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        resolve: {
            tsconfigPaths: true,
        },
        plugins: [viteSingleFile()],
        root: "src/pages",
        envDir: path.resolve(__dirname),
        publicDir: path.resolve(__dirname, "public"),

        server: {
            port: Number(env.VITE_FRONTEND_DEV_PORT) || 5173,
            strictPort: true,
            proxy: {
                "/api": {
                    target: env.VITE_BACKEND_URL || "http://localhost:7000",
                    changeOrigin: true,
                    secure: false,
                },
            },
        },

        build: {
            outDir: path.resolve(__dirname, "dist"),
            emptyOutDir: true,
        },
    };
});
