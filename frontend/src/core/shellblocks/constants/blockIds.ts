import * as CLI from "../types/cli";

export const ROOT_BLOCK_TYPE = "system:script_root" as const;

export const INPUTS = {
    OPTIONS: "OPTIONS",
    OPERANDS: "OPERANDS",
    STACK: "STACK",
    OPTION_ARG_INPUT: "OPTION_ARG_INPUT",
} as const;

export const DUMMY_INPUTS = {
    HEADER: "HEADER",
} as const;

export const FIELDS = {
    FLAG: "FLAG",
    MAIN_INPUT: "MAIN_INPUT",
    VALUE: "VALUE",
    OPTION_ARG_VALUE: "OPTION_ARG_VALUE",
    PARENT_INDICATOR: "PARENT_INDICATOR",
} as const;

export const CONTEXT_MENU_IDS = {
    CLEAR_OPTION: "workspace_clear_all_custom",
} as const;

export function commandBlockType(commandDefinition: CLI.CLICommand): string {
    return `command:${commandDefinition.id}`;
}

export function controlBlockType(controlDefinition: CLI.CLIControl): string {
    return `control:${controlDefinition.id}`;
}

export function operatorBlockType(operatorDefinition: CLI.CLIOperator): string {
    return `operator:${operatorDefinition.id}`;
}

export function commandOptionBlockType(
    commandDefinition: CLI.CLICommand,
): string {
    return `option:${commandDefinition.id}`;
}

export function commandOperandBlockType(
    commandDefinition: CLI.CLICommand,
    operandDefinition: CLI.CLIOperand,
): string {
    return `operand:${commandDefinition.id}:${operandDefinition.id}`;
}

export function commandStatementType(): string {
    return "command";
}

export function commandOptionStatementType(definition: CLI.CLICommand): string {
    return `${definition.id}_option_check`;
}

export function commandOperandStatementType(
    definition: CLI.CLICommand,
): string {
    return `${definition.id}_operand_check`;
}
