export function must<T>(value: T | undefined | null, message = "Missing value"): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}
