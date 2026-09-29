export const CLIValueType = {
    STRING: "string",
    NUMBER: "number",
    FILE: "file",
    FOLDER: "folder",
} as const;

export type CLIValueType =
    (typeof CLIValueType)[keyof typeof CLIValueType];

export const OperatorSlotType = {
    STATEMENT: "statement",
    VALUE: "value",
} as const;

export type OperatorSlotType =
    (typeof OperatorSlotType)[keyof typeof OperatorSlotType];

export const SymbolPlacement = {
    BEFORE: "before",
    AFTER: "after",
} as const;

export type SymbolPlacement =
    (typeof SymbolPlacement)[keyof typeof SymbolPlacement];

export interface RawCLIValidation {
    regex: string;
    errorMessage: string;
}

export interface RawOperandSyntaxRule {
    regexPattern: string;
    errorMessage: string | null;
}

export interface RawCLICardinality {
    min: number;
    max: number | "unlimited";
}

export interface RawCLIArgument {
    type: CLIValueType;
    label: string;
    defaultValue?: string;
    allowEmptyValue?: boolean;
    validations?: RawCLIValidation[];
}

export interface RawCLIOperand {
    id: string;
    label: string;
    description?: string;
    color?: string;
    type: CLIValueType;
    defaultValue?: string;
    allowEmptyValue?: boolean;
    optionalWithImplicitInput?: boolean;
    cardinality: RawCLICardinality;
    validations?: RawCLIValidation[];
}

export interface RawCLIOption {
    flag: string;
    longFlag?: string;
    description?: string;
    argument?: RawCLIArgument;
}

export interface RawCLICommand {
    id: string;
    shellCommand: string;
    label: string;
    description?: string;
    color: string;
    optionColor?: string;
    options?: RawCLIOption[];
    exclusiveOptions?: string[][];
    operands?: RawCLIOperand[];
    operandSyntaxRules?: RawOperandSyntaxRule[];
    operandIdsSequenceDelimiter?: string;
}

interface RawOperatorSlotBase {
    name: string;
    label?: string;
}

type RawOperatorSlotSymbol =
    | { symbol: string; symbolPlacement: SymbolPlacement }
    | { symbol?: never; symbolPlacement?: never };

export type RawCLIStatementOperatorSlot = RawOperatorSlotBase &
    RawOperatorSlotSymbol & {
        type: typeof OperatorSlotType.STATEMENT;
    };

export type RawCLIValueOperatorSlot = RawOperatorSlotBase &
    RawOperatorSlotSymbol & {
        type: typeof OperatorSlotType.VALUE;
        valueType: CLIValueType;
        defaultValue?: string;
        allowEmptyValue?: boolean;
        validations?: RawCLIValidation[];
    };

export type RawCLIOperatorSlot =
    | RawCLIStatementOperatorSlot
    | RawCLIValueOperatorSlot;

export interface RawCLIOperator {
    id: string;
    label: string;
    description?: string;
    color: string;
    slots: RawCLIOperatorSlot[];
    slotsWithImplicitData?: string[];
}

export interface RawCLIControlSlot {
    name: string;
    label?: string;
    syntaxPrefix?: string;
    obligatory: boolean;
    breakLineBefore?: boolean;
}

export interface RawCLIControl {
    id: string;
    shellCommand: string;
    label: string;
    description?: string;
    color: string;
    syntaxEnd: string;
    slots: RawCLIControlSlot[];
}

export interface RawCLICategory {
    name: string;
    entities?: string[];
}

export interface RawCliDefinitions {
    $schema?: string;
    commands: RawCLICommand[];
    operators?: RawCLIOperator[];
    controls?: RawCLIControl[];
    categories: RawCLICategory[];
}

export interface CLIValidation {
    regex: string;
    errorMessage: string;
}

export interface OperandSyntaxRule {
    regexPattern: string;
    errorMessage: string | null;
}

export interface CLICardinality {
    min: number;
    max: number | "unlimited";
}

export interface CLIArgument {
    type: CLIValueType;
    label: string;
    defaultValue: string;
    allowEmptyValue: boolean;
    validations: CLIValidation[];
}

export interface CLIOperand {
    id: string;
    label: string;
    description: string;
    color?: string;
    type: CLIValueType;
    defaultValue: string;
    allowEmptyValue: boolean;
    optionalWithImplicitInput: boolean;
    cardinality: CLICardinality;
    validations: CLIValidation[];
}

export interface CLIOption {
    flag: string;
    longFlag?: string;
    description: string;
    argument?: CLIArgument;
}

export interface CLICommand {
    id: string;
    shellCommand: string;
    label: string;
    description: string;
    color: string;
    optionColor?: string;
    options: CLIOption[];
    exclusiveOptions: string[][];
    operands: CLIOperand[];
    operandSyntaxRules: OperandSyntaxRule[];
    operandIdsSequenceDelimiter?: string;
}

interface CLIOperatorSlotBase {
    name: string;
    label?: string;
}

type CLIOperatorSlotSymbol =
    | { symbol: string; symbolPlacement: SymbolPlacement }
    | { symbol?: never; symbolPlacement?: never };

export type CLIStatementOperatorSlot = CLIOperatorSlotBase &
    CLIOperatorSlotSymbol & {
        type: typeof OperatorSlotType.STATEMENT;
    };

export type CLIValueOperatorSlot = CLIOperatorSlotBase &
    CLIOperatorSlotSymbol & {
        type: typeof OperatorSlotType.VALUE;
        valueType: CLIValueType;
        defaultValue: string;
        allowEmptyValue: boolean;
        validations: CLIValidation[];
    };

export type CLIOperatorSlot =
    | CLIStatementOperatorSlot
    | CLIValueOperatorSlot;

export interface CLIOperator {
    id: string;
    label: string;
    description: string;
    color: string;
    slots: CLIOperatorSlot[];
    slotsWithImplicitData: string[];
}

export interface CLIControlSlot {
    name: string;
    label?: string;
    syntaxPrefix?: string;
    obligatory: boolean;
    breakLineBefore: boolean;
}

export interface CLIControl {
    id: string;
    shellCommand: string;
    label: string;
    description: string;
    color: string;
    syntaxEnd: string;
    slots: CLIControlSlot[];
}

export interface CLICategory {
    name: string;
    entities: string[];
}

export interface CliDefinitions {
    commands: CLICommand[];
    operators: CLIOperator[];
    controls: CLIControl[];
    categories: CLICategory[];
}
