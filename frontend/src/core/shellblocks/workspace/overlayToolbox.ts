import * as Blockly from "blockly";

/** Categories keep their real dimensions for flyout positioning, but reserve no canvas space. */
export class OverlayWorkspaceMetrics extends Blockly.MetricsManager {
    override getAbsoluteMetrics(): Blockly.MetricsManager.AbsoluteMetrics {
        return { left: 0, top: 0 };
    }

    override getViewMetrics(workspaceCoordinates = false): Blockly.MetricsManager.ContainerRegion {
        const size = this.getSvgMetrics();
        const scale = workspaceCoordinates ? this.workspace_.scale : 1;
        return {
            width: size.width / scale,
            height: size.height / scale,
            left: -this.workspace_.scrollX / scale,
            top: -this.workspace_.scrollY / scale,
        };
    }
}

/** Native categories/flyout, with an explicit presentation-only collapse control. */
export class OverlayToolbox extends Blockly.Toolbox {
    private handle: HTMLButtonElement | null = null;
    private toolboxLayer: SVGForeignObjectElement | null = null;
    private expanded = true;
    private restoreFlyout = false;
    private savedSelectionId: string | null = null;

    override init(): void {
        super.init();
        this.HtmlDiv!.classList.add("shellblocks-toolbox-overlay");
        const container = this.workspace_.getInjectionDiv();
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "shellblocks-toolbox-handle";
        handle.setAttribute("aria-controls", this.HtmlDiv!.id);
        handle.addEventListener("click", () => this.setExpanded(!this.expanded));
        // Blockly also listens for mouse/touch events at document level.
        for (const type of ["pointerdown", "mousedown", "touchstart", "click"]) {
            handle.addEventListener(type, (event) => {
                event.stopPropagation();
                if (type === "pointerdown" || type === "mousedown") event.preventDefault();
            });
        }
        container.appendChild(handle);
        this.handle = handle;

        // Keep native bubbles in their original SVG/event hierarchy. A
        // foreignObject places the native HTML categories and SVG flyout above
        // blocks but below bubbles, without depending on generated descendants.
        const layer = document.createElementNS(Blockly.utils.dom.SVG_NS, "foreignObject");
        layer.classList.add("shellblocks-toolbox-layer");
        layer.setAttribute("width", "100%");
        layer.setAttribute("height", "100%");
        const surface = document.createElement("div");
        surface.className = "shellblocks-toolbox-surface";
        surface.appendChild(this.HtmlDiv!);
        surface.appendChild(this.getFlyout()!.getWorkspace().getParentSvg());
        surface.addEventListener("pointerdown", (event) => event.stopPropagation());
        layer.appendChild(surface);
        const bubbles = this.workspace_.getBubbleCanvas();
        bubbles.parentNode!.insertBefore(layer, bubbles);
        this.toolboxLayer = layer;
        this.updateHandle();
    }

    override onTreeBlur(nextTree: Blockly.IFocusableTree | null): void {
        if (document.activeElement !== this.handle) super.onTreeBlur(nextTree);
    }

    isExpanded(): boolean { return this.expanded; }

    setExpanded(expanded: boolean): void {
        if (this.expanded === expanded) return;
        const flyout = this.getFlyout();
        if (!expanded) {
            this.restoreFlyout = flyout?.isVisible() ?? false;
            this.savedSelectionId = this.getSelectedItem()?.getId() ?? null;
            flyout?.hide();
        }
        this.expanded = expanded;
        this.setVisible(expanded);
        if (expanded) {
            this.position();
            if (this.restoreFlyout) {
                const selection = this.savedSelectionId
                    ? this.getToolboxItemById(this.savedSelectionId) : null;
                if (this.getSelectedItem() !== selection) this.setSelectedItem(selection);
                else this.refreshSelection();
            }
            this.savedSelectionId = null;
        }
        this.updateHandle();
    }

    override position(): void {
        if (this.expanded) super.position();
        this.updateHandle();
    }

    // Blockly's category-resize callback normally translates and resizes the
    // workspace. An overlay needs only its own positioning and hit-test bounds.
    override handleToolboxItemResize(): void {
        this.position();
        this.workspace_.recordDragTargets();
    }

    private updateHandle(): void {
        if (!this.handle) return;
        this.handle.style.left = `${this.expanded ? this.getWidth() : 0}px`;
        this.handle.setAttribute("aria-expanded", String(this.expanded));
        const label = this.expanded ? "Recolher toolbox" : "Expandir toolbox";
        this.handle.setAttribute("aria-label", label);
        this.handle.title = label;
        this.handle.textContent = this.expanded ? "‹" : "›";
    }

    override dispose(): void {
        this.handle?.remove();
        this.handle = null;
        super.dispose();
        this.toolboxLayer?.remove();
        this.toolboxLayer = null;
    }
}
