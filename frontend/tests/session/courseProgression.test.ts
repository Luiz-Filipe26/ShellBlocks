import { describe, expect, it } from "vitest";
import rawLevels from "@/assets/data/levels.json";
import rawDefinitions from "@/assets/data/cli_definitions.json";
import { parseCliDefinitions } from "@/core/shellblocks/definitions/cliDefinitionsParser";
import { parseGameData } from "@/pages/features/session/gameDataParser";

const definitions = parseCliDefinitions(rawDefinitions).definitions;
const data = parseGameData(rawLevels, definitions);
const expectedOrder = [
    "01_ls_basics", "02_ls_options", "03_mkdir", "10_ping", "04_cd",
    "05_cp", "mv_basics", "14_organizar", "15_limpeza", "backup_cleanup",
    "06_cat", "07_grep", "08_redirect", "16_processamento", "09_pipe",
    "two_shift_report", "11_curl", "17_deploy", "18_challenge_security", "19_challenge_deploy",
];

describe("percurso de 20 níveis", () => {
    it("apresenta todos os níveis uma única vez, sem missões órfãs", () => {
        expect(data.levelOrder).toEqual(expectedOrder);
        expect(new Set(data.levels.map((level) => level.id))).toEqual(new Set(expectedOrder));
        expect(data.levels).toHaveLength(20);
    });

    it("intercala introdução e prática, reservando os dois últimos níveis aos desafios", () => {
        const levels = expectedOrder.map((id) => data.levels.find((level) => level.id === id)!);
        expect(levels.map((level) => level.difficulty)).toEqual([
            "tutorial", "tutorial", "tutorial", "tutorial", "tutorial", "tutorial", "tutorial",
            "training", "tutorial", "training", "tutorial", "tutorial", "tutorial", "training",
            "tutorial", "training", "tutorial", "training", "challenge", "challenge",
        ]);
        for (const level of levels) {
            expect(level.setupScript).toBeTruthy();
            expect(level.verificationScript).toBeTruthy();
            if (level.difficulty === "tutorial") expect(level.toolboxGuidance.length).toBeGreaterThan(0);
            else expect(level.toolboxGuidance).toEqual([]);
        }
    });

    it("retira processos e background somente do percurso, preservando recursos da ferramenta", () => {
        expect(data.levels.some((level) => ["12_ps", "13_background"].includes(level.id))).toBe(false);
        expect(definitions.commands.some((command) => command.id === "ps")).toBe(true);
        expect(definitions.operators.some((operator) => operator.id === "background")).toBe(true);
    });
});
