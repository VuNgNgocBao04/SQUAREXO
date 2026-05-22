import { ZodType } from "zod";
import { ContractError, ErrorCode } from "../contracts/errors";

export function parsePayload<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ContractError(ErrorCode.VALIDATION_ERROR, "Invalid payload", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
