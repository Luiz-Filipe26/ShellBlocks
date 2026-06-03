import { ASTNode, ASTParameter } from "../types/ast"; // Ajuste o caminho conforme sua árvore

const SAFE_ARGUMENT_PATTERN = /^[a-zA-Z0-9._/-]+$/;

export function generateShellScript(rootNode: ASTNode | undefined | null): string {
    if (!rootNode) throw new Error("AST não pode ser nula");
    return dispatch(rootNode);
}

function dispatch(node: ASTNode | undefined): string {
    if (!node) return "";

    switch (node.type) {
        case "script": return generateScript(node);
        case "command": return generateCommand(node);
        case "control": return generateControl(node);
        case "operator": return generateOperator(node);
        case "option": return generateOption(node);
        case "operand": return generateOperand(node);
        default: return "";
    }
}

function generateScript(node: ASTNode): string {
    if (!node.parameters) return "";
    return node.parameters
        .map((p) => renderParameter(p, "\n"))
        .filter((s) => s.trim() !== "")
        .join("\n");
}

function generateCommand(node: ASTNode): string {
    let sb = node.name || "";

    const optionsParam = getParameter(node, "options");
    if (optionsParam) {
        const val = renderParameter(optionsParam, " ");
        if (val.trim() !== "") sb += ` ${val}`;
    }

    const operandsParam = getParameter(node, "operands");
    if (operandsParam) {
        const val = renderParameter(operandsParam, " ");
        if (val.trim() !== "") sb += ` ${val}`;
    }

    return sb;
}

function generateControl(node: ASTNode): string {
    if (!node.controlConfig) return "";

    let sb = node.name || "";

    for (const slot of node.controlConfig.slots) {
        const parameter = getParameter(node, slot.key);

        if (parameter) {
            const content = renderParameter(parameter, "\n");

            if (content.trim() === "" && !slot.obligatory) continue;

            sb = ensureSpaceSeparator(sb);

            if (slot.syntaxPrefix) {
                sb += slot.syntaxPrefix;
            }

            if (isContainer(parameter)) {
                sb += `\n${indent(content)}`;
            } else {
                sb = ensureSpaceSeparator(sb);
                sb += content;
            }
        }
    }

    if (node.controlConfig.syntaxEnd) {
        if (sb.length > 0 && !sb.endsWith("\n")) sb += "\n";
        sb += node.controlConfig.syntaxEnd;
    }

    return sb;
}

function generateOperator(node: ASTNode): string {
    if (!node.operatorConfig) return "";

    let sb = "";

    for (const slot of node.operatorConfig.slots) {
        const parameter = getParameter(node, slot.key);

        if (parameter) {
            let content = "";

            if (isContainer(parameter)) {
                content = renderChildren(parameter, "\n");
            } else {
                const rawValue = parameter.value;
                if (!rawValue || rawValue.trim() === "") continue;
                content = quoteArgumentIfUnsafe(rawValue);
            }

            if (content.trim() === "") continue;

            if (slot.breakLineBefore) {
                if (sb.length > 0 && !sb.endsWith("\n")) sb += "\n";
            } else if (sb.length > 0) {
                sb += " ";
            }

            if (slot.symbol) {
                if (slot.symbolPlacement === "before") {
                    sb += `${slot.symbol} ${content}`;
                } else {
                    sb += `${content} ${slot.symbol}`;
                }
            } else {
                sb += content;
            }
        }
    }
    return sb;
}

function generateOption(node: ASTNode): string {
    const flag = getParameterValue(node, "flag");
    const value = getParameterValue(node, "value");

    let sb = "";
    if (flag.trim() !== "") {
        sb += flag;
        if (value.trim() !== "") {
            sb += ` ${quoteArgumentIfUnsafe(value)}`;
        }
    }
    return sb;
}

function generateOperand(node: ASTNode): string {
    const value = getParameterValue(node, "value");
    return value ? quoteArgumentIfUnsafe(value) : "";
}

// --- Funções Auxiliares ---

function getParameter(node: ASTNode, key: string): ASTParameter | undefined {
    return node.parameters?.find((p) => p.key === key);
}

function getParameterValue(node: ASTNode, key: string): string {
    return getParameter(node, key)?.value || "";
}

function isContainer(parameter: ASTParameter): boolean {
    return !!parameter.children && parameter.children.length > 0;
}

function renderParameter(parameter: ASTParameter, separator: string): string {
    if (isContainer(parameter)) {
        return renderChildren(parameter, separator);
    }
    return parameter.value || "";
}

function renderChildren(parameter: ASTParameter, separator: string): string {
    if (!parameter.children) return "";
    return parameter.children
        .map((child) => dispatch(child))
        .filter((rendered) => rendered.trim() !== "")
        .join(separator);
}

function ensureSpaceSeparator(str: string): string {
    if (str.length > 0) {
        const lastChar = str.slice(-1);
        if (lastChar !== "\n" && lastChar !== " ") {
            return str + " ";
        }
    }
    return str;
}

function quoteArgumentIfUnsafe(rawArgument: string): string {
    if (!rawArgument || rawArgument.length === 0) return "''";
    if (SAFE_ARGUMENT_PATTERN.test(rawArgument)) return rawArgument;
    return `'${rawArgument.replace(/'/g, "'\\''")}'`;
}

function indent(code: string): string {
    return code
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n");
}
