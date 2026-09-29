import * as esbuild from "esbuild";
import { raw } from "esbuild-raw-plugin";

await esbuild.build({
    entryPoints: ["src/server.ts"],
    bundle: true,
    platform: "node",
    target: "node20",
    loader: { ".html": "text" },
    plugins: [raw()],
    outfile: "dist/server.js",
});
