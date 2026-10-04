import { ToolboxRelevance } from "./toolboxRelevance";
import * as Blockly from "blockly";

interface FlyoutSelection {
    itemId: string | null;
    visible: boolean;
}

/** Record flyout origin without inferring it from pointer position or block type. */
export class OverlayFlyout extends Blockly.VerticalFlyout {
    override show(definition: Parameters<Blockly.VerticalFlyout["show"]>[0]): void {
        super.show(definition);
        const toolbox = this.getTargetWorkspace().getToolbox();
        if (toolbox instanceof OverlayToolbox) toolbox.refreshRelevance();
    }

    override createBlock(originalBlock: Blockly.BlockSvg): Blockly.BlockSvg {
        const toolbox = this.getTargetWorkspace().getToolbox();
        return toolbox instanceof OverlayToolbox
            ? toolbox.createFlyoutBlock(() => super.createBlock(originalBlock))
            : super.createBlock(originalBlock);
    }

    override getClientRect(): Blockly.utils.Rect | null {
        const toolbox = this.getTargetWorkspace().getToolbox();
        return toolbox instanceof OverlayToolbox && toolbox.isTemporarilyRetracted()
            ? null : super.getClientRect();
    }
}

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
    private readonly relevance = new ToolboxRelevance();
    private readonly contentsListeners = new Set<() => void>();

    setRelevantBlocks(targets: ReadonlyMap<string, ReadonlySet<string>>): void {
        this.relevance.setTargets(targets, this);
    }

    refreshRelevance(): void { this.relevance.refresh(this); }

    onContentsChanged(listener: () => void): () => void {
        this.contentsListeners.add(listener);
        return () => this.contentsListeners.delete(listener);
    }

    override render(definition: Parameters<Blockly.Toolbox["render"]>[0]): void {
        super.render(definition);
        for (const listener of this.contentsListeners) listener();
        this.refreshRelevance();
    }

    private handle: HTMLButtonElement | null = null;
    private toolboxLayer: SVGForeignObjectElement | null = null;
    private expanded = true;
    private restoreFlyout = false;
    private savedSelectionId: string | null = null;
    private flyoutSelectionCandidate: FlyoutSelection | null = null;
    private restoringFlyoutSelection = false;
    private flyoutDrag: {
        blockId: string | null;
        retracted: boolean;
        confirmed: boolean;
        selection: FlyoutSelection | null;
    } | null = null;
    private dragFrame: number | null = null;
    private dragListeners: AbortController | null = null;
    private readonly onBlockDrag = (event: Blockly.Events.Abstract): void => {
        const drag = this.flyoutDrag;
        if (!drag || !(event instanceof Blockly.Events.BlockDrag) || event.blockId !== drag.blockId) return;
        if (event.isStart) {
            drag.confirmed = true;
            if (this.workspace_.isDragging()) {
                drag.retracted = true;
                this.updateDragPresentation();
            }
        } else if (!event.isStart) this.finishFlyoutDrag();
    };
    private readonly cancelFlyoutDrag = (): void => {
        this.flyoutSelectionCandidate = null;
        if (!this.flyoutDrag) return;
        // Cancellation can precede delivery of the queued BlockDrag event.
        if (this.workspace_.isDragging()) this.flyoutDrag.confirmed = true;
        try { this.workspace_.cancelCurrentGesture(); }
        finally { this.finishFlyoutDrag(); }
    };
    private readonly onDragKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== "Escape" || !this.flyoutDrag) return;
        this.cancelFlyoutDrag();
        event.preventDefault();
        event.stopPropagation();
    };

    constructor(workspace: Blockly.WorkspaceSvg) {
        super(workspace);
        workspace.addChangeListener(this.onBlockDrag);
    }

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
        this.dragListeners = new AbortController();
        const signal = this.dragListeners.signal;
        const flyoutWorkspace = this.getFlyout()!.getWorkspace();
        flyoutWorkspace.getParentSvg().addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const target = event.target;
            if (target instanceof Node && flyoutWorkspace.getTopBlocks(false)
                .some((block) => block.getSvgRoot().contains(target))) {
                this.captureFlyoutSelection();
            }
        }, { capture: true, signal });
        window.addEventListener("pointerup", () => {
            this.flyoutSelectionCandidate = null;
        }, { capture: true, signal });
        window.addEventListener("keydown", this.onDragKeyDown, { capture: true, signal });
        window.addEventListener("pointercancel", this.cancelFlyoutDrag, { capture: true, signal });
        window.addEventListener("blur", this.cancelFlyoutDrag, { signal });
        this.updateHandle();
    }

    override onTreeBlur(nextTree: Blockly.IFocusableTree | null): void {
        if (!this.flyoutDrag && document.activeElement !== this.handle) super.onTreeBlur(nextTree);
    }

    override autoHide(onlyClosePopups: boolean): void {
        if (!this.flyoutDrag) super.autoHide(onlyClosePopups);
    }

    protected captureFlyoutSelection(): void {
        // Chromium can clear selection in bringToFront(), before createBlock.
        this.flyoutSelectionCandidate = {
            itemId: this.getSelectedItem()?.getId() ?? null,
            visible: this.getFlyout()!.isVisible(),
        };
    }

    protected override updateFlyout_(
        oldItem: Blockly.ISelectableToolboxItem | null,
        newItem: Blockly.ISelectableToolboxItem | null,
    ): void {
        // setSelectedItem still updates selection/ARIA and emits its event;
        // only its show()/scrollToStart() side effects are skipped on recovery.
        if (!this.restoringFlyoutSelection) super.updateFlyout_(oldItem, newItem);
    }

    /** Re-present existing content after Chromium's focusout, without show/scrollToStart. */
    restoreFlyoutSelection(selection: FlyoutSelection): void {
        const item = selection.itemId ? this.getToolboxItemById(selection.itemId) : null;
        this.restoringFlyoutSelection = true;
        try {
            if (this.getSelectedItem() !== item) this.setSelectedItem(item);
            const flyout = this.getFlyout()!;
            if (flyout.isVisible() !== selection.visible) flyout.setVisible(selection.visible);
        } finally { this.restoringFlyoutSelection = false; }
    }

    createFlyoutBlock(create: () => Blockly.BlockSvg): Blockly.BlockSvg {
        if (this.flyoutDrag) this.finishFlyoutDrag();
        this.flyoutDrag = {
            blockId: null, retracted: false, confirmed: false,
            selection: this.flyoutSelectionCandidate,
        };
        this.flyoutSelectionCandidate = null;
        try {
            const block = create();
            this.flyoutDrag.blockId = block.id;
            // Events are queued by Blockly. Also recover when a gesture ends
            // without delivering an end event (or creation was not a drag).
            this.watchDragCompletion();
            return block;
        } catch (error) {
            this.finishFlyoutDrag();
            throw error;
        }
    }

    isTemporarilyRetracted(): boolean { return this.flyoutDrag?.retracted ?? false; }

    override getClientRect(): Blockly.utils.Rect | null {
        return this.isTemporarilyRetracted() ? null : super.getClientRect();
    }

    private watchDragCompletion(): void {
        this.dragFrame = requestAnimationFrame(() => {
            this.dragFrame = null;
            if (this.workspace_.isDragging()) this.watchDragCompletion();
            else {
                // Let Blockly's queued start/end events confirm even a drag
                // completed between frames before the fallback releases it.
                this.dragFrame = requestAnimationFrame(() => this.finishFlyoutDrag());
            }
        });
    }

    private finishFlyoutDrag(restoreSelection = true): void {
        if (this.dragFrame !== null) cancelAnimationFrame(this.dragFrame);
        this.dragFrame = null;
        const drag = this.flyoutDrag;
        if (restoreSelection && drag?.confirmed && drag.selection) {
            this.restoreFlyoutSelection(drag.selection);
        }
        this.flyoutDrag = null;
        this.updateDragPresentation();
    }

    private updateDragPresentation(): void {
        const hidden = this.isTemporarilyRetracted();
        // Opacity and pointer-events preserve layout and DOM focusability.
        // Never close/rebuild the native toolbox or flyout for a drag preview.
        this.toolboxLayer?.classList.toggle("shellblocks-toolbox-drag-hidden", hidden);
        this.handle?.classList.toggle("shellblocks-toolbox-drag-hidden", hidden);
        this.workspace_.recordDragTargets();
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
        this.relevance.dispose();
        this.contentsListeners.clear();
        this.workspace_.removeChangeListener(this.onBlockDrag);
        this.dragListeners?.abort();
        this.dragListeners = null;
        this.flyoutSelectionCandidate = null;
        this.finishFlyoutDrag(false);
        this.handle?.remove();
        this.handle = null;
        super.dispose();
        this.toolboxLayer?.remove();
        this.toolboxLayer = null;
    }
}
