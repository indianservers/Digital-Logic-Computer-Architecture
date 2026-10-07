/** Read a declared control or initialized transient state without hiding missing inputs. */
export function parameterValue(values: Record<string, number>, key: string): number {
  const value = values[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`Missing or invalid device parameter: ${key}`);
  }
  return value;
}

/** Read a model sample, table row or diagram node after checking its bounds. */
export function itemAt(values: string, index: number): string;
export function itemAt<T extends object, K extends keyof T>(values: T, index: K): Exclude<T[K], undefined>;
export function itemAt(values: string | object, index: PropertyKey): unknown {
  const value = typeof values === 'string' ? values.charAt(Number(index)) || undefined : (values as Readonly<Record<PropertyKey, unknown>>)[index];
  if (value === undefined) throw new RangeError(`Missing device model entry: ${String(index)}`);
  return value;
}
