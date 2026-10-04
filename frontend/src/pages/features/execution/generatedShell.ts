import * as Blockly from "blockly";
import * as ShellBlocks from "shellblocks";
import { generateShellScript } from "@/core/shellblocks/generation/scriptGenerator";

export type GeneratedShell =
    | { readonly kind: "script"; readonly content: string }
    | { readonly kind: "empty" }
    | { readonly kind: "error"; readonly cause: unknown };

/** Produces the canonical Shell value shared by the preview and download. */
export function generateCurrentShell(
    workspace: Blockly.WorkspaceSvg,
): GeneratedShell {
    const ast = ShellBlocks.serializeWorkspaceToAST(workspace);
    if (!ast) return { kind: "empty" };

    try {
        return { kind: "script", content: generateShellScript(ast) };
    } catch (cause) {
        return { kind: "error", cause };
    }
}
