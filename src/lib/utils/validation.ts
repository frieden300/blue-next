export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a given string is a valid UUID format.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/**
 * Validates that a numeric input is an integer within a specified inclusive range.
 */
export function isValidIntegerRange(
  val: unknown,
  min: number,
  max: number
): val is number {
  const num = typeof val === "number" ? val : Number(val);
  return Number.isInteger(num) && num >= min && num <= max;
}

/**
 * Domain-specific validator for guest counts or gear quantities (default: 1 to 50).
 */
export function isValidBookingQuantity(
  val: unknown,
  min = 1,
  max = 50
): val is number {
  return isValidIntegerRange(val, min, max);
}
