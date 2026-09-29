import { SemanticData } from "./semanticData";

export interface ASTParameter {
    key: string;
    source: "field" | "input";
    value: string;
    children: ASTNode[];
}

export interface ASTControlConfig {
    syntaxEnd: string;
    slots: {
        key: string;
        syntaxPrefix?: string;
        obligatory: boolean;
        breakLineBefore: boolean;
    }[];
}

export type ASTOperatorSlot = { key: string } &
    (
        | { symbol: string; symbolPlacement: "before" | "after" }
        | { symbol?: never; symbolPlacement?: never }
    );

export interface ASTOperatorConfig {
    slots: ASTOperatorSlot[];
}

export interface ASTNode {
    type: SemanticData["nodeType"];
    name: string;
    parameters: ASTParameter[];
    controlConfig?: ASTControlConfig;
    operatorConfig?: ASTOperatorConfig;
}

export interface AST extends ASTNode {
    type: "script";
}
