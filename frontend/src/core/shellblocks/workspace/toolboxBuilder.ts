import * as CLI from "../types/cli";
import * as BlockIDs from "../constants/blockIds";

interface ToolboxBlock {
    kind: "block";
    type: string;
}

interface ToolboxCategory {
    kind: "category";
    name: string;
    colour?: string;
    contents: (ToolboxCategory | ToolboxBlock)[];
}

interface ToolboxConfig {
    kind: "categoryToolbox";
    contents: ToolboxCategory[];
}

type ToolboxItem = ToolboxCategory | ToolboxBlock;

export function createToolbox(
    cliDefinitions: CLI.CliDefinitions,
): ToolboxConfig {
    const itemRegistry = new Map<string, ToolboxItem>();

    cliDefinitions.commands.forEach((command) => {
        itemRegistry.set(command.id, transformCommandToCategory(command));
    });

    cliDefinitions.controls.forEach((control) => {
        itemRegistry.set(control.id, {
            kind: "block",
            type: BlockIDs.controlBlockType(control),
        });
    });

    cliDefinitions.operators.forEach((operator) => {
        itemRegistry.set(operator.id, {
            kind: "block",
            type: BlockIDs.operatorBlockType(operator),
        });
    });

    const categories: ToolboxCategory[] = cliDefinitions.categories.map(
        (category) => {
            const contents = category.entities
                .map((id) => itemRegistry.get(id))
                .filter((item): item is ToolboxItem => item !== undefined);

            return {
                kind: "category",
                name: category.name,
                contents: contents,
            };
        },
    );

    return {
        kind: "categoryToolbox",
        contents: categories,
    };
}

/**
 * Transforma um Comando em uma Categoria (Pasta) contendo o comando e seus filhos.
 */
function transformCommandToCategory(
    commandDefinition: CLI.CLICommand,
): ToolboxCategory {
    return {
        kind: "category",
        name: commandDefinition.id,
        colour: commandDefinition.color,
        contents: [
            {
                kind: "block",
                type: BlockIDs.commandBlockType(commandDefinition),
            },
            ...(commandDefinition.options.length
                ? [
                    {
                        kind: "block" as const,
                        type: BlockIDs.commandOptionBlockType(
                            commandDefinition,
                        ),
                    },
                ]
                : []),
            ...commandDefinition.operands.map((operand) => ({
                kind: "block" as const,
                type: BlockIDs.commandOperandBlockType(
                    commandDefinition,
                    operand,
                ),
            })),
        ],
    };
}
