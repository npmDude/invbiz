import { PromisePool } from '@supercharge/promise-pool';

export type PromiseAllStrategy = 'aggregate' | 'settle';

/**
 * A single unit of work for {@link promiseAll}.
 *
 * `promise` is a factory so work starts only when the pool invokes it — that
 * is what makes the `concurrency` limit effective. Already-created promises
 * are rejected: they start executing immediately, so concurrency could not
 * gate them.
 */
export interface PromiseTask<T = unknown> {
  label: string;
  promise: () => Promise<T>;
  /** Per-task timeout in milliseconds. Overrides nothing; independent of the batch `timeout`. */
  timeout?: number;
}

export interface PromiseAllOptions {
  /**
   * Overall batch timeout in milliseconds. In `aggregate` mode the batch
   * rejects with a {@link PromiseAllTimeoutError}; in `settle` mode unfinished
   * tasks are returned as rejected entries instead of throwing.
   */
  timeout?: number;
  /** How to resolve the batch. Defaults to `'aggregate'`. */
  strategy?: PromiseAllStrategy;
  /** How many tasks run at a time. Defaults to unbounded (`tasks.length`). */
  concurrency?: number;
}

export interface PromiseAllSettledFulfilled<T = unknown> {
  status: 'fulfilled';
  label: string;
  value: T;
}

export interface PromiseAllSettledRejected {
  status: 'rejected';
  label: string;
  reason: unknown;
}

export type PromiseAllSettledResult<T = unknown> =
  PromiseAllSettledFulfilled<T> | PromiseAllSettledRejected;

/** Rejection of a single labeled task. Always carries the task's `label`. */
export class PromiseTaskError extends Error {
  readonly label: string;

  constructor(label: string, cause: unknown) {
    super(`Task "${label}" failed: ${messageOf(cause)}`);
    this.name = 'PromiseTaskError';
    this.label = label;
    this.cause = cause;
  }
}

/** A task that did not settle within its own `timeout`. Carries the task's `label`. */
export class PromiseTaskTimeoutError extends Error {
  readonly label: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`Task "${label}" timed out after ${timeoutMs}ms`);
    this.name = 'PromiseTaskTimeoutError';
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

/** The whole batch did not settle within the overall `timeout`. */
export class PromiseAllTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly pendingLabels: string[];

  constructor(timeoutMs: number, pendingLabels: string[]) {
    super(
      pendingLabels.length > 0
        ? `promiseAll timed out after ${timeoutMs}ms (pending: ${pendingLabels.map((label) => `"${label}"`).join(', ')})`
        : `promiseAll timed out after ${timeoutMs}ms`,
    );
    this.name = 'PromiseAllTimeoutError';
    this.timeoutMs = timeoutMs;
    this.pendingLabels = [...pendingLabels];
  }
}

export function promiseAll<T extends unknown[]>(
  tasks: { [K in keyof T]: PromiseTask<T[K]> },
  options?: PromiseAllOptions & { strategy?: 'aggregate' },
): Promise<T>;
export function promiseAll<T extends unknown[]>(
  tasks: { [K in keyof T]: PromiseTask<T[K]> },
  options: PromiseAllOptions & { strategy: 'settle' },
): Promise<{ [K in keyof T]: PromiseAllSettledResult<T[K]> }>;
export async function promiseAll(
  tasks: Array<PromiseTask<unknown>>,
  options: PromiseAllOptions = {},
): Promise<unknown[] | Array<PromiseAllSettledResult<unknown>>> {
  validateTasks(tasks);
  const { timeout, strategy, concurrency } = validateOptions(options);

  if (tasks.length === 0) {
    return [];
  }

  type Outcome =
    | { settled: true; value: unknown }
    | { settled: true; error: unknown }
    | { settled: false };
  const outcomes: Outcome[] = tasks.map(() => ({ settled: false as const }));

  // Factories are invoked lazily inside the pool, so `concurrency` gates when
  // work actually starts.
  //
  // Note: an overall timeout does not abort in-flight work — promises are not
  // cancellable. Remaining tasks run to completion in the background; their
  // outcomes are captured in `outcomes` (already caught, so no unhandled
  // rejections) and simply ignored once the batch has timed out.
  const run = async (): Promise<void> => {
    const items = tasks.map((task, index) => ({ index, task }));
    await PromisePool.for(items)
      .withConcurrency(concurrency ?? tasks.length)
      .process(async ({ index, task }) => {
        try {
          const value = await runTask(task.promise, task);
          outcomes[index] = { settled: true, value };
        } catch (error) {
          outcomes[index] = { settled: true, error };
        }
      });
  };

  if (timeout === undefined) {
    await run();
  } else {
    const finishedInTime = await raceBatch(run(), timeout);
    if (!finishedInTime) {
      const pendingLabels = tasks
        .filter((_, index) => outcomes[index]?.settled === false)
        .map((task) => task.label);
      const batchError = new PromiseAllTimeoutError(timeout, pendingLabels);
      if (strategy === 'settle') {
        return tasks.map((task, index) => {
          const outcome = outcomes[index];
          if (outcome?.settled === true && 'value' in outcome) {
            const fulfilled: PromiseAllSettledFulfilled = {
              status: 'fulfilled',
              label: task.label,
              value: outcome.value,
            };
            return fulfilled;
          }
          if (outcome?.settled === true && 'error' in outcome) {
            const rejected: PromiseAllSettledRejected = {
              status: 'rejected',
              label: task.label,
              reason: outcome.error,
            };
            return rejected;
          }
          const timedOut: PromiseAllSettledRejected = {
            status: 'rejected',
            label: task.label,
            // Fresh instance per task so entries never share an identical
            // `reason` object.
            reason: new PromiseAllTimeoutError(timeout, pendingLabels),
          };
          return timedOut;
        });
      }
      throw batchError;
    }
  }

  if (strategy === 'settle') {
    return tasks.map((task, index) => {
      const outcome = outcomes[index];
      if (outcome?.settled === true && 'value' in outcome) {
        const fulfilled: PromiseAllSettledFulfilled = {
          status: 'fulfilled',
          label: task.label,
          value: outcome.value,
        };
        return fulfilled;
      }
      const rejected: PromiseAllSettledRejected = {
        status: 'rejected',
        label: task.label,
        reason:
          outcome?.settled === true && 'error' in outcome
            ? outcome.error
            : new PromiseTaskError(task.label, new Error('Task did not run')),
      };
      return rejected;
    });
  }

  const failures: unknown[] = [];
  const values: unknown[] = tasks.map((task, index) => {
    const outcome = outcomes[index];
    if (outcome?.settled === true && 'value' in outcome) {
      return outcome.value;
    }
    const error =
      outcome?.settled === true && 'error' in outcome
        ? outcome.error
        : new PromiseTaskError(task.label, new Error('Task did not run'));
    failures.push(error);
    return undefined as unknown;
  });
  if (failures.length > 0) {
    const labels = failures
      .map((failure) =>
        failure instanceof PromiseTaskError ||
        failure instanceof PromiseTaskTimeoutError
          ? `"${failure.label}"`
          : 'unknown',
      )
      .join(', ');
    throw new AggregateError(
      failures,
      `${failures.length} of ${tasks.length} tasks failed (${labels})`,
    );
  }
  return values;
}

