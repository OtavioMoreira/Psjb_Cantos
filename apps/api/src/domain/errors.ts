// Erros de negócio com código estável. O error handler HTTP traduz para o status.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_BLOCKED"
  | "EMAIL_TAKEN"
  | "LAST_ADMIN"
  | "MOVEMENT_TAKEN"
  | "MOVEMENT_IN_USE"
  | "MASS_EXISTS"
  | "SONG_TAKEN"
  | "SONG_IN_USE"
  | "FLAG_TAKEN"
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_FILE"
  | "INVALID_TOKEN"
  | "INVALID_CODE"
  | "TOO_SOON"
  | "EMAIL_FAILED";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  ACCOUNT_PENDING: 403,
  ACCOUNT_BLOCKED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  LAST_ADMIN: 409,
  MOVEMENT_TAKEN: 409,
  MOVEMENT_IN_USE: 409,
  MASS_EXISTS: 409,
  SONG_TAKEN: 409,
  SONG_IN_USE: 409,
  FLAG_TAKEN: 409,
  NOT_CONFIGURED: 501,
  INVALID_FILE: 415,
  INVALID_TOKEN: 400,
  INVALID_CODE: 400,
  TOO_SOON: 429,
  EMAIL_FAILED: 502,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}
