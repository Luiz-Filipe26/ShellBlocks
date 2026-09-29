import { LevelDifficulty, type GameData } from "./types";

const LEVEL_DIFFICULTIES: ReadonlySet<string> = new Set(Object.values(LevelDifficulty));

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertGameData(value: unknown): asserts value is GameData {
    if (
        !isRecord(value) ||
        !Array.isArray(value.levels) ||
        !Array.isArray(value.levelOrder)
    ) {
        throw new Error('GameData inválido: "levels" e "levelOrder" devem ser arrays.');
    }

    const levelIds = new Set<string>();

    for (const [index, level] of value.levels.entries()) {
        if (
            !isRecord(level) ||
            typeof level.id !== "string" ||
            typeof level.title !== "string"
        ) {
            throw new Error(`GameData inválido: levels[${index}] deve ter id e title strings.`);
        }

        for (const field of [
            "summary",
            "fullGuideHtml",
            "setupScript",
            "verificationScript",
        ] as const) {
            if (field in level && typeof level[field] !== "string") {
                throw new Error(`GameData inválido: levels[${index}].${field} deve ser string.`);
            }
        }

        if (
            "difficulty" in level &&
            (typeof level.difficulty !== "string" || !LEVEL_DIFFICULTIES.has(level.difficulty))
        ) {
            throw new Error(`GameData inválido: levels[${index}].difficulty é inválida.`);
        }

        if (levelIds.has(level.id)) {
            throw new Error(`GameData inválido: ID de nível duplicado "${level.id}".`);
        }
        levelIds.add(level.id);
    }

    for (const [index, id] of value.levelOrder.entries()) {
        if (typeof id !== "string" || !levelIds.has(id)) {
            throw new Error(
                `GameData inválido: levelOrder[${index}] referencia um ID inexistente ou inválido.`,
            );
        }
    }
}

export function parseGameData(value: unknown): GameData {
    assertGameData(value);
    return value;
}
