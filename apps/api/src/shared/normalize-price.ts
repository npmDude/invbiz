/**
 * Normalize a monetary value to a two-decimal string for `numeric(12, 2)`
 * columns. Numbers are formatted; strings pass through unchanged.
 */
export function normalizePrice(value: string | number): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return value;
}
