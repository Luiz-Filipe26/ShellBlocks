import { defineConfig, loadEnv, type Plugin } from "vite";
import path from "node:path";
import { createRequire } from "node:module";
import { viteSingleFile } from "vite-plugin-singlefile";
import posthtml from "posthtml";
import type PostHTML from "posthtml";

type PostHTMLComponentFactory = (
    options: { root: string },
) => PostHTML.Plugin<unknown>;

// The package's declaration omits its callable CommonJS export.
const postHTMLComponentModule: unknown = createRequire(import.meta.url)(
    "posthtml-component",
);
if (typeof postHTMLComponentModule !== "function") {
    throw new TypeError("posthtml-component não exporta uma factory válida.");
}
const components = postHTMLComponentModule as PostHTMLComponentFactory;

type PostHTMLProcessOptions = PostHTML.Options & {
    recognizeSelfClosing: boolean;
};
// PostHTML forwards parser options at runtime, though its public type omits this documented option.
const postHTMLProcessOptions: PostHTMLProcessOptions = {
    recognizeSelfClosing: true,
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const componentRoots = new Map<string, Set<string>>();

    function getComponentRoot(pageFilename: string): string {
        return path.join(path.dirname(pageFilename), "components");
    }

    return {
        resolve: {
            tsconfigPaths: true,
        },
        plugins: [
            {
                name: "shellblocks-html-components",
                configureServer(server) {
                    server.watcher.on("change", (file) => {
                        reloadPagesUsingComponent(file);
                    });

                    function reloadPagesUsingComponent(file: string): void {
                        if (!file.endsWith(".html")) return;

                        const filePath = path.resolve(file);
                        for (const [
                            componentRoot,
                            pagePaths,
                        ] of componentRoots) {
                            const relativePath = path.relative(
                                componentRoot,
                                filePath,
                            );
                            if (
                                relativePath === ".." ||
                                relativePath.startsWith(`..${path.sep}`) ||
                                path.isAbsolute(relativePath)
                            ) {
                                continue;
                            }

                            for (const pagePath of pagePaths) {
                                server.ws.send({
                                    type: "full-reload",
                                    path: pagePath,
                                });
                            }
                        }
                    }
                },
                transformIndexHtml: {
                    order: "pre",
                    async handler(html, context) {
                        const componentRoot = getComponentRoot(
                            context.filename,
                        );
                        const pagePaths =
                            componentRoots.get(componentRoot) ??
                            new Set<string>();
                        pagePaths.add(context.path);
                        componentRoots.set(componentRoot, pagePaths);
                        context.server?.watcher.add(componentRoot);

                        const result = await posthtml([
                            components({ root: componentRoot }),
                        ]).process(html, postHTMLProcessOptions);
                        return result.html;
                    },
                },
            } satisfies Plugin,
            viteSingleFile(),
        ],
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
