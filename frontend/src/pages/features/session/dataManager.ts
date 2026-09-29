import * as ShellBlocks from "shellblocks";
import type { GameData } from "./types";
import * as Logger from "../ui/systemLogger";
import {
    ResourceResolver,
    ResourceConfig,
} from "@/core/persistence/ResourceResolver";

import defaultDefinitions from "@/assets/data/cli_definitions.json";
import defaultGameData from "@/assets/data/levels.json";
import { parseGameData } from "./gameDataParser";

const STORAGE_KEYS = {
    DEFINITIONS: "cli_definitions_v1",
    LEVELS: "game_levels_v1",
} as const;

const DEFINITIONS_CONFIG: ResourceConfig<unknown> = {
    storageKey: STORAGE_KEYS.DEFINITIONS,
    label: "Definições",
    defaultData: defaultDefinitions,
};

const GAME_DATA_CONFIG: ResourceConfig<unknown> = {
    storageKey: STORAGE_KEYS.LEVELS,
    label: "Níveis",
    defaultData: defaultGameData,
};

const resourceResolver = new ResourceResolver(Logger.log);

export function getDefinitions(): ShellBlocks.CLI.CliDefinitions {
    const rawDefinitions = resourceResolver.resolveResource(DEFINITIONS_CONFIG);

    try {
        return parseDefinitions(rawDefinitions);
    } catch (error) {
        if (rawDefinitions === defaultDefinitions) throw error;

        Logger.log(
            `Definições locais inválidas foram descartadas: ${error}`,
            ShellBlocks.LogLevel.WARN,
        );
        resourceResolver.clearResource(DEFINITIONS_CONFIG);
        return parseDefinitions(defaultDefinitions);
    }
}

export function saveCustomDefinitions(
    rawDefinitions: unknown,
): ShellBlocks.CLI.CliDefinitions {
    const definitions = parseDefinitions(rawDefinitions);
    resourceResolver.saveUserOverride(DEFINITIONS_CONFIG, rawDefinitions);
    return definitions;
}

export function resetDefinitions(): ShellBlocks.CLI.CliDefinitions {
    resourceResolver.clearResource(DEFINITIONS_CONFIG);
    Logger.log(
        "Definições locais excluídas. Restaurando padrão...",
        ShellBlocks.LogLevel.WARN,
    );
    return getDefinitions();
}

export function getGameData(): GameData {
    const rawGameData = resourceResolver.resolveResource(GAME_DATA_CONFIG);

    try {
        return parseGameData(rawGameData);
    } catch (error) {
        if (rawGameData === defaultGameData) throw error;

        Logger.log(
            `Níveis locais inválidos foram descartados: ${error}`,
            ShellBlocks.LogLevel.WARN,
        );
        resourceResolver.clearResource(GAME_DATA_CONFIG);
        return parseGameData(defaultGameData);
    }
}

export function saveCustomGameData(rawGameData: unknown): GameData {
    const gameData = parseGameData(rawGameData);
    resourceResolver.saveUserOverride(GAME_DATA_CONFIG, gameData);
    return gameData;
}

export function resetGameData(): GameData {
    resourceResolver.clearResource(GAME_DATA_CONFIG);
    Logger.log("Níveis locais excluídos. Restaurando padrão...", ShellBlocks.LogLevel.WARN);
    return getGameData();
}

function parseDefinitions(rawDefinitions: unknown): ShellBlocks.CLI.CliDefinitions {
    const result = ShellBlocks.parseCliDefinitions(rawDefinitions);
    result.warnings.forEach((warning) =>
        Logger.log(
            `Aviso nas definições CLI: ${warning}`,
            ShellBlocks.LogLevel.WARN,
        ),
    );
    return result.definitions;
}
