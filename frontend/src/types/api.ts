export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export type LevelDifficulty = "tutorial" | "training" | "challenge";

export interface Level {
    id: string;
    title: string;
    summary?: string;
    fullGuideHtml?: string;
    difficulty?: LevelDifficulty;
    setupCommands?: string[];
    verificationScript?: string;
}

export interface GameData {
    levels: Level[];
    levelOrder: string[];
}

export interface RunRequest {
    userScript: string;
    setupCommands?: string[];
    verificationScript?: string;
}
