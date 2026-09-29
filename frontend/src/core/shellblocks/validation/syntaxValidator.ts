import * as Blockly from "blockly";
import * as CLI from "../types/cli";
import { setError, clearError } from "./validationManager";
import { getBlockSemanticData } from "../serialization/metadataManager";
import { VALIDATION_ERRORS } from "../constants/validationErrors";

/**
 * Analisa a sequência de tokens dos operandos contra as regras de sintaxe.
 */
export function validateOperandSyntax(
    commandBlock: Blockly.Block,
    commandDefinition: CLI.CLICommand,
    operandBlocks: Blockly.Block[],
): void {
    clearError(commandBlock, VALIDATION_ERRORS.SYNTAX_ERROR_ID);

    const rules = commandDefinition.operandSyntaxRules;
    if (rules.length === 0) return;

    const normalizedSequence = getNormalizedSequence(
        operandBlocks,
        commandDefinition,
    );

    for (const rule of rules) {
        const regex = new RegExp(`^(?:${rule.regexPattern})$`);
        const regexSuccess = regex.test(normalizedSequence);
        if (regexSuccess && rule.errorMessage === null) return;
        if (regexSuccess && rule.errorMessage !== null) {
            setError(
                commandBlock,
                VALIDATION_ERRORS.SYNTAX_ERROR_ID,
                rule.errorMessage,
            );
            return;
        }
    }

    setError(
        commandBlock,
        VALIDATION_ERRORS.SYNTAX_ERROR_ID,
        "A ordem ou combinação de blocos é inválida para este comando.",
    );
}

function getNormalizedSequence(
    operandBlocks: Blockly.Block[],
    commandDefinition: CLI.CLICommand,
): string {
    const delimiter = commandDefinition.operandIdsSequenceDelimiter;
    if (delimiter === undefined) {
        throw new Error(
            `Comando ${commandDefinition.id} possui regras sintáticas sem delimitador.`,
        );
    }

    return operandBlocks
        .map((block) => {
            const data = getBlockSemanticData(block);
            return data ? `${data.name}${delimiter}` : "";
        })
        .join("");
}
