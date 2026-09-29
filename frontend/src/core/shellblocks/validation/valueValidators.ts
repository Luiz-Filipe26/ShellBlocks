import * as Blockly from "blockly";
import type { CLIValidation } from "../types/cli";
import * as ValidationErrors from "../constants/validationErrors";
import { clearError, setError } from "./validationManager";

export interface ScalarValueDefinition {
    allowEmptyValue: boolean;
    validations: CLIValidation[];
}

export function clearScalarValueErrors(
    block: Blockly.Block,
    definition: ScalarValueDefinition,
    errorScope: string,
): void {
    clearError(block, ValidationErrors.valueEmptyError(errorScope));
    definition.validations.forEach((_, index) => {
        clearError(block, ValidationErrors.valueRegexRuleError(errorScope, index));
    });
}

export function validateScalarValue(
    text: string,
    definition: ScalarValueDefinition,
    block: Blockly.Block,
    errorScope: string,
): void {
    const emptyErrorId = ValidationErrors.valueEmptyError(errorScope);
    if (!definition.allowEmptyValue && text.length === 0) {
        setError(block, emptyErrorId, "O valor não pode ser vazio.");
    } else {
        clearError(block, emptyErrorId);
    }

    definition.validations.forEach((rule, index) => {
        const ruleErrorId = ValidationErrors.valueRegexRuleError(
            errorScope,
            index,
        );
        const regex = new RegExp(rule.regex);

        if (!regex.test(text)) {
            setError(block, ruleErrorId, rule.errorMessage);
        } else {
            clearError(block, ruleErrorId);
        }
    });
}
