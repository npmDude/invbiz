import createError from 'http-errors';

/**
 * Postgres error code for `unique_violation`.
 */
const UNIQUE_VIOLATION_CODE = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

/**
 * Rethrow a Postgres unique violation as a 409 Conflict with a
 * domain-specific message. Any other error is rethrown unchanged.
 */
export function throwConflictIfUniqueViolation(
  error: unknown,
  message: string,
): never {
  if (isUniqueViolation(error)) {
    throw createError(409, message);
  }

  throw error;
}
