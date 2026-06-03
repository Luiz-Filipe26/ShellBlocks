import * as API from "@/types/api";
import * as ShellBlocks from "shellblocks";
import * as PersistenceManager from "./persistenceManager";
import * as Logger from "../ui/systemLogger";
import { LevelSuccessResult } from "../execution/scriptRunner";

export const SANDBOX_LEVEL_ID = "sandbox";

let levelsCache: Map<string, API.Level> = new Map();
let orderedLevels: API.Level[] = [];

let currentLevelId: string = SANDBOX_LEVEL_ID;

export function getCurrentLevelId(): string {
    return currentLevelId;
}

export function getCachedLevelData(levelId: string): API.Level | undefined {
    return levelsCache.get(levelId);
}

export function onLevelSuccesEvent(
    levelId: string,
    levelSelect: HTMLSelectElement,
    isExperimentMode: boolean,
): LevelSuccessResult {
    if (!isExperimentMode) return { unlockedNewLevel: false };

    const nonSandboxOptions = [...levelSelect.options].filter(
        (option) => option.value !== SANDBOX_LEVEL_ID,
    );

    const currentLevelIdIndex = nonSandboxOptions.findIndex(
        (option) => option.value == levelId,
    );

    if (levelId !== SANDBOX_LEVEL_ID && currentLevelIdIndex < 0) {
        Logger.log(
            `Erro de rastreio: Nível ID ${levelId} não identificado no seletor.`,
            ShellBlocks.LogLevel.ERROR,
        );
        return { unlockedNewLevel: false };
    }

    Logger.log(
        `Evento: Nível ${currentLevelIdIndex + 1} concluído.`,
        ShellBlocks.LogLevel.INFO,
    );

    if (currentLevelIdIndex === nonSandboxOptions.length - 1) {
        Logger.log(
            "Status: Todos os níveis concluídos.",
            ShellBlocks.LogLevel.INFO,
        );
        return { unlockedNewLevel: false };
    }

    const lastUnlockedLevelId =
        PersistenceManager.getLastUnlockedLevelId() ||
        nonSandboxOptions[0].value ||
        "";

    const lastUnlockedLevelIndex = nonSandboxOptions.findIndex(
        (option) => option.value === lastUnlockedLevelId,
    );

    const newLastUnlockedLevelIndex = Math.max(
        currentLevelIdIndex + 1,
        lastUnlockedLevelIndex,
    );

    const newLastUnlockedLevelId =
        nonSandboxOptions[newLastUnlockedLevelIndex].value || "";

    if (newLastUnlockedLevelIndex > lastUnlockedLevelIndex) {
        PersistenceManager.unlockLevel(newLastUnlockedLevelId);
        modifyOptionsToDisplayProgress(
            nonSandboxOptions,
            newLastUnlockedLevelId,
            isExperimentMode,
        );

        levelSelect.value = newLastUnlockedLevelId;
        levelSelect.dispatchEvent(new Event("change"));

        const nextTitle =
            nonSandboxOptions[newLastUnlockedLevelIndex].dataset.title;

        Logger.log(
            `Progresso: Nível ${newLastUnlockedLevelIndex + 1} (${nextTitle}) desbloqueado.`,
            ShellBlocks.LogLevel.INFO,
        );

        return {
            unlockedNewLevel: true,
            nextLevelTitle: nextTitle,
        };
    }

    return { unlockedNewLevel: false };
}

export interface SelectorDependencies {
    levelSelect: HTMLSelectElement;
    levelSummaryText: HTMLElement;
    levelFullDetails: HTMLElement;
    progressBarFill: HTMLElement;
    progressLabel: HTMLElement;
}

export function setupLevelSelector(
    data: API.GameData | null,
    selectorDependencies: SelectorDependencies,
    isExperimentMode: boolean,
): void {
    const { levelSelect, levelSummaryText, levelFullDetails } =
        selectorDependencies;

    if (!data) {
        levelSelect.innerHTML = "<option>Erro ao carregar níveis</option>";
        levelSummaryText.textContent = "Erro de conexão com o servidor.";
        levelFullDetails.innerHTML = "";
        return;
    }

    levelsCache.clear();
    orderedLevels = getSortedLevels(data);
    orderedLevels.forEach((level) => levelsCache.set(level.id, level));
    levelSelect.innerHTML = "";

    levelSelect.appendChild(
        createOption(SANDBOX_LEVEL_ID, "Modo Livre (Sandbox)"),
    );

    const selectOptions = orderedLevels.map((level) => {
        const option = createOption(level.id, "");
        option.dataset.title = level.title;
        levelSelect.appendChild(option);
        return option;
    });

    const lastUnlockedLevelId = PersistenceManager.getLastUnlockedLevelId();
    modifyOptionsToDisplayProgress(
        selectOptions,
        lastUnlockedLevelId || "",
        isExperimentMode,
    );

    registerLevelSelectorEvents(selectorDependencies);

    levelSelect.value = SANDBOX_LEVEL_ID;
    levelSelect.dispatchEvent(new Event("change"));
}

