import * as Blockly from "blockly";
import { Assets } from "../constants/Assets";
import * as BlockIDs from "../constants/blockIds";
import * as CLI from "../types/cli";
import { showHelpBalloon } from "../ui/helpBalloon";
import { addLocalChangeListener } from "../events/blockEventListeners";

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
