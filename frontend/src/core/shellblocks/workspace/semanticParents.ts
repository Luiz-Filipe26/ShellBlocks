import * as Blockly from "blockly";
import * as BlockIDs from "../constants/blockIds";
import { getBlocksList } from "../helpers/blockTraversal";
import { getBlockSemanticData } from "../serialization/metadataManager";
import {
    wouldIntroduceDuplicate,
    wouldViolateExclusiveOptions,
    wouldExceedOperandCardinality,
    OPERATOR_STATEMENT_CAPACITY,
} from "../validation/structuralConstraints";

/** Semantic containers, independently of proximity, argument order or application state. */
export function getValidSemanticParents(dragged: Blockly.Block): Blockly.Block[] {
    const previous = dragged.previousConnection;
    if (!previous || !getBlockSemanticData(dragged)) return [];
    const moving = new Set(dragged.getDescendants(false));
    const incoming = getBlocksList(dragged);
    const checker = dragged.workspace.connectionChecker;

    return dragged.workspace.getAllBlocks(false).filter((parent) => {
        if (moving.has(parent) || parent.isInFlyout || parent.isInsertionMarker() || parent.isCollapsed()) return false;
        for (let ancestor = parent.getSurroundParent(); ancestor; ancestor = ancestor.getSurroundParent()) {
            if (ancestor.isCollapsed()) return false;
        }
        const semantic = getBlockSemanticData(parent);
        if (!semantic) return false;
        return semantic.bindings.some((binding) => {
            if (binding.source !== "input") return false;
            const input = parent.getInput(binding.name);
            const connection = input?.connection;
            // Distance is deliberately irrelevant: this is containment guidance, not snap guidance.
            if (!input?.isVisible() || !connection || !checker.canConnect(connection, previous, false)) return false;
            if (!incoming.every((block) => block.previousConnection && checker.doTypeChecks(connection, block.previousConnection))) return false;
            const existing = getBlocksList(connection.targetBlock())
                .filter((block) => !moving.has(block) && !block.isInsertionMarker());
            if (semantic.nodeType === "command") {
                if (binding.name === BlockIDs.INPUTS.OPTIONS) {
                    return !wouldIntroduceDuplicate(existing, incoming, (block) => String(block.getFieldValue(BlockIDs.FIELDS.FLAG)))
                        && !wouldViolateExclusiveOptions(existing, incoming, semantic.definition.command.exclusiveOptions);
                }
                if (binding.name === BlockIDs.INPUTS.OPERANDS) {
                    return !wouldExceedOperandCardinality(existing, incoming, semantic.definition.command);
                }
                return false;
            }
            if (semantic.nodeType === "operator") return existing.length + incoming.length <= OPERATOR_STATEMENT_CAPACITY;
            return semantic.nodeType === "script" || semantic.nodeType === "control";
        });
    });
}
