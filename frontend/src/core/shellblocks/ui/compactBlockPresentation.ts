import * as Blockly from "blockly";

/** Presentation token supplied by the host UI; the core does not choose breakpoints. */
export function compactBlockPresentation(): boolean {
    if (typeof getComputedStyle !== "function") return false; // Headless Blockly has no presentation surface.
    return getComputedStyle(document.documentElement).getPropertyValue("--compact-block-fields").trim() === "1";
}

export class ParentIndicatorField extends Blockly.FieldLabel {
    constructor(text: string, private readonly command: string) { super(text); }
    protected override getText_(): string | null {
        if (compactBlockPresentation() && this.getValue()) return `(${this.command})`;
        return super.getText_();
    }
}

/** Only the main toolbox supplies the command context; other flyouts do not. */
export function isContextualToolboxFlyout(block: Blockly.Block | null): boolean {
    const workspace = block?.workspace;
    return workspace instanceof Blockly.WorkspaceSvg && workspace.isFlyout
        && workspace.targetWorkspace?.getToolbox()?.getFlyout()?.getWorkspace() === workspace;
}

export class ContextualParentIndicatorField extends ParentIndicatorField {
    override initModel(): void {
        super.initModel();
        this.setVisible(!isContextualToolboxFlyout(this.getSourceBlock()));
    }
}
