import * as Blockly from "blockly";
import { getOperatorDefinition } from "../blocks/operatorBlocks";
import { OperatorSlotType } from "../types/cli";
import { getParentInputName } from "../helpers/blockTraversal";

export function receivesImplicitInput(block: Blockly.Block): boolean {
    let currentBlock = block;
    let parent = currentBlock.getSurroundParent();

    while (parent !== null) {
        const operatorDefinition = getOperatorDefinition(parent.type);
        if (operatorDefinition === undefined) return false;

        const parentSlotName = getParentInputName(currentBlock);
        if (parentSlotName === null) return false;

        if (operatorDefinition.slotsWithImplicitData.includes(parentSlotName)) {
            return true;
        }

        const firstStatementSlot = operatorDefinition.slots.find(
            (slot) => slot.type === OperatorSlotType.STATEMENT,
        );
        if (firstStatementSlot?.name !== parentSlotName) return false;

        currentBlock = parent;
        parent = currentBlock.getSurroundParent();
    }

    return false;
}
