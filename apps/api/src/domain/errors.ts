// Erros de negócio com código estável. O error handler HTTP traduz para o status.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_BLOCKED"
  | "EMAIL_TAKEN"
  | "MOVEMENT_TAKEN"
  | "MOVEMENT_IN_USE"
  | "MASS_EXISTS"
  | "SONG_TAKEN"
  | "SONG_IN_USE"
  | "FLAG_TAKEN"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_FILE";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHORIZED: 401,
  ACCOUNT_PENDING: 403,
  ACCOUNT_BLOCKED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  MOVEMENT_TAKEN: 409,
  MOVEMENT_IN_USE: 409,
  MASS_EXISTS: 409,
  SONG_TAKEN: 409,
  SONG_IN_USE: 409,
  FLAG_TAKEN: 409,
  INVALID_FILE: 415,
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
