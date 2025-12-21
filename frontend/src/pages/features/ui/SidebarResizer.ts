import * as PersistenceManager from "../session/persistenceManager";

const SIDEBAR_WIDTH_VAR = "--sidebar-width" as const;
const RESIZING_CLASS = "layout-drag-resizing" as const;

export class SidebarResizer {
    private isResizing = false;
    private animationFrameId: number | null = null;
    private mouseOffsetAtResizeStart = 0;

    constructor(
        private readonly sidebarResizerGutter: HTMLElement,
        private readonly sidebar: HTMLElement,
    ) { }

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

    private restoreWidth() {
        const savedWidth = PersistenceManager.getSidebarWidth();
        if (!savedWidth) return;

        document.documentElement.style.setProperty(
            SIDEBAR_WIDTH_VAR,
            `${savedWidth}px`,
        );
    }

    private onMouseDown = (e: MouseEvent) => {
        this.isResizing = true;
        const currentWidth = this.sidebar.getBoundingClientRect().width;
        this.mouseOffsetAtResizeStart =
            window.innerWidth - e.clientX - currentWidth;

        document.body.classList.add(RESIZING_CLASS);

        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.isResizing) return;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            const newWidth =
                window.innerWidth - e.clientX - this.mouseOffsetAtResizeStart;

            document.documentElement.style.setProperty(
                SIDEBAR_WIDTH_VAR,
                `${newWidth}px`,
            );
        });
    };

    private onMouseUp = () => {
        this.isResizing = false;

        document.body.classList.remove(RESIZING_CLASS);

        window.removeEventListener("mousemove", this.onMouseMove);
        window.removeEventListener("mouseup", this.onMouseUp);

        const finalWidth = this.sidebar.getBoundingClientRect().width;
        PersistenceManager.saveSidebarWidth(finalWidth);

        window.dispatchEvent(new Event("resize"));
    };
}
