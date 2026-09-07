import { describe, expect, it } from 'vitest';

import {
  isUniqueViolation,
  throwConflictIfUniqueViolation,
} from './unique-violation';

describe('isUniqueViolation', () => {
  it('should match a bare Postgres error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('should match a Drizzle-wrapped error via cause', () => {
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('duplicate key value'), {
        code: '23505',
      }),
    });

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it('should not match other errors', () => {
    expect(isUniqueViolation(new Error('Connection lost'))).toBe(false);
    expect(
      isUniqueViolation(
        Object.assign(new Error('Failed query'), {
          cause: Object.assign(new Error('timeout'), { code: '57014' }),
        }),
      ),
    ).toBe(false);
  });

  it('should map a wrapped violation to 409', () => {
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('duplicate key value'), {
        code: '23505',
      }),
    });

    expect(() =>
      throwConflictIfUniqueViolation(wrapped, 'Already exists.'),
    ).toThrowError(
      expect.objectContaining({ status: 409, message: 'Already exists.' }),
    );
  });
});
