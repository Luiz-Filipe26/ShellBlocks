// @vitest-environment jsdom
import * as Blockly from "blockly";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolbox } from "@/core/shellblocks/workspace/toolboxBuilder";
import { getRelevantCategories, getToolboxBlockTypes } from "@/core/shellblocks/workspace/toolboxRelevance";
import { registerBlockTypesFromDefinitions } from "@/core/shellblocks/blocks/blocksBuilder";
import { FIELDS, INPUTS } from "@/core/shellblocks/constants/blockIds";
import { createHeadlessWorkspace, connectInput } from "../helpers/blockly";
import { validDefinitions } from "../helpers/cliFixtures";

afterEach(() => vi.restoreAllMocks());

describe("command flyout groups", () => {
    it.each([
        { options: true, operands: true, headings: ["Opções", "Operandos"] },
        { options: true, operands: false, headings: ["Opções"] },
        { options: false, operands: true, headings: ["Operandos"] },
        { options: false, operands: false, headings: [] },
    ])("shows only headings with corresponding content: $headings", ({ options, operands, headings }) => {
        const definitions = validDefinitions();
        const command = definitions.commands[0];
        if (!options) command.options = [];
        if (!operands) command.operands = [];
        const contents = createToolbox(definitions).contents[0].contents[0];
        if (contents.kind !== "category") throw new Error("Expected command category");
        expect(contents.contents.filter(item => item.kind === "label").map(item => item.text)).toEqual(headings);
        expect(contents.contents.filter(item => item.kind === "block").map(item => item.type)).toEqual([
            "command:echo", ...(options ? ["option:echo"] : []), ...(operands ? ["operand:echo:text"] : []),
        ]);
        for (const heading of headings) {
            const index = contents.contents.findIndex(item => item.kind === "label" && item.text === heading);
            expect(contents.contents[index + 1].kind).toBe("block");
        }
    });
    it("labels do not become guidance targets or interfere with derived categories", () => {
        const definition = createToolbox(validDefinitions()).contents[0];
        const workspace = new Blockly.WorkspaceSvg(new Blockly.Options({}));
        const toolbox = new Blockly.Toolbox(workspace);
        const parent = new Blockly.CollapsibleToolboxCategory({ kind: "category", name: definition.name, contents: [], id: undefined, colour: undefined, categorystyle: undefined, cssconfig: undefined, hidden: undefined }, toolbox);
        parent.updateFlyoutContents(definition.contents.filter(item => item.kind === "block"));
        const commandDefinition = definition.contents[0];
        if (commandDefinition.kind !== "category") throw new Error("Expected command category");
        const command = new Blockly.ToolboxCategory({ kind: "category", name: commandDefinition.name, contents: [], id: undefined, colour: undefined, categorystyle: undefined, cssconfig: undefined, hidden: undefined }, toolbox, parent);
        command.updateFlyoutContents(commandDefinition.contents.filter(item => item.kind !== "category").map(item => item.kind === "label" ? { ...item, id: undefined } : item));
        expect(getToolboxBlockTypes([parent, command])).toEqual(new Set(["operator:pipe", "operator:redirect_out", "control:if_statement", "command:echo", "option:echo", "operand:echo:text"]));
        expect(getRelevantCategories([parent, command], new Set(["operand:echo:text"]))).toEqual(new Map([[command, "direct"], [parent, "ancestor"]]));
        workspace.dispose();
    });
});

