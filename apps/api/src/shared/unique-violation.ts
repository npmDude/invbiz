import createError from 'http-errors';

/**
 * Postgres error code for `unique_violation`.
 */
const UNIQUE_VIOLATION_CODE = '23505';

export function isUniqueViolation(error: unknown): boolean {
  // Drizzle wraps the underlying Postgres error (`DrizzleQueryError` with the
  // driver error in `cause`), so walk the cause chain instead of checking
  // only the top-level error.
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth++) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      (current as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }

    if (
      typeof current !== 'object' ||
      current === null ||
      !('cause' in current)
    ) {
      return false;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
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
