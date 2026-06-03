import * as ShellBlocks from "shellblocks";
import * as API from "@/types/api";
import * as Logger from "../ui/systemLogger";
import {
    ResourceResolver,
    ResourceConfig,
} from "@/core/persistence/ResourceResolver";

import defaultDefinitions from "@/assets/data/cli_definitions.json";
import defaultGameData from "@/assets/data/levels.json";

const STORAGE_KEYS = {
    DEFINITIONS: "cli_definitions_v1",
    LEVELS: "game_levels_v1",
} as const;

const DEFINITIONS_CONFIG: ResourceConfig<ShellBlocks.CLI.CliDefinitions> = {
    storageKey: STORAGE_KEYS.DEFINITIONS,
    label: "Definições",
    defaultData: defaultDefinitions as unknown as ShellBlocks.CLI.CliDefinitions,
};

const GAME_DATA_CONFIG: ResourceConfig<API.GameData> = {
    storageKey: STORAGE_KEYS.LEVELS,
    label: "Níveis",
    defaultData: defaultGameData as unknown as API.GameData,
};

const resourceResolver = new ResourceResolver(Logger.log);

export function getDefinitions(): ShellBlocks.CLI.CliDefinitions {
    return resourceResolver.resolveResource(DEFINITIONS_CONFIG);
}

export function saveCustomDefinitions(definitions: ShellBlocks.CLI.CliDefinitions): void {
    resourceResolver.saveUserOverride(DEFINITIONS_CONFIG, definitions);
}

export function resetDefinitions(): ShellBlocks.CLI.CliDefinitions {
    resourceResolver.clearResource(DEFINITIONS_CONFIG);
    Logger.log(
        "Definições locais excluídas. Restaurando padrão...",
        ShellBlocks.LogLevel.WARN,
    );
    return getDefinitions();
}

export function getGameData(): API.GameData {
    return resourceResolver.resolveResource(GAME_DATA_CONFIG);
}

export function saveCustomGameData(data: API.GameData): void {
    resourceResolver.saveUserOverride(GAME_DATA_CONFIG, data);
}

export function resetGameData(): API.GameData {
    resourceResolver.clearResource(GAME_DATA_CONFIG);
    Logger.log("Níveis locais excluídos. Restaurando padrão...", ShellBlocks.LogLevel.WARN);
    return getGameData();
}
