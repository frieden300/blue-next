/**
 * Calculates rental duration in whole days between pickup and return dates.
 */
export function calculateRentalDays(
  pickupDate: string | Date,
  returnDate: string | Date
): number {
  const pickup = typeof pickupDate === "string" ? new Date(pickupDate) : pickupDate;
  const ret = typeof returnDate === "string" ? new Date(returnDate) : returnDate;
  const diffMs = ret.getTime() - pickup.getTime();
  if (Number.isNaN(diffMs)) return 0;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Returns today's calendar date as YYYY-MM-DD in local time.
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns tomorrow's calendar date as YYYY-MM-DD in local time.
 */
export function getTomorrowISO(): string {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const todayStr = getTodayISO;
export const tomorrowStr = getTomorrowISO;

/**
 * Formats a calendar date or timestamp into the localized format "DD Mon YYYY" (e.g., "15 Nov 2026").
 * Timezone safety: date-only strings (YYYY-MM-DD) are normalized to local midnight.
 */
export function formatDisplayDate(dateInput: string | Date): string {
  const d =
    typeof dateInput === "string" && !dateInput.includes("T")
      ? new Date(dateInput + "T00:00:00")
      : new Date(dateInput);

  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats experience duration hours into human-readable labels (e.g., "45 min", "1 hr", "3 hrs").
 */
export function formatDurationHours(
  hours: number | null | undefined
): string | null {
  if (!hours || hours <= 0) return null;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours === 1) return "1 hr";
  return `${hours} hrs`;
}
