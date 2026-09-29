import type {
    CLIOperand,
    CLIControlSlot,
    CLIOperatorSlot,
} from "../types/cli";

export const VALIDATION_ERRORS = {
    SYNTAX_ERROR_ID: "syntax_operand_sequence",
} as const;

export type FixedValidationError =
    (typeof VALIDATION_ERRORS)[keyof typeof VALIDATION_ERRORS];

export const VALIDATION_ERROR_PREFIXES = {
    CARDINALITY: "CARDINALITY_",
} as const;

export type ControlMissingSlot = `CONTROL_MISSING_SLOT_${string}`;
export type OperatorEmptySlot = `OPERATOR_EMPTY_SLOT_${string}`;
export type OperatorStackedSlot = `OPERATOR_STACKED_SLOT_${string}`;
export type CardinalityMissingOperand = `CARDINALITY_MISSING_OPERAND_${string}`;

export type ValueEmptyError = `VALUE_EMPTY_${string}`;
export type ValueRegexRuleError = `VALUE_REGEX_RULE_${string}_${number}`;

export function controlMissingSlotError(
    slot: CLIControlSlot,
): ControlMissingSlot {
    return `CONTROL_MISSING_SLOT_${slot.name}`;
}

export function operatorEmptySlotError(
    slot: CLIOperatorSlot,
): OperatorEmptySlot {
    return `OPERATOR_EMPTY_SLOT_${slot.name}`;
}

export function operatorStackedSlotError(
    slot: CLIOperatorSlot,
): OperatorStackedSlot {
    return `OPERATOR_STACKED_SLOT_${slot.name}`;
}

export function cardinalityMissingOperandError(
    operand: CLIOperand,
): CardinalityMissingOperand {
    return `CARDINALITY_MISSING_OPERAND_${operand.id}`;
}

export function valueEmptyError(scope: string): ValueEmptyError {
    return `VALUE_EMPTY_${scope}`;
}

export function valueRegexRuleError(
    scope: string,
    index: number,
): ValueRegexRuleError {
    return `VALUE_REGEX_RULE_${scope}_${index}`;
}

export type ValidationErrorCode =
    | FixedValidationError
    | ControlMissingSlot
    | OperatorEmptySlot
    | OperatorStackedSlot
    | CardinalityMissingOperand
    | ValueEmptyError
    | ValueRegexRuleError;
