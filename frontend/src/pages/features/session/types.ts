export const LevelDifficulty = {
    TUTORIAL: "tutorial",
    TRAINING: "training",
    CHALLENGE: "challenge",
} as const;

export type LevelDifficulty =
    (typeof LevelDifficulty)[keyof typeof LevelDifficulty];

export interface Level {
    id: string;
    title: string;
    summary?: string;
    fullGuideHtml?: string;
    difficulty?: LevelDifficulty;
    setupScript?: string;
    verificationScript?: string;
}

export interface GameData {
    levels: Level[];
    levelOrder: string[];
}