async function runTask<T>(
  start: () => Promise<T>,
  task: PromiseTask<T>,
): Promise<T> {
  // Invoke the factory inside `then` so a non-promise (or bare thenable)
  // returned by a JS caller bypassing the types is assimilated into a native
  // promise — `started.catch` below is then always safe.
  let started: Promise<T>;
  try {
    started = Promise.resolve().then(() => start());
  } catch (error) {
    throw new PromiseTaskError(task.label, error);
  }
  // Avoid unhandled rejections between `start()` and the race below.
  started.catch(() => {});
  try {
    const value =
      task.timeout === undefined
        ? await started
        : await raceTask(started, task.label, task.timeout);
    return value;
  } catch (error) {
    if (error instanceof PromiseTaskTimeoutError) {
      throw error;
    }
    throw new PromiseTaskError(task.label, error);
  }
}

function raceTask<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new PromiseTaskTimeoutError(label, timeoutMs));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function raceBatch(
  promise: Promise<void>,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, timeoutMs);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}

function validateTasks(
  tasks: unknown,
): asserts tasks is Array<PromiseTask<never>> {
  if (!Array.isArray(tasks)) {
    throw new TypeError('promiseAll expects an array of tasks.');
  }
  tasks.forEach((task, index) => {
    if (typeof task !== 'object' || task === null) {
      throw new TypeError(`Task at index ${index} must be an object.`);
    }
    const entry = task as Partial<PromiseTask>;
    if (typeof entry.label !== 'string' || entry.label.length === 0) {
      throw new TypeError(
        `Task at index ${index} must have a non-empty string "label".`,
      );
    }
    if (typeof entry.promise !== 'function') {
      throw new TypeError(
        `Task "${entry.label}" must provide a "promise" factory function (() => Promise).`,
      );
    }
    if (entry.timeout !== undefined) {
      assertPositiveTimeout(entry.timeout, `Task "${entry.label}" timeout`);
    }
  });
}

function validateOptions(options: PromiseAllOptions): {
  timeout: number | undefined;
  strategy: PromiseAllStrategy;
  concurrency: number | undefined;
} {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('promiseAll options must be an object.');
  }
  const strategy = options.strategy ?? 'aggregate';
  if (strategy !== 'aggregate' && strategy !== 'settle') {
    throw new TypeError('promiseAll strategy must be "aggregate" or "settle".');
  }
  if (options.timeout !== undefined) {
    assertPositiveTimeout(options.timeout, 'Batch timeout');
  }
  let concurrency: number | undefined;
  if (options.concurrency !== undefined) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new RangeError('promiseAll concurrency must be an integer >= 1.');
    }
    concurrency = options.concurrency;
  }
  return {
    timeout: options.timeout,
    strategy,
    concurrency,
  };
}

function assertPositiveTimeout(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number > 0 (milliseconds).`);
  }
}
