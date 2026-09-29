import type {
    CliDefinitions,
    RawCliDefinitions,
} from "@/core/shellblocks/types/cli";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";

export function validRawDefinitions(): RawCliDefinitions {
    return {
        commands: [
            {
                id: "echo",
                shellCommand: "echo",
                label: "echo",
                color: "#336699",
                options: [
                    { flag: "-n", description: "Sem quebra de linha" },
                    {
                        flag: "-r",
                        description: "Repetições",
                        argument: {
                            type: "number",
                            label: "Quantidade",
                            allowEmptyValue: false,
                            validations: [
                                {
                                    regex: "^[0-9]+$",
                                    errorMessage: "Use um número.",
                                },
                            ],
                        },
                    },
                ],
                exclusiveOptions: [["-n", "-r"]],
                operands: [
                    {
                        id: "text",
                        label: "Texto",
                        type: "string",
                        cardinality: { min: 1, max: 2 },
                    },
                ],
            },
            {
                id: "grep",
                shellCommand: "grep",
                label: "grep",
                color: "#663399",
                operands: [
                    {
                        id: "pattern",
                        label: "Padrão",
                        type: "string",
                        cardinality: { min: 1, max: 1 },
                    },
                    {
                        id: "files",
                        label: "Arquivos",
                        type: "file",
                        optionalWithImplicitInput: true,
                        cardinality: { min: 1, max: "unlimited" },
                    },
                ],
                operandIdsSequenceDelimiter: ">",
                operandSyntaxRules: [
                    {
                        regexPattern: "pattern>(files>)*",
                        errorMessage: null,
                    },
                    {
                        regexPattern: "files>pattern>",
                        errorMessage: "O padrão deve vir antes do arquivo.",
                    },
                ],
            },
        ],
        operators: [
            {
                id: "pipe",
                label: "pipe",
                color: "#996633",
                slots: [
                    { name: "A", type: "statement" },
                    {
                        name: "B",
                        type: "statement",
                        symbol: "|",
                        symbolPlacement: "before",
                    },
                ],
                slotsWithImplicitData: ["B"],
            },
            {
                id: "redirect_out",
                label: "redirecionar",
                color: "#996633",
                slots: [
                    { name: "A", type: "statement" },
                    {
                        name: "B",
                        type: "value",
                        valueType: "file",
                        allowEmptyValue: false,
                        symbol: ">",
                        symbolPlacement: "before",
                    },
                ],
            },
        ],
        controls: [
            {
                id: "if_statement",
                shellCommand: "if",
                label: "if",
                color: "#cc9900",
                syntaxEnd: "fi",
                slots: [
                    { name: "CONDITION", obligatory: true },
                    {
                        name: "DO",
                        syntaxPrefix: "; then",
                        obligatory: true,
                    },
                    {
                        name: "ELSE",
                        syntaxPrefix: "else ",
                        obligatory: false,
                        breakLineBefore: true,
                    },
                ],
            },
        ],
        categories: [
            {
                name: "Comandos",
                entities: [
                    "echo",
                    "grep",
                    "pipe",
                    "redirect_out",
                    "if_statement",
                ],
            },
        ],
    };
}

export function validDefinitions(): CliDefinitions {
    return parseCliDefinitions(validRawDefinitions()).definitions;
}
