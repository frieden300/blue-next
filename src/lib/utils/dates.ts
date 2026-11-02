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

/**
 * Formats a time string into standard 12-hour AM/PM format (e.g. "09:00 AM", "01:30 PM").
 * Accepts both 24-hour ("09:00", "13:30") and existing 12-hour formats.
 */
export function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const meridian = ampmMatch[3].toUpperCase();
    return `${String(h).padStart(2, "0")}:${m} ${meridian}`;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let hour = parseInt(match24[1], 10);
    const minute = match24[2];
    const meridian = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, "0")}:${minute} ${meridian}`;
  }

  return trimmed;
}

/**
 * Safely formats a departure time into standard 12-hour AM/PM format ("09:00 AM", "02:00 PM").
 * Returns null if input is missing or cannot be parsed as a valid time of day (e.g. text labels like "Afternoon").
 */
export function formatValidTime12h(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes === null) return null;
  return formatTime12h(timeStr);
}

/**
 * Parses a time string (12h or 24h) into total minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toUpperCase();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridian = match[3];

  if (meridian === "PM" && hour < 12) hour += 12;
  if (meridian === "AM" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

/**
 * Checks if a session departure time has already passed for a given calendar date.
 * If targetDateStr is not today, returns false.
 */
export function isSessionTimePassed(
  departureTime?: string | null,
  targetDateStr?: string | null,
  referenceTime: Date = new Date()
): boolean {
  if (!departureTime || !targetDateStr) return false;
  if (targetDateStr !== getTodayISO()) return false;

  const sessionMinutes = parseTimeToMinutes(departureTime);
  if (sessionMinutes === null) return false;

  const currentMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes();
  return sessionMinutes <= currentMinutes;
}

/**
 * Rental pickup closing hour (18:00 / 6:00 PM).
 */
export const RENTAL_PICKUP_END_HOUR = 18;

/**
 * Checks if today's rental pickup hours (08:00 — 18:00) have ended.
 */
export function isTodayRentalPickupClosed(referenceTime: Date = new Date()): boolean {
  return referenceTime.getHours() >= RENTAL_PICKUP_END_HOUR;
}

/**
 * Returns earliest bookable rental pickup date (tomorrow if today's hours ended, otherwise today).
 */
export function getEarliestRentalPickupDate(referenceTime: Date = new Date()): string {
  return isTodayRentalPickupClosed(referenceTime) ? getTomorrowISO() : getTodayISO();
}

/**
 * Extracts duration_hours from joined listings relation.
 */
export function extractBookingDurationHours(
  listings?: { duration_hours?: number | null } | { duration_hours?: number | null }[] | null
): number | null {
  if (!listings) return null;
  if (Array.isArray(listings)) {
    return listings[0]?.duration_hours ?? null;
  }
  return listings.duration_hours ?? null;
}

/**
 * Checks if an experience session is currently in progress (within departure_time to departure_time + duration).
 */
export function isExperienceSessionActive(
  departureTime?: string | null,
  bookingDateStr?: string | null,
  durationHours?: number | null,
  referenceTime: Date = new Date()
): boolean {
  if (!departureTime || !bookingDateStr) return false;
  const startMinutes = parseTimeToMinutes(departureTime);
  if (startMinutes === null) return false;

  const [y, m, d] = bookingDateStr.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return false;

  const startHour = Math.floor(startMinutes / 60);
  const startMin = startMinutes % 60;
  const startDate = new Date(y, m - 1, d, startHour, startMin, 0, 0);

  const duration = durationHours && durationHours > 0 ? durationHours : 2;
  const endDate = new Date(startDate.getTime() + Math.round(duration * 60 * 60 * 1000));

  const nowMs = referenceTime.getTime();
  return nowMs >= startDate.getTime() && nowMs < endDate.getTime();
}

/**
 * Checks if an experience session duration has concluded.
 */
export function isExperienceSessionCompleted(
  departureTime?: string | null,
  bookingDateStr?: string | null,
  durationHours?: number | null,
  referenceTime: Date = new Date(),
  todayDateStr: string = getTodayISO()
): boolean {
  if (!bookingDateStr) return false;
  if (!departureTime) {
    return bookingDateStr < todayDateStr;
  }
  const startMinutes = parseTimeToMinutes(departureTime);
  if (startMinutes === null) {
    return bookingDateStr < todayDateStr;
  }

  const [y, m, d] = bookingDateStr.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return false;

  const startHour = Math.floor(startMinutes / 60);
  const startMin = startMinutes % 60;
  const startDate = new Date(y, m - 1, d, startHour, startMin, 0, 0);

  const duration = durationHours && durationHours > 0 ? durationHours : 2;
  const endDate = new Date(startDate.getTime() + Math.round(duration * 60 * 60 * 1000));

  return referenceTime.getTime() >= endDate.getTime();
}

export interface ExperienceBookingLifecycle {
  displayStatus: "confirmed" | "active" | "completed" | "cancelled" | string;
  badgeLabel: string;
  badgeClass: string;
  canCancel: boolean;
  isPast: boolean;
  isActive: boolean;
}

/**
 * Derives time-aware lifecycle display status for experience reservations.
 * If current time is within [departure_time, departure_time + duration_hours], status is "active".
 * Only transitions to "completed" after the session duration has concluded.
 */
export function getExperienceBookingStatus(
  booking: {
    booking_date: string;
    departure_time?: string | null;
    duration_hours?: number | null;
    status: string;
  },
  todayDateStr: string = getTodayISO(),
  referenceTime: Date = new Date()
): ExperienceBookingLifecycle {
  const isActive = isExperienceSessionActive(
    booking.departure_time,
    booking.booking_date,
    booking.duration_hours,
    referenceTime
  );

  const isCompleted = isExperienceSessionCompleted(
    booking.departure_time,
    booking.booking_date,
    booking.duration_hours,
    referenceTime,
    todayDateStr
  );

  if (booking.status === "cancelled") {
    return {
      displayStatus: "cancelled",
      badgeLabel: "Cancelled",
      badgeClass: "status-cancelled",
      canCancel: false,
      isPast: isCompleted,
      isActive: false,
    };
  }

  if (isActive) {
    return {
      displayStatus: "active",
      badgeLabel: "In Session / Active",
      badgeClass: "status-active",
      canCancel: false,
      isPast: false,
      isActive: true,
    };
  }

  if (isCompleted) {
    return {
      displayStatus: "completed",
      badgeLabel: "Completed",
      badgeClass: "status-completed",
      canCancel: false,
      isPast: true,
      isActive: false,
    };
  }

  const isConfirmed = booking.status === "confirmed";
  return {
    displayStatus: booking.status,
    badgeLabel: isConfirmed ? "Confirmed" : booking.status,
    badgeClass: `status-${booking.status}`,
    canCancel: isConfirmed,
    isPast: false,
    isActive: false,
  };
}

export interface RentalBookingLifecycle {
  displayStatus: "confirmed" | "active" | "completed" | "cancelled" | string;
  badgeLabel: string;
  badgeClass: string;
  canCancel: boolean;
  isPast: boolean;
  isActive: boolean;
}

/**
 * Derives time-aware lifecycle display status for equipment rental reservations.
 */
export function getRentalBookingStatus(
  booking: {
    pickup_date: string;
    return_date: string;
    status: string;
  },
  todayDateStr: string = getTodayISO()
): RentalBookingLifecycle {
  if (booking.status === "cancelled") {
    return {
      displayStatus: "cancelled",
      badgeLabel: "Cancelled",
      badgeClass: "status-cancelled",
      canCancel: false,
      isPast: booking.return_date < todayDateStr,
      isActive: false,
    };
  }

  if (booking.return_date < todayDateStr) {
    return {
      displayStatus: "completed",
      badgeLabel: "Completed",
      badgeClass: "status-completed",
      canCancel: false,
      isPast: true,
      isActive: false,
    };
  }

  if (booking.pickup_date <= todayDateStr && todayDateStr <= booking.return_date) {
    return {
      displayStatus: "active",
      badgeLabel: "In Use / Active",
      badgeClass: "status-active",
      canCancel: false,
      isPast: false,
      isActive: true,
    };
  }

  const isConfirmed = booking.status === "confirmed";
  return {
    displayStatus: booking.status,
    badgeLabel: isConfirmed ? "Confirmed" : booking.status,
    badgeClass: `status-${booking.status}`,
    canCancel: isConfirmed && booking.pickup_date > todayDateStr,
    isPast: false,
    isActive: false,
  };
}

