export {
    setupWorkspace,
    refreshWorkspaceDefinitions,
    createScriptRoot, // Útil exportar isso também
} from "./workspace/workspaceCreator";
export { serializeWorkspaceToAST } from "./serialization/serializer";
export {
    parseCliDefinitions,
    CliDefinitionsValidationError,
    type CliDefinitionsParseResult,
} from "./definitions/cliDefinitionsParser";
export { showToast } from "./ui/toast";
export {
    getWorkspaceErrors,
    type BlockErrorReport,
} from "./validation/validationManager";
export * as AST from "./types/ast";
export * as CLI from "./types/cli";
export { LogLevel } from "./types/logger";
export type { LogFunction } from "./types/logger";
