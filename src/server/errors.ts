import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);
export const notFound = (message: string) => new ApiError(404, "not_found", message);
export const forbidden = (message: string, details?: unknown) =>
  new ApiError(403, "forbidden", message, details);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

export function zodToApiError(err: ZodError, where: string): ApiError {
  const issues = err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
  const summary = issues.map((i) => `${i.path}: ${i.message}`).join("; ");
  return new ApiError(400, "validation_error", `Invalid ${where} — ${summary}`, issues);
}
