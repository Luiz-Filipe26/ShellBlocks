import * as Blockly from "blockly";
import type { SemanticData } from "../types/semanticData";

const semanticDataByBlockType = new Map<string, SemanticData>();

export function setBlockTypeSemanticData(
    blockType: string,
    data: SemanticData,
): void {
    semanticDataByBlockType.set(blockType, data);
}

export function clearBlockSemanticDataRegistry(): void {
    semanticDataByBlockType.clear();
}

export function getBlockSemanticData(
    block: Blockly.Block,
): SemanticData | undefined {
    return semanticDataByBlockType.get(block.type);
}
