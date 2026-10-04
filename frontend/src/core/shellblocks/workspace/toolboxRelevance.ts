import * as Blockly from "blockly";
import { FIELDS } from "../constants/blockIds";
import { ToolboxOptionDropdown } from "../ui/toolboxOptionDropdown";

export type CategoryRelevance = "direct" | "ancestor";

/** Derive direct categories and ancestors from Blockly's flattened item tree. */
export function getRelevantCategories(
    items: readonly Blockly.IToolboxItem[],
    types: ReadonlySet<string>,
): Map<Blockly.ToolboxCategory, CategoryRelevance> {
    const categories = new Map<Blockly.ToolboxCategory, CategoryRelevance>();

    const markAncestors = (category: Blockly.ToolboxCategory): void => {
        for (let parent: Blockly.IToolboxItem | null = category; parent; parent = parent.getParent()) {
            if (!(parent instanceof Blockly.ToolboxCategory)) continue;
            const relevance = parent === category ? "direct" : "ancestor";
            if (relevance === "direct" || !categories.has(parent)) categories.set(parent, relevance);
        }
    };

    for (const item of items) {
        if (!(item instanceof Blockly.ToolboxCategory)) continue;
        const category = item;
        const contents = category.getContents();
        if (typeof contents !== "string" && contents.some((entry) =>
            entry.kind === "block" && "type" in entry && typeof entry.type === "string" && types.has(entry.type))) {
            markAncestors(category);
        }
    }
    return categories;
}

/** All static targets, including categories that are currently collapsed. */
export function getToolboxBlockTypes(items: readonly Blockly.IToolboxItem[]): Set<string> {
    const types = new Set<string>();
    for (const item of items) {
        if (!(item instanceof Blockly.ToolboxCategory)) continue;
        const contents = item.getContents();
        if (typeof contents === "string") continue;
        for (const entry of contents) {
            if (entry.kind === "block" && "type" in entry && typeof entry.type === "string") types.add(entry.type);
        }
    }
    return types;
}

/** Owns only toolbox presentation; it knows nothing about levels or gestures. */
export class ToolboxRelevance {
    private targets: ReadonlyMap<string, ReadonlySet<string>> = new Map();
    private elements = new Map<Element, string>();
    private fields = new Set<ToolboxOptionDropdown>();

    setTargets(targets: ReadonlyMap<string, ReadonlySet<string>>, toolbox: Blockly.Toolbox): void {
        this.targets = targets;
        this.refresh(toolbox);
    }

    refresh(toolbox: Blockly.Toolbox): void {
        this.clearPresentation();
        for (const [category, relevance] of getRelevantCategories(toolbox.getToolboxItems(), new Set(this.targets.keys()))) {
            const element = category.getClickTarget() ?? category.getDiv();
            if (element) {
                this.mark(element, relevance === "direct"
                    ? "shellblocks-toolbox-relevant-category"
                    : "shellblocks-toolbox-relevant-category-ancestor");
            }
        }
        for (const block of toolbox.getFlyout()?.getWorkspace().getAllBlocks(false) ?? []) {
            const flags = this.targets.get(block.type);
            if (!flags || block.isInsertionMarker()) continue;
            this.mark(block.pathObject.svgPath, "shellblocks-toolbox-relevant-block");
            const field = block.getField(FIELDS.FLAG);
            if (field instanceof ToolboxOptionDropdown) {
                field.setRelevantFlags(flags);
                this.fields.add(field);
            }
        }
    }

    private mark(element: Element, className: string): void {
        element.classList.add(className);
        this.elements.set(element, className);
    }

    private clearPresentation(): void {
        for (const [element, className] of this.elements) element.classList.remove(className);
        this.elements.clear();
        for (const field of this.fields) field.setRelevantFlags(new Set());
        this.fields.clear();
    }

    dispose(): void {
        this.clearPresentation();
        this.targets = new Map();
    }
}
