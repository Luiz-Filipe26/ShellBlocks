import * as Blockly from "blockly";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProblemIcon } from "@/core/shellblocks/ui/problemIcon";
import { createHeadlessWorkspace, createBlock } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";
import { ROOT_BLOCK_TYPE } from "@/core/shellblocks/constants/blockIds";

afterEach(() => vi.restoreAllMocks());

function sourceBlock() {
    const workspace = createHeadlessWorkspace(validDefinitions());
    const block = createBlock(workspace, ROOT_BLOCK_TYPE);
    // Only the rendering boundary is replaced; icon state/lifecycle stay real.
    Object.assign(block, { getSvgRoot: () => ({ getBBox: () => ({ x: 0, y: 0, width: 100, height: 50 }) }) });
    return { workspace, block };
}

describe("balão de problemas", () => {
    it("alterna clique persistente, atualiza o conteúdo e descarta a view com o ícone", async () => {
        const { workspace, block } = sourceBlock();
        const element = new EventTarget();
        const view = {
            setText: vi.fn(), setColour: vi.fn(), dispose: vi.fn(),
            getFocusableElement: () => element as unknown as SVGElement,
        };
        vi.spyOn(Blockly.renderManagement, "finishQueuedRenders").mockResolvedValue(undefined);
        const createBubble = vi.spyOn(Blockly.bubbles, "TextBubble").mockImplementation(function () {
            return view as unknown as Blockly.bubbles.TextBubble;
        });
        const icon = new ProblemIcon(block);
        try {
            icon.setProblems("um erro");
            await icon.setBubbleVisible(true);
            expect(icon.bubbleIsVisible()).toBe(true);
            expect(createBubble.mock.calls[0][0]).toBe("um erro");
            icon.setProblems("outro erro\nmais um erro");
            expect(view.setText).toHaveBeenCalledWith("outro erro\nmais um erro");
            icon.onClick();
            expect(icon.bubbleIsVisible()).toBe(false);
            expect(view.dispose).toHaveBeenCalledTimes(1);
            icon.onClick();
            await Promise.resolve();
            expect(icon.bubbleIsVisible()).toBe(true);
            expect(createBubble.mock.calls[1][0]).toBe("outro erro\nmais um erro");
            icon.dispose();
            expect(icon.bubbleIsVisible()).toBe(false);
            expect(view.dispose).toHaveBeenCalledTimes(2);
        } finally { workspace.dispose(); }
    });

    it.each(["fechar", "descartar"])("não cria balão após %s durante uma renderização pendente", async (action) => {
        const { workspace, block } = sourceBlock();
        let finish!: () => void;
        vi.spyOn(Blockly.renderManagement, "finishQueuedRenders").mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
        const createBubble = vi.spyOn(Blockly.bubbles, "TextBubble");
        const icon = new ProblemIcon(block);
        try {
            icon.setProblems("erro atual");
            const opening = icon.setBubbleVisible(true);
            if (action === "fechar") await icon.setBubbleVisible(false);
            else icon.dispose();
            finish();
            await opening;
            expect(createBubble).not.toHaveBeenCalled();
            expect(icon.bubbleIsVisible()).toBe(false);
            if (action === "fechar") icon.dispose();
        } finally { workspace.dispose(); }
    });
});
