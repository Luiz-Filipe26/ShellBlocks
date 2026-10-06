import { describe, expect, it } from "vitest";
import { OperandTypeIcon } from "@/core/shellblocks/ui/operandTypeIcon";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { createHeadlessWorkspace } from "../helpers/blockly";
import { validRawDefinitions } from "../helpers/cliFixtures";
import type { CLIValueType } from "@/core/shellblocks/types/cli";

describe("operand type icons", () => {
    it.each<{ type: CLIValueType; icon: string }>([
        { type: "string", icon: "type" },
        { type: "number", icon: "hash" },
        { type: "file", icon: "map-pin" },
        { type: "folder", icon: "folder" },
    ])("derives $icon from $type while keeping the label and value", ({ type, icon }) => {
        const raw = validRawDefinitions();
        raw.commands[0].operands = [{ id: "value", label: "Mesmo label", type, defaultValue: "123", cardinality: { min: 0, max: 1 } }];
        const workspace = createHeadlessWorkspace(parseCliDefinitions(raw).definitions);
        try {
            const block = workspace.newBlock("operand:echo:value");
            const fields = block.inputList.flatMap(input => input.fieldRow);
            const icons = fields.filter(field => field instanceof OperandTypeIcon);
            expect(icons).toHaveLength(1);
            expect(icons[0].iconName).toBe(icon);
            expect(icons[0].isSerializable()).toBe(false);
            expect(fields.some(field => field.getText() === "Mesmo label:")).toBe(true);
            expect(block.getFieldValue("VALUE")).toBe("123");
        } finally { workspace.dispose(); }
    });

    it("does not add operand icons to options, including options with arguments", () => {
        const workspace = createHeadlessWorkspace(parseCliDefinitions(validRawDefinitions()).definitions);
        try {
            const option = workspace.newBlock("option:echo");
            for (const flag of ["-n", "-r"]) {
                option.setFieldValue(flag, "FLAG");
                expect(option.inputList.flatMap(input => input.fieldRow).some(field => field instanceof OperandTypeIcon)).toBe(false);
            }
        } finally { workspace.dispose(); }
    });
});
