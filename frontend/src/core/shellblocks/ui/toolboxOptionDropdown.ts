import { compactBlockPresentation, isContextualToolboxFlyout } from "./compactBlockPresentation";
import { OverlayToolbox } from "../workspace/overlayToolbox";
import * as Blockly from "blockly";

/** Semantic values stay unchanged; HTML menu labels carry presentation only. */
export class ToolboxOptionDropdown extends Blockly.FieldDropdown {
    private flyoutSelection: { toolbox: OverlayToolbox; itemId: string | null; visible: boolean } | null = null;
    private relevantFlags: ReadonlySet<string> = new Set();
    private menuLabels = new Map<string, HTMLElement>();

    constructor(pairs: [string, string][], validator: Blockly.FieldDropdownValidator) {
        super(function (this: Blockly.FieldDropdown) {
            const field = this as ToolboxOptionDropdown;
            field.menuLabels?.clear();
            return pairs.map(([label, flag]) => {
                if (!field.getSourceBlock()?.isInFlyout || !field.relevantFlags?.size) return [label, flag];
                const element = document.createElement("span");
                element.textContent = label;
                element.title = label;
                element.classList.toggle("shellblocks-toolbox-relevant-option", field.relevantFlags.has(flag));
                field.menuLabels.set(flag, element);
                return [element, flag];
            });
        }, validator);
    }

    protected override getText_(): string | null {
        if (isContextualToolboxFlyout(this.getSourceBlock())) {
            const fullText = super.getText_();
            if (fullText === null) return null;
            const characters = Array.from(fullText);
            return characters.length <= 12 ? fullText : characters.slice(0, 9).join("") + "...";
        }
        return compactBlockPresentation() ? this.getValue() : super.getText_();
    }

    override isClickableInFlyout(): boolean { return true; }

    protected override onMouseDown_(event: PointerEvent): void {
        const block = this.getSourceBlock();
        const workspace = block?.workspace;
        const toolbox = workspace instanceof Blockly.WorkspaceSvg && block?.isInFlyout
            ? workspace.targetWorkspace?.getToolbox() : null;
        this.flyoutSelection = toolbox instanceof OverlayToolbox ? {
            toolbox, itemId: toolbox.getSelectedItem()?.getId() ?? null,
            visible: toolbox.getFlyout()!.isVisible(),
        } : null;
        super.onMouseDown_(event);
    }

    protected override showEditor_(event?: MouseEvent): void {
        // A field click is confirmed by Blockly here; drags never enter this hook.
        const selection = this.flyoutSelection;
        this.flyoutSelection = null;
        if (selection) selection.toolbox.restoreFlyoutSelection(selection);
        super.showEditor_(event);
    }

    override dispose(): void {
        this.flyoutSelection = null;
        this.menuLabels.clear();
        super.dispose();
    }

    setRelevantFlags(flags: ReadonlySet<string>): void {
        this.relevantFlags = flags;
        for (const [flag, label] of this.menuLabels) {
            label.classList.toggle("shellblocks-toolbox-relevant-option", flags.has(flag));
        }
    }

    protected override dropdownDispose_(): void {
        super.dropdownDispose_();
        this.menuLabels.clear();
    }
}
