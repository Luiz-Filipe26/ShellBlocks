import * as Blockly from "blockly";
import type { CLIValueType } from "../types/cli";
import text from "@/assets/icons/lucid/type.svg?raw";
import number from "@/assets/icons/lucid/hash.svg?raw";
import path from "@/assets/icons/lucid/map-pin.svg?raw";
import folder from "@/assets/icons/lucid/folder.svg?raw";

const ICON_SIZE = 16;

const icons = {
    string: { name: "type", svg: text },
    number: { name: "hash", svg: number },
    file: { name: "map-pin", svg: path },
    folder: { name: "folder", svg: folder },
} satisfies Record<CLIValueType, { name: string; svg: string }>;

/** Passive inline SVG inherits the renderer's label colour; no serialized value. */
export class OperandTypeIcon extends Blockly.FieldLabel {
    readonly iconName: string;
    private icon: Element | null = null;

    constructor(private readonly operandType: CLIValueType) {
        super("");
        this.iconName = icons[operandType].name;
        this.size_ = new Blockly.utils.Size(ICON_SIZE, ICON_SIZE);
    }

    override initView(): void {
        super.initView();
        const icon = Blockly.utils.xml.textToDom(icons[this.operandType].svg);
        icon.setAttribute("width", String(ICON_SIZE));
        icon.setAttribute("height", String(ICON_SIZE));
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("focusable", "false");
        icon.setAttribute("pointer-events", "none");
        this.fieldGroup_!.appendChild(icon);
        this.icon = icon;
    }

    protected override render_(): void {
        this.icon!.setAttribute("style", `color: ${getComputedStyle(this.textElement_!).fill}`);
    }

    protected override updateSize_(): void {
        this.size_ = new Blockly.utils.Size(ICON_SIZE, ICON_SIZE);
    }
}
