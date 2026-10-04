import * as Blockly from "blockly";
import { getValidSemanticParents } from "./semanticParents";
import "../ui/semanticParentGlow.css";

/** Extends only the visual feedback of Blockly's native drag lifecycle. */
export class SemanticParentDragger extends Blockly.dragging.Dragger {
    private parents = new Set<Blockly.BlockSvg>();
    private listeners: AbortController | null = null;

    override onDragStart(event: PointerEvent): void {
        try {
            super.onDragStart(event);
            if (!(this.draggable instanceof Blockly.BlockSvg)) return;
            this.updateParents();
            this.listeners = new AbortController();
            const { signal } = this.listeners;
            const cancel = (): void => {
                try { this.workspace.cancelCurrentGesture(); }
                finally { this.clearParents(); }
            };
            window.addEventListener("blur", cancel, { signal });
            document.addEventListener("pointercancel", cancel, { signal });
            document.addEventListener("keydown", (keyEvent) => {
                if (keyEvent.key !== "Escape") return;
                cancel();
                keyEvent.preventDefault();
            }, { signal, capture: true });
        } catch (error) {
            this.clearParents();
            throw error;
        }
    }

    override onDrag(event: PointerEvent, delta: Blockly.utils.Coordinate): void {
        try {
            super.onDrag(event, delta);
            this.updateParents();
        } catch (error) {
            this.clearParents();
            throw error;
        }
    }

    override onDragEnd(event: PointerEvent): void {
        // Also used by native gesture cancellation and workspace/block disposal.
        this.clearParents();
        try { super.onDragEnd(event); }
        finally { this.clearParents(); }
    }

    private updateParents(): void {
        if (!(this.draggable instanceof Blockly.BlockSvg)) return;
        const next = new Set(getValidSemanticParents(this.draggable)
            .filter((block): block is Blockly.BlockSvg => block instanceof Blockly.BlockSvg));
        for (const parent of this.parents) {
            if (!next.has(parent)) parent.pathObject.svgPath.classList.remove("shellblocks-semantic-parent");
        }
        for (const parent of next) {
            parent.pathObject.svgPath.classList.add("shellblocks-semantic-parent");
        }
        this.parents = next;
    }

    private clearParents(): void {
        for (const parent of this.parents) parent.pathObject.svgPath.classList.remove("shellblocks-semantic-parent");
        this.parents.clear();
        this.listeners?.abort();
        this.listeners = null;
    }
}
