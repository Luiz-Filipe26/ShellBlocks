import { getToolboxBlockTypes } from "@/core/shellblocks/workspace/toolboxRelevance";
import { OverlayToolbox } from "@/core/shellblocks/workspace/overlayToolbox";
import type { CliDefinitions } from "@/core/shellblocks/types/cli";
import type { Level } from "../session/types";
import { guidanceIdentity, resolveToolboxGuidance } from "../session/toolboxGuidance";

export function setupToolboxGuidance(
    toolbox: OverlayToolbox,
    levelSelect: HTMLSelectElement,
    getLevel: () => Level | undefined,
    getDefinitions: () => CliDefinitions,
    diagnose: (message: string) => void,
): { refresh: () => void; dispose: () => void } {
    const diagnosed = new Set<string>();
    const refresh = (): void => {
        const level = getLevel();
        if (!level) {
            toolbox.setRelevantBlocks(new Map());
            return;
        }
        const { targets, unresolved } = resolveToolboxGuidance(level.toolboxGuidance, getDefinitions(), getToolboxBlockTypes(toolbox.getToolboxItems()));
        toolbox.setRelevantBlocks(targets);
        for (const { reference, reason } of unresolved) {
            const identity = `${level?.id}:${guidanceIdentity(reference)}:${reason}`;
            if (diagnosed.has(identity)) continue;
            diagnosed.add(identity);
            diagnose(`toolboxGuidance ${identity}: destaque ignorado.`);
        }
    };
    levelSelect.addEventListener("change", refresh);
    const unsubscribe = toolbox.onContentsChanged(refresh);
    refresh();
    return { refresh, dispose: () => {
        levelSelect.removeEventListener("change", refresh);
        unsubscribe();
        toolbox.setRelevantBlocks(new Map());
        diagnosed.clear();
    } };
}
