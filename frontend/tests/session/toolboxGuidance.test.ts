import { describe, expect, it } from "vitest";
import officialData from "@/assets/data/levels.json";
import rawDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { parseGameData } from "@/pages/features/session/gameDataParser";
import { resolveToolboxGuidance, type ToolboxGuidance } from "@/pages/features/session/toolboxGuidance";

const definitions = parseCliDefinitions(rawDefinitions).definitions;
const variants: ToolboxGuidance[] = [
    { entity: "command", commandId: "ls" },
    { entity: "option", commandId: "ls", flag: "-l" },
    { entity: "operand", commandId: "cp", operandId: "source" },
    { entity: "operator", operatorId: "pipe" },
    { entity: "control", controlId: "if_statement" },
];
function data(toolboxGuidance?: unknown) {
    return { levels: [{ id: "test", title: "Test", ...(toolboxGuidance === undefined ? {} : { toolboxGuidance }) }], levelOrder: ["test"] };
}

describe("contrato toolboxGuidance", () => {
    it.each(variants)("aceita e resolve $entity pela identidade de domínio", (reference) => {
        expect(parseGameData(data([reference]), definitions).levels[0].toolboxGuidance).toEqual([reference]);
        expect(resolveToolboxGuidance([reference], definitions).unresolved).toEqual([]);
    });
    it("aceita ausência, lista vazia e valida todas as referências oficiais", () => {
        expect(parseGameData({ levels: [{ id: "test", title: "Test" }], levelOrder: ["test"] }).levels[0].toolboxGuidance).toEqual([]);
        expect(parseGameData(data([])).levels[0].toolboxGuidance).toEqual([]);
        expect(parseGameData(data(variants)).levels[0].toolboxGuidance).toEqual(variants);
        expect(parseGameData(officialData, definitions)).toMatchObject(officialData);
    });
    it.each([
        null, {}, [{ entity: "category", categoryId: "x" }],
        [{ entity: "command" }], [{ entity: "option", flag: "-l" }],
        [{ entity: "option", commandId: "ls" }], [{ entity: "operand", commandId: "cp" }],
        [{ entity: "operator" }], [{ entity: "control" }],
        [{ entity: "command", commandId: "ls", flag: "-l" }],
        [{ entity: "option", commandId: "ls", longFlag: "--all" }],
        [{ entity: "operand", commandId: "cp", operandId: "source", operatorId: "pipe" }],
        [{ entity: "command", commandId: 3 }],
        [{ entity: "command", commandId: "" }],
        [{ entity: "option", commandId: "", flag: "-l" }],
        [{ entity: "option", commandId: "ls", flag: "" }],
        [{ entity: "operand", commandId: "", operandId: "source" }],
        [{ entity: "operand", commandId: "cp", operandId: "" }],
        [{ entity: "operator", operatorId: "" }],
        [{ entity: "control", controlId: "" }],
        [{ entity: "option", commandId: "ls", flag: "-l", longFlag: "--all" }],
        [{ entity: "command", commandId: "ls", type: "command:ls" }],
    ])("rejeita forma inválida %j", (references) => {
        expect(() => parseGameData(data(references))).toThrow("GameData inválido");
    });
    it.each(variants)("rejeita campos extras em $entity", (reference) => {
        expect(() => parseGameData(data([{ ...reference, extra: true }]))).toThrow("GameData inválido");
    });
    it.each(variants)("rejeita duplicata de $entity", (reference) => {
        expect(() => parseGameData(data([reference, { ...reference }]))).toThrow("duplicada");
    });
    it("identidades locais e variantes diferentes não são duplicatas", () => {
        const references = [
            ...variants,
            { entity: "option", commandId: "ls", flag: "-a" },
            { entity: "option", commandId: "cp", flag: "-l" },
            { entity: "operand", commandId: "mv", operandId: "source" },
        ];
        expect(() => parseGameData(data(references))).not.toThrow();
    });
    it.each([
        { entity: "command", commandId: "missing" },
        { entity: "option", commandId: "ls", flag: "--all" },
        { entity: "operand", commandId: "cp", operandId: "missing" },
        { entity: "operator", operatorId: "missing" },
        { entity: "control", controlId: "missing" },
    ])("rejeita referência oficial inexistente %j", (reference) => {
        expect(() => parseGameData(data([reference]), definitions)).toThrow("entidade inexistente");
    });
    it("rejeita referência oficial existente sem alvo na toolbox", () => {
        const hidden = { ...definitions, categories: [] };
        expect(() => parseGameData(data(variants), hidden)).toThrow("sem alvo na toolbox");
    });
});

describe("resolução semântica", () => {
    it("resolve cada entidade e reúne flags no único bloco de options", () => {
        const { targets } = resolveToolboxGuidance([...variants, { entity: "option", commandId: "ls", flag: "-h" }], definitions);
        expect(new Set(targets.keys())).toEqual(new Set(["command:ls", "option:ls", "operand:cp:source", "operator:pipe", "control:if_statement"]));
        expect(targets.get("option:ls")).toEqual(new Set(["-l", "-h"]));
    });
    it("ordem das referências não muda a relevância", () => {
        expect(resolveToolboxGuidance([...variants].reverse(), definitions).targets).toEqual(resolveToolboxGuidance(variants, definitions).targets);
    });
    it("ignora só referências ausentes nas definições customizadas", () => {
        const custom = { ...definitions, commands: definitions.commands.filter((command) => command.id !== "ls") };
        const result = resolveToolboxGuidance(variants, custom);
        expect(result.unresolved.map((problem) => problem.reference.entity)).toEqual(["command", "option"]);
        expect(result.targets.size).toBe(3);
    });
    it("não usa longFlag, label ou posição como substitutos", () => {
        const refs: ToolboxGuidance[] = [{ entity: "command", commandId: definitions.commands[0].label }, { entity: "option", commandId: "ls", flag: "--all" }];
        expect(resolveToolboxGuidance(refs, definitions).targets.size).toBe(0);
    });
    it("considera alvos reais removidos de uma toolbox customizada", () => {
        expect(resolveToolboxGuidance(variants, definitions, new Set(["operator:pipe"])).targets.size).toBe(1);
    });
});
