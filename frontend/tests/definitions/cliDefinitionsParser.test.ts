import { describe, expect, it } from "vitest";
import {
    CliDefinitionsValidationError,
    parseCliDefinitions,
} from "@/core/shellblocks/definitions/cliDefinitionsParser";
import officialDefinitions from "@/assets/data/cli_definitions.json";
import { validRawDefinitions } from "../helpers/cliFixtures";

function parseProblems(input: unknown): string[] {
    try {
        parseCliDefinitions(input);
        throw new Error("A entrada deveria ser rejeitada.");
    } catch (error) {
        expect(error).toBeInstanceOf(CliDefinitionsValidationError);
        return (error as CliDefinitionsValidationError).problems;
    }
}

describe("parseCliDefinitions", () => {
    it("aceita as definições oficiais sem warnings", () => {
        const result = parseCliDefinitions(officialDefinitions);

        expect(result.warnings).toEqual([]);
        expect(result.definitions.commands.length).toBeGreaterThan(0);
    });

    it("normaliza coleções, descrições e valores escalares omitidos", () => {
        const raw = validRawDefinitions();
        raw.operators = undefined;
        raw.controls = undefined;
        raw.commands[0].options = undefined;
        raw.commands[0].operands = undefined;
        raw.commands[0].exclusiveOptions = undefined;
        raw.commands[1].operandSyntaxRules = undefined;
        raw.commands[1].operandIdsSequenceDelimiter = undefined;
        raw.categories[0].entities = undefined;

        const { definitions, warnings } = parseCliDefinitions(raw);

        expect(definitions.operators).toEqual([]);
        expect(definitions.controls).toEqual([]);
        expect(definitions.commands[0]).toMatchObject({
            description: "",
            options: [],
            operands: [],
            exclusiveOptions: [],
        });
        expect(definitions.commands[1].operandSyntaxRules).toEqual([]);
        expect(definitions.categories[0].entities).toEqual([]);
        expect(warnings).toContain('A entidade "echo" não pertence a nenhuma categoria.');
    });

    it("aplica defaults a argumentos, operandos, slots e controles", () => {
        const { definitions } = parseCliDefinitions(validRawDefinitions());
        const echo = definitions.commands[0];
        const argument = echo.options[1].argument;
        const operand = echo.operands[0];
        const redirectTarget = definitions.operators[1].slots[1];

        expect(argument).toMatchObject({ defaultValue: "", allowEmptyValue: false });
        expect(operand).toMatchObject({
            description: "",
            defaultValue: "",
            allowEmptyValue: true,
            optionalWithImplicitInput: false,
            validations: [],
        });
        expect(redirectTarget).toMatchObject({
            defaultValue: "",
            allowEmptyValue: false,
            validations: [],
        });
        expect(definitions.controls[0].slots[0].breakLineBefore).toBe(false);
    });

    it.each([
        ["estrutura", { commands: [], categories: [], extra: true }, "additional"],
        [
            "ID externo",
            (() => {
                const raw = validRawDefinitions();
                raw.commands[0].id = "echo:internal";
                return raw;
            })(),
            "pattern",
        ],
        [
            "cardinalidade local",
            (() => {
                const raw = validRawDefinitions();
                raw.commands[0].operands![0].cardinality.min = -1;
                return raw;
            })(),
            ">= 0",
        ],
    ])("rejeita %s inválida", (_name, input, expected) => {
        expect(parseProblems(input).join("\n")).toContain(expected);
    });

    it("rejeita IDs duplicados e referências inexistentes", () => {
        const raw = validRawDefinitions();
        raw.operators![0].id = "echo";
        raw.categories[0].entities!.push("missing");

        const problems = parseProblems(raw).join("\n");
        expect(problems).toContain('ID duplicado "echo"');
        expect(problems).toContain('entidade inexistente "missing"');
    });

    it("rejeita máximo finito menor que o mínimo", () => {
        const raw = validRawDefinitions();
        raw.commands[0].operands![0].cardinality = { min: 2, max: 1 };

        expect(parseProblems(raw).join("\n")).toContain("max menor que min");
    });

    it("rejeita referências inválidas em exclusividade e implicit input", () => {
        const raw = validRawDefinitions();
        raw.commands[0].exclusiveOptions = [["-n", "-x"]];
        raw.operators![0].slotsWithImplicitData = ["missing"];

        const problems = parseProblems(raw).join("\n");
        expect(problems).toContain('option canônica inexistente "-x"');
        expect(problems).toContain('slot inexistente "missing"');
    });

    it("rejeita regex inválidas de valor e de sintaxe", () => {
        const raw = validRawDefinitions();
        raw.commands[0].operands![0].validations = [
            { regex: "[", errorMessage: "inválida" },
        ];
        raw.commands[1].operandSyntaxRules![0].regexPattern = "(";

        const problems = parseProblems(raw).join("\n");
        expect(problems).toContain("possui regex inválida");
        expect(problems).toContain("operandSyntaxRule 0");
    });

    it("separa warnings de entidades órfãs dos erros de configuração", () => {
        const raw = validRawDefinitions();
        raw.categories[0].entities = ["echo"];

        const result = parseCliDefinitions(raw);
        expect(result.warnings).toEqual([
            'A entidade "grep" não pertence a nenhuma categoria.',
            'A entidade "pipe" não pertence a nenhuma categoria.',
            'A entidade "redirect_out" não pertence a nenhuma categoria.',
            'A entidade "if_statement" não pertence a nenhuma categoria.',
        ]);
    });
});
