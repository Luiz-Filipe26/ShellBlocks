import * as Blockly from "blockly";
import type * as AST from "../types/ast";
import { getBlockSemanticData } from "./metadataManager";
import { findScriptRoot } from "../blocks/systemBlocks";
import * as BlockTraversal from "../helpers/blockTraversal";
import {
    SemanticData,
    Binding,
    SemanticControlDefinition,
    SemanticOperatorDefinition,
} from "../types/semanticData";

export function serializeWorkspaceToAST(
    workspace: Blockly.Workspace,
): AST.AST | null {
    const rootBlock = findScriptRoot(workspace);
    if (!rootBlock) return null;

    const node = serializeNode(rootBlock);
    return node.type === "script" ? { ...node, type: "script" } : null;
}

function serializeNode(block: Blockly.Block): AST.ASTNode {
    const semanticMetadata = getBlockSemanticData(block);
    if (!semanticMetadata) {
        throw new Error(`Bloco ${block.type} sem metadados semânticos.`);
    }
    const node = createBaseNode(block, semanticMetadata);
    return enrichNodeWithMetadata(node, semanticMetadata);
}

/**
 * Cria a estrutura fundamental do nó: tipo, nome e parâmetros.
 */
function createBaseNode(
    block: Blockly.Block,
    semanticMetadata: SemanticData,
): AST.ASTNode {
    return {
        type: semanticMetadata.nodeType,
        name: semanticMetadata.name,
        parameters: extractParamsFromBlock(block, semanticMetadata.bindings),
    };
}

/**
 * Extrai os dados do bloco Blockly e seus filhos
 */
function extractParamsFromBlock(
    sourceBlock: Blockly.Block,
    bindingsGuide: Binding[],
): AST.ASTParameter[] {
    return bindingsGuide.flatMap((binding) => {
        const componentExists =
            binding.source === "field"
                ? sourceBlock.getField(binding.name) !== null
                : sourceBlock.getInput(binding.name) !== null;
        if (!componentExists) return [];

        const parameter: AST.ASTParameter = {
            key: binding.key,
            source: binding.source,
            value: "",
            children: [],
        };

        if (binding.source === "field") {
            parameter.value = String(
                sourceBlock.getFieldValue(binding.name) ?? "",
            );
        } else {
            parameter.children = serializeInputChain(sourceBlock, binding.name);
        }
        return [parameter];
    });
}

/**
 * Captura e serializa a sequência de blocos conectada a um input específico.
 * Usa o utilitário de traversal para obter a lista e mapeia cada bloco para um nó AST.
 */
function serializeInputChain(
    block: Blockly.Block,
    inputName: string,
): AST.ASTNode[] {
    const targetBlock = block.getInputTargetBlock(inputName);
    if (!targetBlock) {
        return [];
    }
    return BlockTraversal.getBlocksList(targetBlock).map(serializeNode);
}

/**
 * Adiciona metadados de controle ou operador caso o nó os exija.
 */
function enrichNodeWithMetadata(
    node: AST.ASTNode,
    data: SemanticData,
): AST.ASTNode {
    if (data.nodeType === "control") {
        node.controlConfig = mapControlConfiguration(
            data.definition.control,
            data.bindings,
        );
    } else if (data.nodeType === "operator") {
        node.operatorConfig = mapOperatorConfiguration(
            data.definition.operator,
            data.bindings,
        );
    }
    return node;
}

/**
 * Converte a definição semântica de controle para a configuração da AST.
 */
function mapControlConfiguration(
    controlDefinition: SemanticControlDefinition,
    bindingsGuide: Binding[],
): AST.ASTControlConfig {
    return {
        syntaxEnd: controlDefinition.syntaxEnd,
        slots: controlDefinition.slots.map((slot) => ({
            key: findKeyForTechnicalName(slot.name, bindingsGuide),
            syntaxPrefix: slot.syntaxPrefix,
            obligatory: slot.obligatory,
            breakLineBefore: slot.breakLineBefore,
        })),
    };
}

/**
 * Converte a definição semântica de operador para a configuração da AST.
 */
function mapOperatorConfiguration(
    operatorDefinition: SemanticOperatorDefinition,
    bindingsGuide: Binding[],
): AST.ASTOperatorConfig {
    return {
        slots: operatorDefinition.slots.map((slot) => {
            const key = findKeyForTechnicalName(slot.name, bindingsGuide);
            if (slot.symbol === undefined) return { key };
            return {
                key,
                symbol: slot.symbol,
                symbolPlacement: slot.symbolPlacement,
            };
        }),
    };
}

function findKeyForTechnicalName(
    technicalName: string,
    bindingsGuide: Binding[],
): string {
    const binding = bindingsGuide.find(
        (binding) => binding.name === technicalName,
    );
    return binding ? binding.key : technicalName;
}
