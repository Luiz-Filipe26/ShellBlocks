import * as Blockly from "blockly";
import { Assets } from "../constants/Assets";
import * as BlockIDs from "../constants/blockIds";
import * as CLI from "../types/cli";
import { showHelpBalloon } from "../ui/helpBalloon";
import { getErrors } from "../validation/validationManager";
import * as ValidationErrors from "../constants/validationErrors";
import { addLocalChangeListener } from "../events/blockEventListeners";

export function createCardinalityField(size: number = 28): Blockly.FieldImage {
    return new Blockly.FieldImage(
        Assets.Icons.Empty,
        size,
        size,
        "cardinality",
    );
}

export function updateCardinalityIndicator(commandBlock: Blockly.Block): void {
    const field = commandBlock.getField(BlockIDs.FIELDS.CARDINALITY_ICON);
    if (!(field instanceof Blockly.FieldImage)) return;

    const errors = getErrors(commandBlock);
    const hasCardinalityProblems = errors.some((error) =>
        error.id.startsWith(
            ValidationErrors.VALIDATION_ERROR_PREFIXES.CARDINALITY,
        ),
    );

    field.setValue(
        hasCardinalityProblems
            ? Assets.Icons.CardinalityError
            : Assets.Icons.Empty,
    );
}

export function createGenericHelpIcon(
    getHelpTextFn: () => string,
    altText: string = "?",
    size: number = 30,
): Blockly.FieldImage {
    const helpIcon = new Blockly.FieldImage(
        Assets.Icons.Info,
        size,
        size,
        altText,
    );

    helpIcon.setOnClickHandler(() => {
        const helpText = getHelpTextFn();
        if (!helpText) return;
        const svgElement = helpIcon.getSvgRoot();
        if (svgElement) showHelpBalloon(helpText, svgElement);
    });

    return helpIcon;
}

export function setupParentIndicator(
    block: Blockly.Block,
    commandDefinition: CLI.CLICommand,
    textWhenOutside: string,
): void {
    addLocalChangeListener(block, () => {
        const indicatorField = block.getField(BlockIDs.FIELDS.PARENT_INDICATOR);
        if (!indicatorField) return;

        const insideRoot =
            block.getSurroundParent()?.type ===
            BlockIDs.commandBlockType(commandDefinition);

        indicatorField.setValue(insideRoot ? "" : textWhenOutside);
    });
}
