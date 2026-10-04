import { z } from "zod";
import type { CliDefinitions } from "../../../core/shellblocks/types/cli";
import * as BlockIDs from "../../../core/shellblocks/constants/blockIds";
import { createToolbox } from "../../../core/shellblocks/workspace/toolboxBuilder";

export const toolboxGuidanceSchema = z.discriminatedUnion("entity", [
    z.object({ entity: z.literal("command"), commandId: z.string().min(1) }).strict(),
    z.object({ entity: z.literal("option"), commandId: z.string().min(1), flag: z.string().min(1) }).strict(),
    z.object({ entity: z.literal("operand"), commandId: z.string().min(1), operandId: z.string().min(1) }).strict(),
    z.object({ entity: z.literal("operator"), operatorId: z.string().min(1) }).strict(),
    z.object({ entity: z.literal("control"), controlId: z.string().min(1) }).strict(),
]);

export type ToolboxGuidance = z.infer<typeof toolboxGuidanceSchema>;

export const toolboxGuidanceListSchema = z.array(toolboxGuidanceSchema).superRefine((references, context) => {
    const identities = new Set<string>();
    for (const [index, reference] of references.entries()) {
        const identity = guidanceIdentity(reference);
        if (identities.has(identity)) {
            context.addIssue({ code: "custom", path: [index], message: `Referência duplicada ${identity}.` });
        }
        identities.add(identity);
    }
}).default([]);

export function guidanceIdentity(reference: ToolboxGuidance): string {
    switch (reference.entity) {
        case "command": return JSON.stringify([reference.entity, reference.commandId]);
        case "option": return JSON.stringify([reference.entity, reference.commandId, reference.flag]);
        case "operand": return JSON.stringify([reference.entity, reference.commandId, reference.operandId]);
        case "operator": return JSON.stringify([reference.entity, reference.operatorId]);
        case "control": return JSON.stringify([reference.entity, reference.controlId]);
    }
}

/** Domain identities become internal block targets only after CLI lookup. */
export function resolveToolboxGuidance(references: readonly ToolboxGuidance[], definitions: CliDefinitions, visualTypes?: ReadonlySet<string>) {
    const commands = new Map(definitions.commands.map((command) => [command.id, command]));
    const operators = new Map(definitions.operators.map((operator) => [operator.id, operator]));
    const controls = new Map(definitions.controls.map((control) => [control.id, control]));
    const available = new Set<string>();
    const toolbox = createToolbox(definitions);
    function visit(items: typeof toolbox.contents[number]["contents"]): void {
        for (const item of items) {
            if (item.kind === "block") available.add(item.type);
            else visit(item.contents);
        }
    }
    visit(toolbox.contents);
    const targets = new Map<string, Set<string>>();
    const unresolved: { reference: ToolboxGuidance; reason: string }[] = [];
    for (const reference of references) {
        let type: string | undefined;
        switch (reference.entity) {
            case "command": {
                const command = commands.get(reference.commandId);
                if (command) type = BlockIDs.commandBlockType(command);
                break;
            }
            case "option": {
                const command = commands.get(reference.commandId);
                if (command?.options.some((option) => option.flag === reference.flag)) type = BlockIDs.commandOptionBlockType(command);
                break;
            }
            case "operand": {
                const command = commands.get(reference.commandId);
                const operand = command?.operands.find((operand) => operand.id === reference.operandId);
                if (command && operand) type = BlockIDs.commandOperandBlockType(command, operand);
                break;
            }
            case "operator": {
                const operator = operators.get(reference.operatorId);
                if (operator) type = BlockIDs.operatorBlockType(operator);
                break;
            }
            case "control": {
                const control = controls.get(reference.controlId);
                if (control) type = BlockIDs.controlBlockType(control);
                break;
            }
        }
        if (!type || !(visualTypes ?? available).has(type)) {
            unresolved.push({ reference, reason: type ? "sem alvo na toolbox" : "entidade inexistente" });
            continue;
        }
        const flags = targets.get(type) ?? new Set<string>();
        if (reference.entity === "option") flags.add(reference.flag);
        targets.set(type, flags);
    }
    return { targets, unresolved };
}
