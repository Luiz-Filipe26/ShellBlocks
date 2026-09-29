import { ASTNode, ASTParameter } from "../types/ast";

const SAFE_ARGUMENT_PATTERN = /^[a-zA-Z0-9._/-]+$/;

export function generateShellScript(
    rootNode: ASTNode | undefined | null,
): string {
    if (!rootNode) throw new Error("AST não pode ser nula");
    return dispatch(rootNode);
}

function dispatch(node: ASTNode | undefined): string {
    if (!node) return "";

    switch (node.type) {
        case "script":
            return generateScript(node);
        case "command":
            return generateCommand(node);
        case "control":
            return generateControl(node);
        case "operator":
            return generateOperator(node);
        case "option":
            return generateOption(node);
        case "operand":
            return generateOperand(node);
    }
}

function generateScript(node: ASTNode): string {
    return node.parameters
        .map((parameter) => renderParameter(parameter, "\n"))
        .filter((rendered) => rendered.trim() !== "")
        .join("\n");
}

function generateCommand(node: ASTNode): string {
    let script = node.name;

    const options = getParameter(node, "options");
    if (options) {
        const renderedOptions = renderParameter(options, " ");
        if (renderedOptions.trim() !== "") script += ` ${renderedOptions}`;
    }

    const operands = getParameter(node, "operands");
    if (operands) {
        const renderedOperands = renderParameter(operands, " ");
        if (renderedOperands.trim() !== "") script += ` ${renderedOperands}`;
    }

    return script;
}

function generateControl(node: ASTNode): string {
    if (!node.controlConfig) return "";

    let script = node.name;

    for (const slot of node.controlConfig.slots) {
        const parameter = getParameter(node, slot.key);
        if (!parameter) continue;

        const content = renderParameter(parameter, "\n");
        if (content.trim() === "" && !slot.obligatory) continue;

        if (slot.breakLineBefore) {
            if (script.length > 0 && !script.endsWith("\n")) script += "\n";
        } else {
            script = ensureSpaceSeparator(script);
        }

        if (slot.syntaxPrefix) script += slot.syntaxPrefix;

        if (parameter.source === "input") {
            script += `\n${indent(content)}`;
        } else {
            script = ensureSpaceSeparator(script);
            script += content;
        }
    }

    if (script.length > 0 && !script.endsWith("\n")) script += "\n";
    return script + node.controlConfig.syntaxEnd;
}

function generateOperator(node: ASTNode): string {
    if (!node.operatorConfig) return "";

    const parts: string[] = [];

    for (const slot of node.operatorConfig.slots) {
        const parameter = getParameter(node, slot.key);
        if (!parameter) continue;

        const content =
            parameter.source === "input"
                ? renderChildren(parameter, "\n")
                : quoteArgumentIfUnsafe(parameter.value);
        if (parameter.source === "input" && content.trim() === "") continue;

        if (slot.symbol === undefined) {
            parts.push(content);
        } else if (slot.symbolPlacement === "before") {
            parts.push(`${slot.symbol} ${content}`);
        } else {
            parts.push(`${content} ${slot.symbol}`);
        }
    }

    return parts.join(" ");
}

function generateOption(node: ASTNode): string {
    const flag = getParameterValue(node, "flag");
    if (flag.trim() === "") return "";

    const valueParameter = getParameter(node, "value");
    if (!valueParameter) return flag;

    return `${flag} ${quoteArgumentIfUnsafe(valueParameter.value)}`;
}

function generateOperand(node: ASTNode): string {
    const valueParameter = getParameter(node, "value");
    if (!valueParameter) return "";
    return quoteArgumentIfUnsafe(valueParameter.value);
}

function getParameter(node: ASTNode, key: string): ASTParameter | undefined {
    return node.parameters.find((parameter) => parameter.key === key);
}

function getParameterValue(node: ASTNode, key: string): string {
    return getParameter(node, key)?.value ?? "";
}

function renderParameter(parameter: ASTParameter, separator: string): string {
    if (parameter.source === "input") {
        return renderChildren(parameter, separator);
    }
    return parameter.value;
}

function renderChildren(parameter: ASTParameter, separator: string): string {
    return parameter.children
        .map((child) => dispatch(child))
        .filter((rendered) => rendered.trim() !== "")
        .join(separator);
}

function ensureSpaceSeparator(value: string): string {
    if (value.length > 0 && !value.endsWith("\n") && !value.endsWith(" ")) {
        return value + " ";
    }
    return value;
}

function quoteArgumentIfUnsafe(rawArgument: string): string {
    if (rawArgument.length === 0) return "''";
    if (SAFE_ARGUMENT_PATTERN.test(rawArgument)) return rawArgument;
    return `'${rawArgument.replace(/'/g, "'\\''")}'`;
}

function indent(code: string): string {
    return code
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
}
