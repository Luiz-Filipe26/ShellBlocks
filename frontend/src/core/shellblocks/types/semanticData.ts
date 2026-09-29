export interface Binding {
    key: string;
    source: "field" | "input";
    name: string;
}

export interface SemanticControlSlot {
    name: string;
    syntaxPrefix?: string;
    obligatory: boolean;
    breakLineBefore: boolean;
}

export interface SemanticControlDefinition {
    syntaxEnd: string;
    slots: SemanticControlSlot[];
}

interface SemanticOperatorSlotBase {
    name: string;
}

export type SemanticOperatorSlot = SemanticOperatorSlotBase &
    (
        | { symbol: string; symbolPlacement: "before" | "after" }
        | { symbol?: never; symbolPlacement?: never }
    );

export interface SemanticOperatorDefinition {
    slots: SemanticOperatorSlot[];
}

export interface BaseSemanticData {
    nodeType:
        | "script"
        | "command"
        | "option"
        | "operand"
        | "control"
        | "operator";
    name: string;
    bindings: Binding[];
}

export interface StructuralSemanticData extends BaseSemanticData {
    nodeType: "script" | "command" | "option" | "operand";
}

export interface ControlSemanticData extends BaseSemanticData {
    nodeType: "control";
    definition: { control: SemanticControlDefinition };
}

export interface OperatorSemanticData extends BaseSemanticData {
    nodeType: "operator";
    definition: { operator: SemanticOperatorDefinition };
}

export type SemanticData =
    | StructuralSemanticData
    | ControlSemanticData
    | OperatorSemanticData;
