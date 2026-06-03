import * as ShellBlocks from "shellblocks";

export type StrategyLogger = (message: string, level: ShellBlocks.LogLevel) => void;

interface StoredResource<T> {
    origin: "user";
    data: T;
    lastUpdated: number;
}

export interface ResourceConfig<T> {
    storageKey: string;
    label: string;
    defaultData: T;
}

export class ResourceResolver {
    private readonly logger: StrategyLogger;

    constructor(logger: StrategyLogger) {
        this.logger = logger;
    }

    public resolveResource<T>(config: ResourceConfig<T>): T {
        const stored = this.loadFromStorage<StoredResource<T>>(
            config.storageKey,
        );

        if (stored?.origin === "user") {
            this.logger(
                `Usando ${config.label} personalizadas (Salvas pelo usuário).`,
                ShellBlocks.LogLevel.INFO,
            );
            return stored.data;
        }

        return config.defaultData;
    }

    public saveUserOverride<T>(config: ResourceConfig<T>, data: T): void {
        const resource: StoredResource<T> = {
            origin: "user",
            data: data,
            lastUpdated: Date.now(),
        };
        this.saveToStorage(config.storageKey, resource);
        this.logger(
            `${config.label} personalizadas salvas com sucesso.`,
            ShellBlocks.LogLevel.INFO,
        );
    }

    public clearResource<T>(config: ResourceConfig<T>): void {
        try {
            window.localStorage.removeItem(config.storageKey);
        } catch (e) {
            this.logger(
                `Erro ao limpar o recurso local (${config.label}).`,
                ShellBlocks.LogLevel.ERROR,
            );
            return;
        }
        this.logger(
            `${config.label} locais excluídos com sucesso.`,
            ShellBlocks.LogLevel.WARN,
        );
    }

    private loadFromStorage<T>(key: string): T | null {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            this.logger(
                `Dados corrompidos em ${key}. Limpando armazenamento.`,
                ShellBlocks.LogLevel.WARN,
            );
            window.localStorage.removeItem(key);
            return null;
        }
    }

    private saveToStorage(key: string, data: unknown): void {
        try {
            window.localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            this.logger(
                "Erro ao gravar no armazenamento local (localStorage cheio?).",
                ShellBlocks.LogLevel.ERROR,
            );
        }
    }
}
