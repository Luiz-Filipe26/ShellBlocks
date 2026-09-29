import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Blockly from "blockly";
import defaultGameData from "@/assets/data/levels.json";
import { parseGameData } from "@/pages/features/session/gameDataParser";
import {
    getGameData,
    saveCustomGameData,
} from "@/pages/features/session/dataManager";
import { uploadGameData } from "@/pages/features/session/persistenceManager";
import * as Logger from "@/pages/features/ui/systemLogger";

class MemoryStorage implements Storage {
    private readonly entries = new Map<string, string>();

    get length(): number {
        return this.entries.size;
    }

    clear(): void {
        this.entries.clear();
    }

    getItem(key: string): string | null {
        return this.entries.get(key) ?? null;
    }

    key(index: number): string | null {
        return [...this.entries.keys()][index] ?? null;
    }

    removeItem(key: string): void {
        this.entries.delete(key);
    }

    setItem(key: string, value: string): void {
        this.entries.set(key, value);
    }
}

const STORAGE_KEY = "game_levels_v1";

function gameData() {
    return {
        levels: [
            { id: "first", title: "Primeiro", difficulty: "tutorial" },
            { id: "second", title: "Segundo" },
        ],
        levelOrder: ["second", "first"],
    };
}

function uploadJson(content: string, onSuccess: (data: ReturnType<typeof parseGameData>) => void): void {
    const input = {
        files: [{}],
        onchange: null as ((event: { target: unknown }) => void) | null,
        click() {
            this.onchange?.({ target: this });
        },
    };

    class TestFileReader {
        onload: ((event: { target: { result: string } }) => void) | null = null;

        readAsText(): void {
            this.onload?.({ target: { result: content } });
        }
    }

    vi.stubGlobal("document", { createElement: () => input });
    vi.stubGlobal("FileReader", TestFileReader);
    uploadGameData(null as unknown as Blockly.WorkspaceSvg, onSuccess);
}

describe("parseGameData", () => {
    it("aceita o asset oficial e preserva propriedades extras, strings vazias e níveis fora da ordem", () => {
        expect(parseGameData(defaultGameData)).toBe(defaultGameData);

        const input = {
            levels: [{ id: "", title: "", summary: "", extra: true }, { id: "draft", title: "" }],
            levelOrder: ["", ""],
            extra: "permitido",
        };
        expect(parseGameData(input)).toBe(input);
    });

    it.each([
        ["raiz", null],
        ["levels ausente", { levelOrder: [] }],
        ["levelOrder ausente", { levels: [] }],
        ["levels não array", { levels: {}, levelOrder: [] }],
        ["levelOrder não array", { levels: [], levelOrder: {} }],
        ["nível não objeto", { levels: [null], levelOrder: [] }],
        ["id não string", { levels: [{ id: 1, title: "Título" }], levelOrder: [] }],
        ["title não string", { levels: [{ id: "first", title: null }], levelOrder: [] }],
        ["difficulty inválida", { levels: [{ id: "first", title: "Título", difficulty: "unknown" }], levelOrder: [] }],
        ["difficulty não string", { levels: [{ id: "first", title: "Título", difficulty: 1 }], levelOrder: [] }],
        ["ID duplicado", { levels: [{ id: "first", title: "A" }, { id: "first", title: "B" }], levelOrder: [] }],
        ["referência inexistente", { levels: [], levelOrder: ["first"] }],
        ["referência não string", { levels: [], levelOrder: [1] }],
    ])("rejeita %s", (_reason, input) => {
        expect(() => parseGameData(input)).toThrow("GameData inválido");
    });

    it.each(["summary", "fullGuideHtml", "setupScript", "verificationScript"])(
        "exige string quando %s está presente",
        (field) => {
            const input = {
                levels: [{ id: "first", title: "Primeiro", [field]: null }],
                levelOrder: ["first"],
            };
            expect(() => parseGameData(input)).toThrow(field);
        },
    );
});

describe("fronteiras de GameData", () => {
    let storage: MemoryStorage;

    beforeEach(() => {
        storage = new MemoryStorage();
        vi.stubGlobal("window", { localStorage: storage });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("valida o upload antes de persistir e entrega o dado validado ao callback", () => {
        const onSuccess = vi.fn();
        const input = gameData();

        uploadJson(JSON.stringify(input), onSuccess);

        expect(onSuccess).toHaveBeenCalledWith(input);
        expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toMatchObject({
            origin: "user",
            data: input,
        });
        expect(getGameData()).toEqual(input);
    });

    it("rejeita upload inválido sem salvar nem chamar o callback", () => {
        const onSuccess = vi.fn();
        const input = { levels: [{ id: "first", title: "Primeiro" }] };

        uploadJson(JSON.stringify(input), onSuccess);

        expect(onSuccess).not.toHaveBeenCalled();
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("valida antes de salvar mesmo quando chamado diretamente", () => {
        expect(() => saveCustomGameData({ levels: [], levelOrder: ["missing"] })).toThrow();
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("descarta override persistido inválido, registra warning e volta ao asset oficial", () => {
        const log = vi.spyOn(Logger, "log");
        storage.setItem(STORAGE_KEY, JSON.stringify({
            origin: "user",
            data: { levels: [{ id: "first", title: 7 }], levelOrder: ["first"] },
            lastUpdated: Date.now(),
        }));

        expect(getGameData()).toBe(defaultGameData);
        expect(storage.getItem(STORAGE_KEY)).toBeNull();
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining("Níveis locais inválidos foram descartados"),
            "warn",
        );
    });

    it("propaga erro quando o próprio asset padrão está inválido", () => {
        defaultGameData.levelOrder.push("missing");
        try {
            expect(() => getGameData()).toThrow("levelOrder");
        } finally {
            defaultGameData.levelOrder.pop();
        }
    });
});