function updateProgressBar(
    currentIndex: number,
    total: number,
    deps: SelectorDependencies
): void {
    const { progressBarFill, progressLabel } = deps;
    progressBarFill.style.width = `${total > 0 ? (currentIndex / total) * 100 : 0}%`;
    progressLabel.textContent =
        currentIndex > 0 ? `Nível ${currentIndex}/${total}` : `Modo Livre`;
}

function modifyOptionsToDisplayProgress(
    nonSandboxSelectOptions: HTMLOptionElement[],
    lastUnlockedLevelId: string,
    isExperimentMode?: boolean,
): void {
    let lastUnlockedLevelIndex = nonSandboxSelectOptions.findIndex(
        (option) => option.value === lastUnlockedLevelId,
    );
    lastUnlockedLevelIndex = Math.max(lastUnlockedLevelIndex, 0);
    nonSandboxSelectOptions.forEach((option, index) => {
        option.disabled =
            Boolean(isExperimentMode) && index > lastUnlockedLevelIndex;
        option.text = `Nível ${index + 1}: ${option.dataset.title || ""}${option.disabled ? " 🔒" : ""}`;
    });
}

function getSortedLevels(gameData: API.GameData): API.Level[] {
    const levelsMap = new Map(
        gameData.levels.map((level) => [level.id, level]),
    );
    return gameData.levelOrder
        .map((id) => levelsMap.get(id))
        .filter((level): level is API.Level => level !== undefined);
}

function createOption(value: string, text?: string): HTMLOptionElement {
    const option = document.createElement("option");
    option.value = value;
    option.text = text || "";
    return option;
}

function registerLevelSelectorEvents(deps: SelectorDependencies): void {
    const { levelSelect, levelSummaryText, levelFullDetails } = deps;

    levelSelect.addEventListener("change", () => {
        currentLevelId = levelSelect.value;

        if (currentLevelId === SANDBOX_LEVEL_ID) {
            updateProgressBar(0, orderedLevels.length, deps);
            renderSandboxMode(levelSummaryText, levelFullDetails);
            return;
        }

        const level = levelsCache.get(currentLevelId);
        if (level) {
            const index =
                orderedLevels.findIndex((l) => l.id === currentLevelId) + 1;
            updateProgressBar(index, orderedLevels.length, deps);
            renderLevelMode(level, levelSummaryText, levelFullDetails);
        } else {
            renderErrorState(currentLevelId, levelSummaryText, levelFullDetails);
        }
    });
}

function renderSandboxMode(
    summaryElement: HTMLElement,
    detailsElement: HTMLElement,
): void {
    const badgeHtml = getBadgeHtml("sandbox");

    summaryElement.innerHTML = `
        <span class="summary-label">Ambiente livre sem objetivos.</span>
        ${badgeHtml}
    `;

    detailsElement.innerHTML = `
        <h1>Modo Livre</h1>
        <p>Use este espaço para testar comandos e blocos livremente.</p>
    `;
}

function renderLevelMode(
    level: API.Level,
    summaryElement: HTMLElement,
    detailsElement: HTMLElement,
): void {
    const difficulty = level.difficulty || "tutorial";
    const badgeHtml = getBadgeHtml(difficulty);

    summaryElement.innerHTML = `
        <span class="summary-label">${level.summary || ""}</span>
        ${badgeHtml}
    `;

    detailsElement.innerHTML = level.fullGuideHtml || `<p>${level.summary}</p>`;
}

function renderErrorState(
    levelId: string,
    summaryElement: HTMLElement,
    detailsElement: HTMLElement,
): void {
    Logger.log(
        `Erro: nível (${levelId}) não encontrado.`,
        ShellBlocks.LogLevel.ERROR,
    );
    summaryElement.textContent = "Erro ao carregar nível.";
    detailsElement.innerHTML = "";
}

function getBadgeHtml(
    inputDifficulty?: API.LevelDifficulty | "sandbox",
): string {
    if (!inputDifficulty) return "";

    let label = "TREINO";
    let cssClass = "badge-training";

    const difficulty = inputDifficulty.toLowerCase();

    if (difficulty === "tutorial") {
        label = "TUTORIAL";
        cssClass = "badge-tutorial";
    } else if (difficulty === "challenge") {
        label = "DESAFIO";
        cssClass = "badge-challenge";
    } else if (difficulty === "sandbox") {
        label = "MODO LIVRE";
        cssClass = "badge-sandbox";
    }

    return `<span class="difficulty-badge ${cssClass}">${label}</span>`;
}
