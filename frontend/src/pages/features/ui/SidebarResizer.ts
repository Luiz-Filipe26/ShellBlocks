import * as PersistenceManager from "../session/persistenceManager";

const SIDEBAR_WIDTH_VAR = "--sidebar-width" as const;
const RESIZING_CLASS = "layout-drag-resizing" as const;

const SIDEBAR_LEFT_WIDTH_VAR = "--sidebar-left-width" as const;
const SIDEBAR_LEFT_WIDTH_KEY = "sidebar-left-width" as const;

export class SidebarResizer {
    private isResizing = false;
    private animationFrameId: number | null = null;
    private mouseOffsetAtResizeStart = 0;

    constructor(
        private readonly sidebarResizerGutter: HTMLElement,
        private readonly sidebar: HTMLElement,
        private readonly direction: "left" | "right" = "right",
    ) {}

    start() {
        this.restoreWidth();
        this.sidebarResizerGutter.addEventListener(
            "mousedown",
            this.onMouseDown,
        );
    }

    stop() {
        this.sidebarResizerGutter.removeEventListener(
            "mousedown",
            this.onMouseDown,
        );
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);
        document.body.classList.remove(RESIZING_CLASS);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private get cssVar() {
        return this.direction === "right" ? SIDEBAR_WIDTH_VAR : SIDEBAR_LEFT_WIDTH_VAR;
    }

    private restoreWidth() {
        const key = this.direction === "right" ? undefined : SIDEBAR_LEFT_WIDTH_KEY;
        const savedWidth = key
            ? localStorage.getItem(key)
            : PersistenceManager.getSidebarWidth();
        if (!savedWidth) return;
        document.documentElement.style.setProperty(this.cssVar, `${savedWidth}px`);
    }

    private onMouseDown = (e: MouseEvent) => {
        this.isResizing = true;
        const currentWidth = this.sidebar.getBoundingClientRect().width;

        this.mouseOffsetAtResizeStart = this.direction === "right"
            ? window.innerWidth - e.clientX - currentWidth
            : e.clientX - currentWidth;

        document.body.classList.add(RESIZING_CLASS);
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.isResizing) return;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        this.animationFrameId = requestAnimationFrame(() => {
            const newWidth = this.direction === "right"
                ? window.innerWidth - e.clientX - this.mouseOffsetAtResizeStart
                : e.clientX - this.mouseOffsetAtResizeStart;

            document.documentElement.style.setProperty(this.cssVar, `${newWidth}px`);
        });
    };

    private onMouseUp = () => {
        this.isResizing = false;
        document.body.classList.remove(RESIZING_CLASS);
        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);

        const finalWidth = this.sidebar.getBoundingClientRect().width;
        if (this.direction === "right") {
            PersistenceManager.saveSidebarWidth(finalWidth);
        } else {
            localStorage.setItem(SIDEBAR_LEFT_WIDTH_KEY, String(finalWidth));
        }

        window.dispatchEvent(new Event("resize"));
    };
}
