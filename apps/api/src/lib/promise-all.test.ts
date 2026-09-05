import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  PromiseAllTimeoutError,
  PromiseTaskError,
  PromiseTaskTimeoutError,
  promiseAll,
} from './promise-all';
import type { PromiseAllSettledResult } from './promise-all';

const delay = (ms: number, value?: string) =>
  new Promise<string>((resolve) => {
    setTimeout(() => resolve(value ?? 'ok'), ms);
  });

describe('promiseAll', () => {
  it('resolves values in input order (aggregate, default)', async () => {
    const result = await promiseAll([
      { label: 'a', promise: () => delay(20, 'a-value') },
      { label: 'b', promise: () => delay(5, 'b-value') },
    ]);

    expect(result).toEqual(['a-value', 'b-value']);
  });

  it('rejects already-created promises (factory only)', async () => {
    await expect(
      promiseAll([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { label: 'a', promise: Promise.resolve(1) as any },
      ]),
    ).rejects.toThrow(TypeError);
  });

  it('infers a tuple type for heterogeneous task return types', async () => {
    const result = await promiseAll([
      { label: 'user', promise: () => Promise.resolve({ name: 'ada' }) },
      { label: 'count', promise: () => Promise.resolve(42) },
    ]);

    expectTypeOf(result).toEqualTypeOf<[{ name: string }, number]>();
    expect(result).toEqual([{ name: 'ada' }, 42]);

    const settled = await promiseAll(
      [
        { label: 'user', promise: () => Promise.resolve({ name: 'ada' }) },
        { label: 'count', promise: () => Promise.resolve(42) },
      ],
      { strategy: 'settle' },
    );

    expectTypeOf(settled).toEqualTypeOf<
      [
        PromiseAllSettledResult<{ name: string }>,
        PromiseAllSettledResult<number>,
      ]
    >();
    expect(settled).toEqual([
      { status: 'fulfilled', label: 'user', value: { name: 'ada' } },
      { status: 'fulfilled', label: 'count', value: 42 },
    ]);
  });

  it('throws an AggregateError with labels on failure (aggregate)', async () => {
    const failure = promiseAll([
      { label: 'good', promise: () => delay(1, 'good') },
      {
        label: 'bad',
        promise: () => Promise.reject(new Error('boom')),
      },
    ]);

    await expect(failure).rejects.toThrow(AggregateError);
    await expect(failure).rejects.toThrow(/"bad"/);
    const error = await failure.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AggregateError);
    const errors = (error as AggregateError).errors as unknown[];
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(PromiseTaskError);
    expect((errors[0] as PromiseTaskError).label).toBe('bad');
  });

  it('never throws and labels each outcome (settle)', async () => {
    const result = await promiseAll(
      [
        { label: 'good', promise: () => delay(1, 'good') },
        {
          label: 'bad',
          promise: () => Promise.reject(new Error('boom')),
        },
      ],
      { strategy: 'settle' },
    );

    expect(result).toEqual([
      { status: 'fulfilled', label: 'good', value: 'good' },
      {
        status: 'rejected',
        label: 'bad',
        reason: expect.any(PromiseTaskError),
      },
    ]);
    const rejected = result[1];
    expect(rejected?.status).toBe('rejected');
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(PromiseTaskError);
      expect((rejected.reason as PromiseTaskError).label).toBe('bad');
    }
  });

  it('applies per-task timeouts with the label on the error', async () => {
    const result = await promiseAll(
      [
        { label: 'slow', promise: () => delay(100, 'slow'), timeout: 10 },
        { label: 'fast', promise: () => delay(1, 'fast') },
      ],
      { strategy: 'settle' },
    );

    expect(result[0]?.status).toBe('rejected');
    const slow = result[0];
    if (slow?.status === 'rejected') {
      expect(slow.reason).toBeInstanceOf(PromiseTaskTimeoutError);
      expect((slow.reason as PromiseTaskTimeoutError).label).toBe('slow');
    }
    expect(result[1]).toEqual({
      status: 'fulfilled',
      label: 'fast',
      value: 'fast',
    });
  });

  it('rejects the batch on the overall timeout (aggregate)', async () => {
    await expect(
      promiseAll(
        [
          { label: 'slow-1', promise: () => delay(100, 'x') },
          { label: 'slow-2', promise: () => delay(100, 'y') },
        ],
        { timeout: 10 },
      ),
    ).rejects.toThrow(PromiseAllTimeoutError);
  });

  it('marks unfinished tasks as rejected instead of throwing on overall timeout (settle)', async () => {
    const result = await promiseAll(
      [
        { label: 'fast', promise: () => delay(1, 'fast') },
        { label: 'slow', promise: () => delay(100, 'slow') },
      ],
      { strategy: 'settle', timeout: 20 },
    );

    expect(result[0]).toEqual({
      status: 'fulfilled',
      label: 'fast',
      value: 'fast',
    });
    expect(result[1]?.status).toBe('rejected');
    expect(result[1]?.label).toBe('slow');
    const slow = result[1];
    if (slow?.status === 'rejected') {
      expect(slow.reason).toBeInstanceOf(PromiseAllTimeoutError);
    }
  });

  it('respects the concurrency limit', async () => {
    let active = 0;
    let maxActive = 0;
    const tracked = (label: string) => () =>
      delay(10, label).then((value) => {
        return value;
      });
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      label: `task-${i}`,
      promise: () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        return tracked(`task-${i}`)().finally(() => {
          active -= 1;
        });
      },
    }));

    const result = await promiseAll(tasks, { concurrency: 2 });

    expect(result).toHaveLength(6);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('returns an empty array for no tasks', async () => {
    await expect(promiseAll([])).resolves.toEqual([]);
  });

  it('stores pending labels on the batch timeout error', async () => {
    const error = await promiseAll(
      [
        { label: 'slow-1', promise: () => delay(100, 'x') },
        { label: 'slow-2', promise: () => delay(100, 'y') },
      ],
      { timeout: 10 },
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(PromiseAllTimeoutError);
    expect((error as PromiseAllTimeoutError).pendingLabels).toEqual([
      'slow-1',
      'slow-2',
    ]);
  });

  it('assimilates non-promise factory returns instead of crashing', async () => {
    const bareThenable = {
      then: (resolve: (value: string) => void) => resolve('thenable-value'),
    };
    const settled = await promiseAll(
      [
        {
          label: 'plain-value',
          promise: () => 42 as unknown as Promise<number>,
        },
        {
          label: 'bare-thenable',
          promise: () => bareThenable as unknown as Promise<string>,
        },
      ],
      { strategy: 'settle' },
    );

    expect(settled).toEqual([
      { status: 'fulfilled', label: 'plain-value', value: 42 },
      {
        status: 'fulfilled',
        label: 'bare-thenable',
        value: 'thenable-value',
      },
    ]);
  });

  it('gives each timed-out task its own reason instance (settle)', async () => {
    const result = await promiseAll(
      [
        { label: 'slow-1', promise: () => delay(100, 'x') },
        { label: 'slow-2', promise: () => delay(100, 'y') },
      ],
      { strategy: 'settle', timeout: 10 },
    );

    const [first, second] = result;
    expect(first?.status).toBe('rejected');
    expect(second?.status).toBe('rejected');
    if (first?.status === 'rejected' && second?.status === 'rejected') {
      expect(first.reason).toBeInstanceOf(PromiseAllTimeoutError);
      expect(second.reason).toBeInstanceOf(PromiseAllTimeoutError);
      expect(first.reason).not.toBe(second.reason);
    }
  });

  it('validates inputs', async () => {
    await expect(
      promiseAll([{ label: '', promise: () => Promise.resolve(1) }]),
    ).rejects.toThrow(TypeError);
    await expect(
      promiseAll([{ label: 'x', promise: () => Promise.resolve(1) }], {
        concurrency: 0,
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      promiseAll([{ label: 'x', promise: () => Promise.resolve(1) }], {
        timeout: -1,
      }),
    ).rejects.toThrow(RangeError);
    await expect(
      promiseAll([
        { label: 'x', promise: () => Promise.resolve(1), timeout: 0 },
      ]),
    ).rejects.toThrow(RangeError);
  });
});
