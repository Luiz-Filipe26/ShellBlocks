import { z } from "zod";

export const ExecutionStatus = {
    COMPLETED: "completed",
    SETUP_FAILED: "setup_failed",
    INFRASTRUCTURE_ERROR: "infrastructure_error",
} as const;

export const InfrastructureErrorReason = {
    INVALID_REQUEST: "invalid_request",
    TIMEOUT: "timeout",
    DOCKER_ERROR: "docker_error",
    INVALID_PROTOCOL: "invalid_protocol",
    INTERNAL_ERROR: "internal_error",
} as const;

const Base64StringSchema = z.string().refine(
    (value) =>
        value.length % 4 === 0 &&
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            value,
        ),
    "Base64 inválido.",
);

export const StageResultSchema = z.strictObject({
    exitCode: z.number().int(),
    stdoutBase64: Base64StringSchema,
    stderrBase64: Base64StringSchema,
});

export const CompletedExecutionResultSchema = z.strictObject({
    status: z.literal(ExecutionStatus.COMPLETED),
    setup: StageResultSchema.nullable(),
    execution: StageResultSchema,
    verification: StageResultSchema.nullable(),
});

export const SetupFailedExecutionResultSchema = z.strictObject({
    status: z.literal(ExecutionStatus.SETUP_FAILED),
    setup: StageResultSchema,
    execution: z.null(),
    verification: z.null(),
});

export const InfrastructureErrorResultSchema = z.strictObject({
    status: z.literal(ExecutionStatus.INFRASTRUCTURE_ERROR),
    reason: z.enum(InfrastructureErrorReason),
    message: z.string(),
    details: z.string().optional(),
});

export const ExecutionResultSchema = z.discriminatedUnion("status", [
    CompletedExecutionResultSchema,
    SetupFailedExecutionResultSchema,
    InfrastructureErrorResultSchema,
]);

const OptionalScriptSchema = z.string().optional().transform((script) =>
    script?.trim() ? script : undefined,
);

export const RunRequestSchema = z.strictObject({
    setupScript: OptionalScriptSchema,
    userScript: z
        .string()
        .refine((value) => value.trim().length > 0, "O script não pode ser vazio."),
    verificationScript: OptionalScriptSchema,
}).transform(({ setupScript, userScript, verificationScript }) => ({
    userScript,
    ...(setupScript === undefined ? {} : { setupScript }),
    ...(verificationScript === undefined ? {} : { verificationScript }),
}));

export type StageResult = z.infer<typeof StageResultSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type RunRequest = z.infer<typeof RunRequestSchema>;
export type InfrastructureErrorReason = z.infer<
    typeof InfrastructureErrorResultSchema
>["reason"];
