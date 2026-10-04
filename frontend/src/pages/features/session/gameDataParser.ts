import type { CliDefinitions } from "../../../core/shellblocks/types/cli";
import { toolboxGuidanceListSchema, guidanceIdentity, resolveToolboxGuidance } from "./toolboxGuidance";
import { LevelDifficulty, type GameData, type Level } from "./types";

const LEVEL_DIFFICULTIES: ReadonlySet<string> = new Set(Object.values(LevelDifficulty));

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

type GameDataInput = Omit<GameData, "levels"> & {
    [key: string]: unknown;
    levels: (Omit<Level, "toolboxGuidance"> & { toolboxGuidance?: unknown; [key: string]: unknown })[];
};

function assertGameData(value: unknown): asserts value is GameDataInput {
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

export function parseGameData(value: unknown, officialDefinitions?: CliDefinitions): GameData {
    assertGameData(value);
    const levels = value.levels.map((level, index) => {
        const guidance = toolboxGuidanceListSchema.safeParse(level.toolboxGuidance);
        if (!guidance.success) {
            throw new Error(`GameData inválido: levels[${index}].toolboxGuidance: ${guidance.error.message}`);
        }
        return { ...level, toolboxGuidance: guidance.data };
    });
    const gameData: GameData = { ...value, levels };
    if (officialDefinitions) {
        for (const level of gameData.levels) {
            const { unresolved } = resolveToolboxGuidance(level.toolboxGuidance, officialDefinitions);
            if (unresolved.length) throw new Error(`GameData inválido: ${level.id}.toolboxGuidance: ${unresolved.map(({ reference, reason }) => `${guidanceIdentity(reference)}: ${reason}`).join("; ")}`);
        }
    }
    return gameData;
}
