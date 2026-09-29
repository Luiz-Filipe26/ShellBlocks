import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import cliDefinitionsSchema from "@/assets/data/cli_schema.json";
import * as CLI from "../types/cli";

export interface CliDefinitionsParseResult {
    definitions: CLI.CliDefinitions;
    warnings: string[];
}

export class CliDefinitionsValidationError extends Error {
    public readonly problems: string[];

    constructor(problems: string[]) {
        super(`Definições CLI inválidas:\n- ${problems.join("\n- ")}`);
        this.name = "CliDefinitionsValidationError";
        this.problems = problems;
    }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateStructure = ajv.compile<CLI.RawCliDefinitions>(cliDefinitionsSchema);

export function parseCliDefinitions(input: unknown): CliDefinitionsParseResult {
    if (!validateStructure(input)) {
        throw new CliDefinitionsValidationError(
            formatSchemaErrors(validateStructure.errors),
        );
    }

    const semanticResult = validateSemantics(input);
    if (semanticResult.errors.length > 0) {
        throw new CliDefinitionsValidationError(semanticResult.errors);
    }

    return {
        definitions: normalizeCliDefinitions(input),
        warnings: semanticResult.warnings,
    };
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string[] {
    return (errors ?? []).map((error) => {
        const path = error.instancePath || "/";
        return `${path}: ${error.message ?? "formato inválido"}`;
    });
}

function validateSemantics(raw: CLI.RawCliDefinitions): {
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entityIds = new Set<string>();

    for (const command of raw.commands) {
        registerUniqueId(command.id, "entidade", entityIds, errors);
        validateCommand(command, errors);
    }

    for (const operator of raw.operators ?? []) {
        registerUniqueId(operator.id, "entidade", entityIds, errors);
        validateOperator(operator, errors);
    }

    for (const control of raw.controls ?? []) {
        registerUniqueId(control.id, "entidade", entityIds, errors);
        validateControl(control, errors);
    }

    const categorizedIds = new Set<string>();
    for (const category of raw.categories) {
        const idsInCategory = new Set<string>();
        for (const entityId of category.entities ?? []) {
            if (idsInCategory.has(entityId)) {
                errors.push(
                    `A categoria "${category.name}" repete a entidade "${entityId}".`,
                );
                continue;
            }
            idsInCategory.add(entityId);

            if (!entityIds.has(entityId)) {
                errors.push(
                    `A categoria "${category.name}" referencia a entidade inexistente "${entityId}".`,
                );
            } else {
                categorizedIds.add(entityId);
            }
        }
    }

    for (const entityId of entityIds) {
        if (!categorizedIds.has(entityId)) {
            warnings.push(
                `A entidade "${entityId}" não pertence a nenhuma categoria.`,
            );
        }
    }

    return { errors, warnings };
}

function validateCommand(command: CLI.RawCLICommand, errors: string[]): void {
    const optionFlags = new Set<string>();
    const optionSpellings = new Map<string, string>();

    for (const option of command.options ?? []) {
        if (optionFlags.has(option.flag)) {
            errors.push(
                `O comando "${command.id}" repete a option canônica "${option.flag}".`,
            );
        } else {
            registerOptionSpelling(
                command.id,
                option.flag,
                option.flag,
                optionSpellings,
                errors,
            );
        }
        optionFlags.add(option.flag);
        if (option.longFlag !== undefined) {
            registerOptionSpelling(
                command.id,
                option.longFlag,
                option.flag,
                optionSpellings,
                errors,
            );
        }
        validateValueRegexes(
            option.argument?.validations ?? [],
            `argumento da option "${option.flag}" do comando "${command.id}"`,
            errors,
        );
    }

    for (const group of command.exclusiveOptions ?? []) {
        const groupFlags = new Set<string>();
        for (const flag of group) {
            if (groupFlags.has(flag)) {
                errors.push(
                    `Um grupo exclusiveOptions do comando "${command.id}" repete "${flag}".`,
                );
            }
            groupFlags.add(flag);
            if (!optionFlags.has(flag)) {
                errors.push(
                    `Um grupo exclusiveOptions do comando "${command.id}" referencia a option canônica inexistente "${flag}".`,
                );
            }
        }
    }

    const operandIds = new Set<string>();
    for (const operand of command.operands ?? []) {
        registerUniqueId(
            operand.id,
            `operando do comando "${command.id}"`,
            operandIds,
            errors,
        );
        if (
            operand.cardinality.max !== "unlimited" &&
            operand.cardinality.max < operand.cardinality.min
        ) {
            errors.push(
                `O operando "${operand.id}" do comando "${command.id}" possui max menor que min.`,
            );
        }
        validateValueRegexes(
            operand.validations ?? [],
            `operando "${operand.id}" do comando "${command.id}"`,
            errors,
        );
    }

    const syntaxRules = command.operandSyntaxRules ?? [];
    if (syntaxRules.length > 0) {
        if (!syntaxRules.some((rule) => rule.errorMessage === null)) {
            errors.push(
                `O comando "${command.id}" precisa de ao menos uma operandSyntaxRule de aceitação.`,
            );
        }
    }

    syntaxRules.forEach((rule, index) => {
        try {
            new RegExp(`^(?:${rule.regexPattern})$`);
        } catch (error) {
            errors.push(
                `A operandSyntaxRule ${index} do comando "${command.id}" possui regex inválida: ${getErrorMessage(error)}.`,
            );
        }
    });
}

function registerOptionSpelling(
    commandId: string,
    spelling: string,
    canonicalFlag: string,
    spellings: Map<string, string>,
    errors: string[],
): void {
    const owner = spellings.get(spelling);
    if (owner !== undefined) {
        errors.push(
            `No comando "${commandId}", a grafia de option "${spelling}" colide entre "${owner}" e "${canonicalFlag}".`,
        );
        return;
    }
    spellings.set(spelling, canonicalFlag);
}

function validateOperator(operator: CLI.RawCLIOperator, errors: string[]): void {
    const slotsByName = new Map<string, CLI.RawCLIOperatorSlot>();
    for (const slot of operator.slots) {
        if (slotsByName.has(slot.name)) {
            errors.push(
                `O operador "${operator.id}" repete o slot "${slot.name}".`,
            );
        } else {
            slotsByName.set(slot.name, slot);
        }

        if (slot.type === CLI.OperatorSlotType.VALUE) {
            validateValueRegexes(
                slot.validations ?? [],
                `slot "${slot.name}" do operador "${operator.id}"`,
                errors,
            );
        }
    }

    const implicitSlots = new Set<string>();
    for (const slotName of operator.slotsWithImplicitData ?? []) {
        if (implicitSlots.has(slotName)) {
            errors.push(
                `O operador "${operator.id}" repete "${slotName}" em slotsWithImplicitData.`,
            );
        }
        implicitSlots.add(slotName);

        const slot = slotsByName.get(slotName);
        if (slot === undefined) {
            errors.push(
                `O operador "${operator.id}" referencia o slot inexistente "${slotName}" em slotsWithImplicitData.`,
            );
        } else if (slot.type !== CLI.OperatorSlotType.STATEMENT) {
            errors.push(
                `O operador "${operator.id}" referencia o value slot "${slotName}" em slotsWithImplicitData.`,
            );
        }
    }
}

function validateControl(control: CLI.RawCLIControl, errors: string[]): void {
    const slotNames = new Set<string>();
    for (const slot of control.slots) {
        registerUniqueId(
            slot.name,
            `slot do controle "${control.id}"`,
            slotNames,
            errors,
        );
    }
}

function validateValueRegexes(
    validations: CLI.RawCLIValidation[],
    owner: string,
    errors: string[],
): void {
    validations.forEach((validation, index) => {
        try {
            new RegExp(validation.regex);
        } catch (error) {
            errors.push(
                `A validação ${index} de ${owner} possui regex inválida: ${getErrorMessage(error)}.`,
            );
        }
    });
}

function registerUniqueId(
    id: string,
    scope: string,
    knownIds: Set<string>,
    errors: string[],
): void {
    if (knownIds.has(id)) {
        errors.push(`ID duplicado "${id}" no escopo de ${scope}.`);
    } else {
        knownIds.add(id);
    }
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function normalizeCliDefinitions(raw: CLI.RawCliDefinitions): CLI.CliDefinitions {
    return {
        commands: raw.commands.map(normalizeCommand),
        operators: (raw.operators ?? []).map(normalizeOperator),
        controls: (raw.controls ?? []).map(normalizeControl),
        categories: raw.categories.map((category) => ({
            name: category.name,
            entities: [...(category.entities ?? [])],
        })),
    };
}

function normalizeCommand(command: CLI.RawCLICommand): CLI.CLICommand {
    return {
        id: command.id,
        shellCommand: command.shellCommand,
        label: command.label,
        description: command.description ?? "",
        color: command.color,
        optionColor: command.optionColor,
        options: (command.options ?? []).map(normalizeOption),
        exclusiveOptions: (command.exclusiveOptions ?? []).map((group) => [
            ...group,
        ]),
        operands: (command.operands ?? []).map(normalizeOperand),
        operandSyntaxRules: (command.operandSyntaxRules ?? []).map((rule) => ({
            ...rule,
        })),
        operandIdsSequenceDelimiter: command.operandIdsSequenceDelimiter,
    };
}

function normalizeOption(option: CLI.RawCLIOption): CLI.CLIOption {
    return {
        flag: option.flag,
        longFlag: option.longFlag,
        description: option.description ?? "",
        argument:
            option.argument === undefined
                ? undefined
                : normalizeArgument(option.argument),
    };
}

function normalizeArgument(argument: CLI.RawCLIArgument): CLI.CLIArgument {
    return {
        type: argument.type,
        label: argument.label,
        defaultValue: argument.defaultValue ?? "",
        allowEmptyValue: argument.allowEmptyValue ?? true,
        validations: normalizeValidations(argument.validations),
    };
}

function normalizeOperand(operand: CLI.RawCLIOperand): CLI.CLIOperand {
    return {
        id: operand.id,
        label: operand.label,
        description: operand.description ?? "",
        color: operand.color,
        type: operand.type,
        defaultValue: operand.defaultValue ?? "",
        allowEmptyValue: operand.allowEmptyValue ?? true,
        optionalWithImplicitInput: operand.optionalWithImplicitInput ?? false,
        cardinality: { ...operand.cardinality },
        validations: normalizeValidations(operand.validations),
    };
}

function normalizeValidations(
    validations: CLI.RawCLIValidation[] | undefined,
): CLI.CLIValidation[] {
    return (validations ?? []).map((validation) => ({ ...validation }));
}

function normalizeOperator(operator: CLI.RawCLIOperator): CLI.CLIOperator {
    return {
        id: operator.id,
        label: operator.label,
        description: operator.description ?? "",
        color: operator.color,
        slots: operator.slots.map(normalizeOperatorSlot),
        slotsWithImplicitData: [...(operator.slotsWithImplicitData ?? [])],
    };
}

function normalizeOperatorSlot(
    slot: CLI.RawCLIOperatorSlot,
): CLI.CLIOperatorSlot {
    const base = {
        name: slot.name,
        label: slot.label,
    };
    const symbol =
        slot.symbol === undefined
            ? {}
            : {
                  symbol: slot.symbol,
                  symbolPlacement: slot.symbolPlacement,
              };

    if (slot.type === CLI.OperatorSlotType.STATEMENT) {
        return { ...base, ...symbol, type: CLI.OperatorSlotType.STATEMENT };
    }

    return {
        ...base,
        ...symbol,
        type: CLI.OperatorSlotType.VALUE,
        valueType: slot.valueType,
        defaultValue: slot.defaultValue ?? "",
        allowEmptyValue: slot.allowEmptyValue ?? true,
        validations: normalizeValidations(slot.validations),
    };
}

function normalizeControl(control: CLI.RawCLIControl): CLI.CLIControl {
    return {
        id: control.id,
        shellCommand: control.shellCommand,
        label: control.label,
        description: control.description ?? "",
        color: control.color,
        syntaxEnd: control.syntaxEnd,
        slots: control.slots.map(normalizeControlSlot),
    };
}

function normalizeControlSlot(
    slot: CLI.RawCLIControlSlot,
): CLI.CLIControlSlot {
    return {
        name: slot.name,
        label: slot.label,
        syntaxPrefix: slot.syntaxPrefix,
        obligatory: slot.obligatory,
        breakLineBefore: slot.breakLineBefore ?? false,
    };
}