describe("contextual parent indicators", () => {
    it.each([
        { type: "operand:echo:text", input: INPUTS.OPERANDS, text: "(operando de: echo)" },
        { type: "option:echo", input: INPUTS.OPTIONS, text: "(opção de: echo)" },
    ])("preserves $type context through connection changes", ({ type, input, text }) => {
        const workspace = createHeadlessWorkspace(validDefinitions());
        try {
            const command = workspace.newBlock("command:echo");
            const operand = workspace.newBlock(type);
            operand.initModel();
            const indicator = operand.getField(FIELDS.PARENT_INDICATOR)!;
            expect(indicator.isVisible()).toBe(true);
            expect(indicator.getText()).toBe(text);
            connectInput(command, input, operand);
            operand.onchange!(new Blockly.Events.BlockMove(operand));
            expect(indicator.getText()).toBe("");
            operand.unplug();
            operand.onchange!(new Blockly.Events.BlockMove(operand));
            expect(indicator.getText()).toBe(text);
        } finally { workspace.dispose(); }
    });
    it.each([
        { type: "operand:echo:text", field: FIELDS.VALUE, value: "hello", text: "(operando de: echo)" },
        { type: "option:echo", field: FIELDS.FLAG, value: "-n", text: "(opção de: echo)" },
    ])("omits $type context only in the main toolbox flyout", ({ type, field, value, text }) => {
        registerBlockTypesFromDefinitions(validDefinitions());
        const target = new Blockly.WorkspaceSvg(new Blockly.Options({}));
        const toolbox = new Blockly.Toolbox(target);
        const main = new Blockly.VerticalFlyout(new Blockly.Options({}));
        const trash = new Blockly.VerticalFlyout(new Blockly.Options({}));
        vi.spyOn(target, "getToolbox").mockReturnValue(toolbox);
        vi.spyOn(toolbox, "getFlyout").mockReturnValue(main);
        const workspace = createHeadlessWorkspace(validDefinitions());
        try {
            for (const flyout of [main, trash]) {
                flyout.targetWorkspace = target;
                flyout.getWorkspace().targetWorkspace = target;
                const operand = new Blockly.Block(flyout.getWorkspace(), type);
                operand.initModel();
                const indicator = operand.getField(FIELDS.PARENT_INDICATOR)!;
                expect(indicator.isVisible()).toBe(flyout !== main);
                expect(indicator.isSerializable()).toBe(false);
                operand.setFieldValue(value, field);
                const state = Blockly.serialization.blocks.save(operand)!;
                const clone = Blockly.serialization.blocks.append(state, workspace);
                expect(clone.getField(FIELDS.PARENT_INDICATOR)!.isVisible()).toBe(true);
                expect(clone.getField(FIELDS.PARENT_INDICATOR)!.getText()).toBe(text);
                expect(clone.getFieldValue(field)).toBe(value);
                expect(clone.type).toBe(operand.type);
                operand.dispose();
            }
        } finally {
            workspace.dispose(); main.dispose(); trash.dispose(); target.dispose();
        }
    });
});

it("limits only contextual closed option text while preserving full menu and workspace text", () => {
    const definitions = validDefinitions();
    definitions.commands[0].options = [
        { ...definitions.commands[0].options[0], flag: "-l", description: "Usa o formato de listagem long" },
        { ...definitions.commands[0].options[0], flag: "-x", description: "Curto" },
        { ...definitions.commands[0].options[0], flag: "--abcdefghijkl", description: "Descrição longa" },
    ];
    registerBlockTypesFromDefinitions(definitions);
    const target = new Blockly.WorkspaceSvg(new Blockly.Options({}));
    const toolbox = new Blockly.Toolbox(target);
    const main = new Blockly.VerticalFlyout(new Blockly.Options({}));
    vi.spyOn(target, "getToolbox").mockReturnValue(toolbox);
    vi.spyOn(toolbox, "getFlyout").mockReturnValue(main);
    main.targetWorkspace = target;
    main.getWorkspace().targetWorkspace = target;
    const workspace = createHeadlessWorkspace(definitions);
    try {
        const block = new Blockly.Block(main.getWorkspace(), "option:echo");
        block.initModel();
        const dropdown = block.getField(FIELDS.FLAG);
        if (!(dropdown instanceof Blockly.FieldDropdown)) throw new Error("Expected option dropdown");
        const menu = dropdown.getOptions(false);
        const fullTexts = [
            "-l (Usa o formato de listagem long)",
            "-x (Curto)",
            "--abcdefghijkl (Descrição longa)",
        ];
        const expectedClosedTexts = ["-l (Usa o...", "-x (Curto)", "--abcdefg..."];
        for (const [index, option] of definitions.commands[0].options.entries()) {
            block.setFieldValue(option.flag, FIELDS.FLAG);
            const closedText = dropdown.getText();
            expect(closedText).toBe(expectedClosedTexts[index]);
            expect(Array.from(closedText).length).toBeLessThanOrEqual(12);
            expect(dropdown.getValue()).toBe(option.flag);
            expect(dropdown.getOptions(false)).toEqual(menu);
            expect(menu[index][0]).toBe(fullTexts[index]);
            const state = Blockly.serialization.blocks.save(block)!;
            const clone = Blockly.serialization.blocks.append(state, workspace);
            expect(clone.getFieldValue(FIELDS.FLAG)).toBe(option.flag);
            expect(clone.getField(FIELDS.FLAG)!.getText()).toBe(fullTexts[index]);
            clone.dispose();
        }
        const workspaceBlock = workspace.newBlock("option:echo");
        workspaceBlock.setFieldValue("-l", FIELDS.FLAG);
        expect(workspaceBlock.getField(FIELDS.FLAG)!.getText()).toBe(fullTexts[0]);
        workspaceBlock.dispose();
    } finally { workspace.dispose(); main.dispose(); target.dispose(); }
});
