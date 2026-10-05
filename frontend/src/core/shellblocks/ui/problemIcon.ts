import * as Blockly from "blockly";

const BubbleMode = { CLOSED: "closed", PREVIEW: "preview", PINNED: "pinned" } as const;
type BubbleMode = (typeof BubbleMode)[keyof typeof BubbleMode];

/** A transient view of validation errors, never serialized as program state. */
export class ProblemIcon extends Blockly.icons.Icon implements Blockly.IHasBubble {
    static readonly TYPE = new Blockly.icons.IconType<ProblemIcon>("shellblocks_problem");
    private bubble: Blockly.bubbles.TextBubble | null = null;
    private text = "";
    private disposed = false;
    private mode: BubbleMode = BubbleMode.CLOSED;
    private openTimer: ReturnType<typeof setTimeout> | null = null;
    private closeTimer: ReturnType<typeof setTimeout> | null = null;
    private removeBlockHover: (() => void) | null = null;

    override getType(): Blockly.icons.IconType<ProblemIcon> { return ProblemIcon.TYPE; }
    override getSize(): Blockly.utils.Size { return new Blockly.utils.Size(28, 28); }
    override getWeight(): number { return 2; }
    override isShownWhenCollapsed(): boolean { return true; }
    // This icon also represents errors hidden inside a collapsed block.
    override updateCollapsed(): void {}
    override isClickableInFlyout(): boolean { return false; }

    override initView(listener: (event: PointerEvent) => void): void {
        if (this.svgRoot) return;
        super.initView(listener);
        const root = this.svgRoot!;
        root.classList.add("shellblocks-problem-icon");
        root.setAttribute("role", "button");
        root.setAttribute("aria-label", "Mostrar problemas do bloco");
        root.setAttribute("tabindex", "0");
        this.bindBlockHover();
        this.updateAria();
        root.addEventListener("keydown", (event) => {
            if (event.key === "Escape") void this.setBubbleVisible(false);
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                this.onClick();
            }
        });
        Blockly.utils.dom.createSvgElement("circle", { class: "shellblocks-problem-hitarea", cx: 14, cy: 14, r: 20, fill: "transparent" }, root);
        Blockly.utils.dom.createSvgElement("circle", { cx: 14, cy: 14, r: 12, fill: "#ffe08a", stroke: "#6b3900", "stroke-width": 2 }, root);
        Blockly.utils.dom.createSvgElement("path", { d: "M14 7v9 M14 20v1", stroke: "#482600", "stroke-width": 3, "stroke-linecap": "round" }, root);
    }

    setProblems(text: string): void {
        if (this.text === text) return;
        this.text = text;
        // The same anchored bubble serves hover and click; avoid a second tooltip.
        this.setTooltip("");
        this.bubble?.setText(text);
    }

    override onClick(): void { void this.setBubbleVisible(this.mode !== BubbleMode.PINNED); }
    bubbleIsVisible(): boolean { return this.bubble !== null; }
    getBubble(): Blockly.bubbles.TextBubble | null { return this.bubble; }

    async setBubbleVisible(visible: boolean): Promise<void> {
        this.cancelOpen();
        this.cancelClose();
        this.mode = visible ? BubbleMode.PINNED : BubbleMode.CLOSED;
        this.updateAria();
        if (!visible) {
            this.bubble?.dispose();
            this.bubble = null;
            return;
        }
        await this.openBubble();
    }

    private bindHover(element: HTMLElement | SVGElement): void {
        element.addEventListener("pointerenter", (event) => {
            if ("pointerType" in event && event.pointerType === "touch") return;
            this.enterPreview();
        });
        element.addEventListener("pointerleave", (event) => {
            if ("pointerType" in event && event.pointerType === "touch") return;
            this.leavePreview();
        });
    }

    private bindBlockHover(): void {
        const block = this.sourceBlock as Blockly.BlockSvg;
        const root = block.getSvgRoot();
        // Connected blocks nest SVG roots. Hovering a child must diagnose that
        // child, rather than opening every invalid ancestor's bubble as well.
        const ownsTarget = (target: EventTarget | null): boolean =>
            target instanceof Node && root.contains(target) &&
            !block.getChildren(false).some((child) => child.getSvgRoot().contains(target));
        const over = (event: PointerEvent): void => {
            if (event.pointerType !== "touch" && ownsTarget(event.target) && !ownsTarget(event.relatedTarget)) this.enterPreview();
        };
        const out = (event: PointerEvent): void => {
            if (event.pointerType !== "touch" && ownsTarget(event.target) && !ownsTarget(event.relatedTarget)) this.leavePreview();
        };
        root.addEventListener("pointerover", over);
        root.addEventListener("pointerout", out);
        this.removeBlockHover = () => {
            root.removeEventListener("pointerover", over);
            root.removeEventListener("pointerout", out);
        };
    }

    private enterPreview(): void {
        this.cancelClose();
        if (this.disposed || this.mode !== BubbleMode.CLOSED || this.openTimer !== null) return;
        // Require a short dwell so merely crossing a block does not open a preview.
        this.openTimer = setTimeout(() => {
            this.openTimer = null;
            this.mode = BubbleMode.PREVIEW;
            this.updateAria();
            void this.openBubble();
        }, 220);
    }

    private leavePreview(): void {
        this.cancelOpen();
        if (this.mode !== BubbleMode.PREVIEW) return;
        this.cancelClose();
        // Allow crossing the gap between block and bubble without flicker.
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            if (this.mode === BubbleMode.PREVIEW) void this.setBubbleVisible(false);
        }, 180);
    }

    private cancelOpen(): void {
        if (this.openTimer !== null) clearTimeout(this.openTimer);
        this.openTimer = null;
    }

    private cancelClose(): void {
        if (this.closeTimer !== null) clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }

    private updateAria(): void {
        this.svgRoot?.setAttribute("aria-expanded", String(this.mode !== BubbleMode.CLOSED));
        this.svgRoot?.setAttribute("aria-pressed", String(this.mode === BubbleMode.PINNED));
    }

    private async openBubble(): Promise<void> {
        await Blockly.renderManagement.finishQueuedRenders();
        if (this.disposed || this.mode === BubbleMode.CLOSED || this.bubble) return;
        const block = this.sourceBlock as Blockly.BlockSvg;
        const box = block.getSvgRoot().getBBox();
        this.bubble = new Blockly.bubbles.TextBubble(this.text, block.workspace, this.anchor(), new Blockly.utils.Rect(box.y, box.y + box.height, box.x, box.x + box.width));
        this.bubble.setColour("#fff3cf");
        this.bindHover(this.bubble.getFocusableElement());
        this.bubble.getFocusableElement().addEventListener("keydown", (event) => {
            if (event instanceof KeyboardEvent && event.key === "Escape") {
                void this.setBubbleVisible(false);
                Blockly.getFocusManager().focusNode(this);
            }
        });
    }

    private anchor(): Blockly.utils.Coordinate {
        return Blockly.utils.Coordinate.sum(this.workspaceLocation, new Blockly.utils.Coordinate(14, 14));
    }

    override onLocationChange(origin: Blockly.utils.Coordinate): void {
        super.onLocationChange(origin);
        this.bubble?.setAnchorLocation(this.anchor());
    }

    override dispose(): void {
        this.disposed = true;
        this.removeBlockHover?.();
        this.removeBlockHover = null;
        this.cancelOpen();
        this.cancelClose();
        this.mode = BubbleMode.CLOSED;
        this.bubble?.dispose();
        this.bubble = null;
        super.dispose();
    }
}
