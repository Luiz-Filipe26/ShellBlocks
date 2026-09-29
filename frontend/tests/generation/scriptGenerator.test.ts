import { describe, expect, it } from "vitest";
import { generateShellScript } from "../../src/core/shellblocks/generation/scriptGenerator";
import type {
    ASTNode,
    ASTOperatorConfig,
    ASTParameter,
} from "../../src/core/shellblocks/types/ast";

const field = (key: string, value: string): ASTParameter => ({
    key,
    source: "field",
    value,
    children: [],
});

const input = (key: string, children: ASTNode[]): ASTParameter => ({
    key,
    source: "input",
    value: "",
    children,
});

const operand = (value: string): ASTNode => ({
    type: "operand",
    name: "value",
    parameters: [field("value", value)],
});

const option = (flag: string, value?: string): ASTNode => ({
    type: "option",
    name: "option",
    parameters: [
        field("flag", flag),
        ...(value === undefined ? [] : [field("value", value)]),
    ],
});

const command = (
    name: string,
    options: ASTNode[] = [],
    operands: ASTNode[] = [],
): ASTNode => ({
    type: "command",
    name,
    parameters: [input("options", options), input("operands", operands)],
});

const operator = (
    name: string,
    parameters: ASTParameter[],
    slots: ASTOperatorConfig["slots"],
): ASTNode => ({
    type: "operator",
    name,
    parameters,
    operatorConfig: { slots },
});

describe("generateShellScript", () => {
    it("gera comandos, options e operandos preservando ordem", () => {
        const ast = command(
            "grep",
            [option("-i"), option("--regexp", "Ana Maria")],
            [operand("nomes.txt")],
        );

        expect(generateShellScript(ast)).toBe(
            "grep -i --regexp 'Ana Maria' nomes.txt",
        );
    });

    it("distingue argumento ausente de argumento vazio", () => {
        expect(generateShellScript(option("-n"))).toBe("-n");
        expect(generateShellScript(option("--prefix", ""))).toBe(
            "--prefix ''",
        );
        expect(generateShellScript(operand(""))).toBe("''");
    });

    it("protege espaços e aspas simples em valores Shell", () => {
        expect(generateShellScript(command("echo", [], [operand("a b")]))).toBe(
            "echo 'a b'",
        );
        expect(generateShellScript(command("echo", [], [operand("d'água")]))).toBe(
            "echo 'd'\\''água'",
        );
    });

    it("gera operadores com símbolos antes e depois dos slots", () => {
        const pipe = operator(
            "pipe",
            [input("A", [command("cat", [], [operand("nomes.txt")])]), input("B", [command("grep", [], [operand("Ana")])])],
            [{ key: "A" }, { key: "B", symbol: "|", symbolPlacement: "before" }],
        );
        const background = operator(
            "background",
            [input("A", [command("sleep", [], [operand("1")])])],
            [{ key: "A", symbol: "& true", symbolPlacement: "after" }],
        );

        expect(generateShellScript(pipe)).toBe("cat nomes.txt | grep Ana");
        expect(generateShellScript(background)).toBe("sleep 1 & true");
    });

    it("gera redirecionamentos com destino textual, inclusive com espaços", () => {
        const redirect = operator(
            "redirect_out",
            [input("A", [command("echo", [], [operand("Olá")])]), field("B", "arquivo final.txt")],
            [{ key: "A" }, { key: "B", symbol: ">", symbolPlacement: "before" }],
        );

        expect(generateShellScript(redirect)).toBe(
            "echo 'Olá' > 'arquivo final.txt'",
        );

        const append = operator(
            "redirect_append",
            [input("A", [command("echo", [], [operand("mais")])]), field("B", "log.txt")],
            [{ key: "A" }, { key: "B", symbol: ">>", symbolPlacement: "before" }],
        );
        expect(generateShellScript(append)).toBe("echo mais >> log.txt");
    });

    it("gera controles com quebra anterior ao else", () => {
        const control: ASTNode = {
            type: "control",
            name: "if",
            parameters: [
                input("CONDITION", [command("true")]),
                input("DO", [command("echo", [], [operand("sim")])]),
                input("ELSE", [command("echo", [], [operand("não")])]),
            ],
            controlConfig: {
                syntaxEnd: "fi",
                slots: [
                    { key: "CONDITION", obligatory: true, breakLineBefore: false },
                    { key: "DO", syntaxPrefix: "; then", obligatory: true, breakLineBefore: false },
                    { key: "ELSE", syntaxPrefix: "else ", obligatory: false, breakLineBefore: true },
                ],
            },
        };

        expect(generateShellScript(control)).toBe(
            "if \n  true ; then\n  echo sim\nelse \n  echo 'não'\nfi",
        );
    });

    it("gera while com condição e corpo", () => {
        const control: ASTNode = {
            type: "control",
            name: "while",
            parameters: [
                input("CONDITION", [command("true")]),
                input("DO", [command("echo", [], [operand("loop")])]),
            ],
            controlConfig: {
                syntaxEnd: "done",
                slots: [
                    { key: "CONDITION", obligatory: true, breakLineBefore: false },
                    { key: "DO", syntaxPrefix: "; do ", obligatory: true, breakLineBefore: false },
                ],
            },
        };

        expect(generateShellScript(control)).toBe(
            "while \n  true ; do \n  echo loop\ndone",
        );
    });

    it("não depende do registro Blockly para interpretar uma AST pronta", () => {
        const ast: ASTNode = {
            type: "script",
            name: "script",
            parameters: [input("commands", [command("pwd")])],
        };

        expect(generateShellScript(ast)).toBe("pwd");
    });
});
