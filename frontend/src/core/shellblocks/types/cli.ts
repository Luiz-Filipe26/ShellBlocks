export interface CLIValidation {
    regex: string;
    errorMessage: string;
}

export interface OperandSyntaxRule {
    regexPattern: string;
    errorMessage?: string;
}

export interface CLICardinality {
    min: number;
    max: number | "unlimited";
}

export interface CLIArgument {
    type: "string" | "file" | "folder" | "number";
    label: string;
    defaultValue?: string;
    validations?: CLIValidation[];
}

export interface CLIOperand {
    id: string;
    label: string;
    description: string;
    color: string;
    type: CLIArgument["type"];
    defaultValue: string;
    cardinality?: CLICardinality;
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
    optionColor: string;
    options: CLIOption[];
    optionsMin?: number;
    exclusiveOptions?: string[][];
    operands: CLIOperand[];
    operandsMin?: number;
    operandSyntaxRules?: OperandSyntaxRule[];
    operandIdsSequenceDelimiter?: string;
}

export interface CLIControlSlot {
    name: string;
    type: "statement" | "value";
    check: string;
    label?: string;
    symbol?: string;
    symbolPlacement?: "before" | "after";
    syntaxPrefix?: string;
    obligatory?: boolean;
    breakLineBefore?: boolean;
}

export interface CLIOperator {
    id: string;
    label: string;
    description: string;
    color: string;
    slots: CLIControlSlot[];
    slotsWithImplicitData?: string[];
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
    commands: string[];
}

export interface CliDefinitions {
    commands: CLICommand[];
    operators?: CLIOperator[];
    controls?: CLIControl[];
    categories: CLICategory[];
}
