import * as PersistenceManager from "../session/persistenceManager";
import { compactLayout } from "./compactLayout";

/** One captured pointer resizes the existing panel; layout determines the axis. */
export class SidebarResizer {
    private pointer: { id: number; coordinate: number; size: number; compact: boolean } | null = null;
    constructor(
        private readonly sidebarResizerGutter: HTMLElement,
        private readonly sidebar: HTMLElement,
        private readonly direction: "left" | "right" = "right",
    ) {}

    start(): void {
        this.restoreWidth();
        this.sidebarResizerGutter.addEventListener("pointerdown", this.onPointerDown);
        this.sidebarResizerGutter.addEventListener("pointermove", this.onPointerMove);
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
            this.sidebarResizerGutter.addEventListener(type, this.finish);
        }
        window.addEventListener("resize", this.restoreWidth);
    }

    stop(): void {
        this.finish();
        this.sidebarResizerGutter.removeEventListener("pointerdown", this.onPointerDown);
        this.sidebarResizerGutter.removeEventListener("pointermove", this.onPointerMove);
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
            this.sidebarResizerGutter.removeEventListener(type, this.finish);
        }
        window.removeEventListener("resize", this.restoreWidth);
    }

    private get widthVar(): string { return this.direction === "right" ? "--sidebar-width" : "--sidebar-left-width"; }
    private limits(compact: boolean): { min: number; max: number } {
        const parent = this.sidebar.parentElement!;
        if (compact) return { min: 120, max: Math.max(120, parent.getBoundingClientRect().height - 152) };
        const other = parent.querySelector<HTMLElement>(this.direction === "right" ? ".instructions-sidebar" : ".sidebar");
        const max = parent.getBoundingClientRect().width - (other?.getBoundingClientRect().width ?? 0) - 332;
        const min = this.direction === "right" ? 250 : 160;
        return { min, max: Math.max(min, max) };
    }
    private clamp(value: number, compact: boolean): number {
        const { min, max } = this.limits(compact);
        return Math.min(max, Math.max(min, value));
    }
    private restoreWidth = (): void => {
        if (this.pointer) this.finish();
        if (compactLayout()) return;
        const saved = this.direction === "right" ? PersistenceManager.getSidebarWidth() : localStorage.getItem("sidebar-left-width");
        if (!saved) return;
        const width = Number(saved);
        if (Number.isFinite(width)) document.documentElement.style.setProperty(this.widthVar, `${this.clamp(width, false)}px`);
    };
    private onPointerDown = (event: PointerEvent): void => {
        if (this.pointer || event.button !== 0) return;
        const compact = compactLayout();
        const box = this.sidebar.getBoundingClientRect();
        this.pointer = { id: event.pointerId, compact, coordinate: compact ? event.clientY : event.clientX, size: compact ? box.height : box.width };
        this.sidebarResizerGutter.setPointerCapture(event.pointerId);
        document.body.classList.add("layout-drag-resizing");
        event.preventDefault();
    };
    private onPointerMove = (event: PointerEvent): void => {
        const pointer = this.pointer;
        if (!pointer || event.pointerId !== pointer.id) return;
        const delta = (pointer.compact ? event.clientY : event.clientX) - pointer.coordinate;
        const size = this.clamp(pointer.size + (pointer.compact || this.direction === "right" ? -delta : delta), pointer.compact);
        const variable = pointer.compact
            ? this.direction === "right" ? "--compact-results-height" : "--compact-instructions-height"
            : this.widthVar;
        document.documentElement.style.setProperty(variable, `${size}px`);
    };
    private finish = (event?: Event): void => {
        const pointer = this.pointer;
        if (!pointer || (event && "pointerId" in event && event.pointerId !== pointer.id)) return;
        this.pointer = null;
        if (this.sidebarResizerGutter.hasPointerCapture(pointer.id)) this.sidebarResizerGutter.releasePointerCapture(pointer.id);
        document.body.classList.remove("layout-drag-resizing");
        if (!pointer.compact) {
            const width = this.sidebar.getBoundingClientRect().width;
            if (this.direction === "right") PersistenceManager.saveSidebarWidth(width);
            else localStorage.setItem("sidebar-left-width", String(width));
        }
    };
}
