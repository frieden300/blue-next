import { describe, it, expect } from "vitest";
import {
  calculateRentalDays,
  getTodayISO,
  getTomorrowISO,
  todayStr,
  tomorrowStr,
  formatDisplayDate,
  formatDurationHours,
  formatTime12h,
  formatValidTime12h,
  parseTimeToMinutes,
  isSessionTimePassed,
  isTodayRentalPickupClosed,
  getEarliestRentalPickupDate,
  isExperienceSessionActive,
  isExperienceSessionCompleted,
  extractBookingDurationHours,
  getExperienceBookingStatus,
  getRentalBookingStatus,
} from "../dates";

describe("date utils", () => {
  describe("calculateRentalDays", () => {
    it("calculates single-day rental duration", () => {
      expect(calculateRentalDays("2026-11-01", "2026-11-02")).toBe(1);
      expect(calculateRentalDays(new Date("2026-11-01T10:00:00"), new Date("2026-11-02T10:00:00"))).toBe(1);
    });

    it("calculates multi-day rental durations", () => {
      expect(calculateRentalDays("2026-11-01", "2026-11-08")).toBe(7);
      expect(calculateRentalDays("2026-11-01", "2026-11-30")).toBe(29);
    });

    it("returns 0 for same-day pickup and return", () => {
      expect(calculateRentalDays("2026-11-01", "2026-11-01")).toBe(0);
    });

    it("returns 0 when return date is before pickup date", () => {
      expect(calculateRentalDays("2026-11-05", "2026-11-01")).toBe(0);
    });

    it("handles invalid date strings gracefully with 0", () => {
      expect(calculateRentalDays("invalid-date", "2026-11-05")).toBe(0);
      expect(calculateRentalDays("2026-11-01", "not-a-date")).toBe(0);
    });
  });

  describe("getTodayISO and getTomorrowISO", () => {
    it("generates valid local YYYY-MM-DD date strings", () => {
      const today = getTodayISO();
      const tomorrow = getTomorrowISO();

      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Check aliases
      expect(todayStr()).toBe(today);
      expect(tomorrowStr()).toBe(tomorrow);

      // Today should match current local date parts
      const now = new Date();
      const expectedToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(today).toBe(expectedToday);
    });

    it("ensures tomorrow is one day ahead of today", () => {
      const todayMs = new Date(getTodayISO() + "T00:00:00").getTime();
      const tomorrowMs = new Date(getTomorrowISO() + "T00:00:00").getTime();
      const diffDays = Math.round((tomorrowMs - todayMs) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });
  });

  describe("formatDisplayDate", () => {
    it("formats calendar-date strings safely without timezone day shifts", () => {
      // 15 Nov 2026
      const formatted = formatDisplayDate("2026-11-15");
      expect(formatted).toContain("15");
      expect(formatted).toContain("Nov");
      expect(formatted).toContain("2026");
    });

    it("formats ISO timestamps with time component", () => {
      const formatted = formatDisplayDate("2026-05-20T14:30:00Z");
      expect(formatted).toContain("20");
      expect(formatted).toContain("May");
      expect(formatted).toContain("2026");
    });

    it("accepts Date instances", () => {
      const date = new Date(2026, 0, 10); // 10 Jan 2026 local
      const formatted = formatDisplayDate(date);
      expect(formatted).toContain("10");
      expect(formatted).toContain("Jan");
      expect(formatted).toContain("2026");
    });
  });

  describe("formatDurationHours", () => {
    it("formats durations below one hour in minutes", () => {
      expect(formatDurationHours(0.5)).toBe("30 min");
      expect(formatDurationHours(0.75)).toBe("45 min");
    });

    it("formats durations of exactly one hour", () => {
      expect(formatDurationHours(1)).toBe("1 hr");
    });

    it("formats durations of multiple hours", () => {
      expect(formatDurationHours(2)).toBe("2 hrs");
      expect(formatDurationHours(3.5)).toBe("3.5 hrs");
    });

    it("returns null for non-positive or missing durations", () => {
      expect(formatDurationHours(0)).toBeNull();
      expect(formatDurationHours(-2)).toBeNull();
      expect(formatDurationHours(null)).toBeNull();
      expect(formatDurationHours(undefined)).toBeNull();
    });
  });

  describe("formatTime12h", () => {
    it("converts 24-hour morning time to 12-hour AM", () => {
      expect(formatTime12h("09:00")).toBe("09:00 AM");
      expect(formatTime12h("00:15")).toBe("12:15 AM");
    });

    it("converts 24-hour afternoon/evening time to 12-hour PM", () => {
      expect(formatTime12h("12:00")).toBe("12:00 PM");
      expect(formatTime12h("13:00")).toBe("01:00 PM");
      expect(formatTime12h("15:30")).toBe("03:30 PM");
      expect(formatTime12h("23:45")).toBe("11:45 PM");
    });

    it("normalizes existing 12-hour strings safely", () => {
      expect(formatTime12h("09:00 AM")).toBe("09:00 AM");
      expect(formatTime12h("1:00 pm")).toBe("01:00 PM");
    });

    it("returns empty string for null or empty inputs", () => {
      expect(formatTime12h("")).toBe("");
      expect(formatTime12h(null)).toBe("");
      expect(formatTime12h(undefined)).toBe("");
    });
  });

  describe("formatValidTime12h", () => {
    it("formats valid 24h and 12h times to 12-hour AM/PM format", () => {
      expect(formatValidTime12h("09:00")).toBe("09:00 AM");
      expect(formatValidTime12h("14:00")).toBe("02:00 PM");
      expect(formatValidTime12h("09:00 AM")).toBe("09:00 AM");
      expect(formatValidTime12h("2:30 pm")).toBe("02:30 PM");
    });

    it("returns null for arbitrary text slot labels", () => {
      expect(formatValidTime12h("Afternoon")).toBeNull();
      expect(formatValidTime12h("+Sunset")).toBeNull();
      expect(formatValidTime12h("Morning Session")).toBeNull();
      expect(formatValidTime12h("")).toBeNull();
      expect(formatValidTime12h(null)).toBeNull();
      expect(formatValidTime12h(undefined)).toBeNull();
    });
  });

  describe("parseTimeToMinutes", () => {
    it("parses 24h and 12h time strings into minutes from midnight", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("09:00")).toBe(540);
      expect(parseTimeToMinutes("09:00 AM")).toBe(540);
      expect(parseTimeToMinutes("12:00 PM")).toBe(720);
      expect(parseTimeToMinutes("13:00")).toBe(780);
      expect(parseTimeToMinutes("01:00 PM")).toBe(780);
      expect(parseTimeToMinutes("15:00")).toBe(900);
    });

    it("returns null for invalid time strings", () => {
      expect(parseTimeToMinutes("invalid")).toBeNull();
      expect(parseTimeToMinutes("25:00")).toBeNull();
      expect(parseTimeToMinutes(null)).toBeNull();
    });
  });

  describe("isSessionTimePassed", () => {
    const today = getTodayISO();
    const tomorrow = getTomorrowISO();
    // 3:00 PM (15:00) on today
    const mock3PM = new Date();
    mock3PM.setHours(15, 0, 0, 0);

    it("returns true for a 1:00 PM session when current time is 3:00 PM today", () => {
      expect(isSessionTimePassed("01:00 PM", today, mock3PM)).toBe(true);
      expect(isSessionTimePassed("13:00", today, mock3PM)).toBe(true);
      expect(isSessionTimePassed("09:00 AM", today, mock3PM)).toBe(true);
    });

    it("returns false for a 4:00 PM session when current time is 3:00 PM today", () => {
      expect(isSessionTimePassed("04:00 PM", today, mock3PM)).toBe(false);
      expect(isSessionTimePassed("16:00", today, mock3PM)).toBe(false);
    });

    it("returns false for any session on tomorrow or future dates regardless of current time", () => {
      expect(isSessionTimePassed("09:00 AM", tomorrow, mock3PM)).toBe(false);
      expect(isSessionTimePassed("01:00 PM", tomorrow, mock3PM)).toBe(false);
    });
  });

  describe("rental pickup cutoff", () => {
    it("detects when pickup hours (08:00 - 18:00) have ended for today", () => {
      const mockPast18 = new Date();
      mockPast18.setHours(18, 30, 0, 0);
      expect(isTodayRentalPickupClosed(mockPast18)).toBe(true);
      expect(getEarliestRentalPickupDate(mockPast18)).toBe(getTomorrowISO());

      const mockBefore18 = new Date();
      mockBefore18.setHours(14, 0, 0, 0);
      expect(isTodayRentalPickupClosed(mockBefore18)).toBe(false);
      expect(getEarliestRentalPickupDate(mockBefore18)).toBe(getTodayISO());
    });
  });

  describe("getExperienceBookingStatus", () => {
    const fixedToday = "2026-11-02";
    const mock912AM = new Date("2026-11-02T09:12:00");
    const mock1130AM = new Date("2026-11-02T11:30:00");
    const mock3PM = new Date("2026-11-02T15:00:00");

    it("marks cancelled experiences as Cancelled regardless of date", () => {
      const res = getExperienceBookingStatus(
        { booking_date: "2026-10-31", status: "cancelled" },
        fixedToday,
        mock3PM
      );
      expect(res.displayStatus).toBe("cancelled");
      expect(res.badgeLabel).toBe("Cancelled");
      expect(res.canCancel).toBe(false);
    });

    it("marks past experience dates (< today) as Completed with Book Again available", () => {
      const res = getExperienceBookingStatus(
        { booking_date: "2026-10-31", status: "confirmed" },
        fixedToday,
        mock3PM
      );
      expect(res.displayStatus).toBe("completed");
      expect(res.badgeLabel).toBe("Completed");
      expect(res.badgeClass).toBe("status-completed");
      expect(res.canCancel).toBe(false);
    });

    it("marks today's session as In Session / Active during its duration window", () => {
      // 9:00 AM session with 2 hours duration (9:00 AM to 11:00 AM) inspected at 9:12 AM
      const res = getExperienceBookingStatus(
        { booking_date: fixedToday, departure_time: "09:00 AM", duration_hours: 2, status: "confirmed" },
        fixedToday,
        mock912AM
      );
      expect(res.displayStatus).toBe("active");
      expect(res.badgeLabel).toBe("In Session / Active");
      expect(res.badgeClass).toBe("status-active");
      expect(res.canCancel).toBe(false);
      expect(res.isActive).toBe(true);
    });

    it("marks today's session as Completed after its duration has ended", () => {
      // 9:00 AM session with 2 hours duration (ends at 11:00 AM) inspected at 11:30 AM
      const res = getExperienceBookingStatus(
        { booking_date: fixedToday, departure_time: "09:00 AM", duration_hours: 2, status: "confirmed" },
        fixedToday,
        mock1130AM
      );
      expect(res.displayStatus).toBe("completed");
      expect(res.badgeLabel).toBe("Completed");
      expect(res.badgeClass).toBe("status-completed");
      expect(res.canCancel).toBe(false);
    });

    it("keeps today's session as Confirmed if departure time is in the future", () => {
      const res = getExperienceBookingStatus(
        { booking_date: fixedToday, departure_time: "05:00 PM", duration_hours: 2, status: "confirmed" },
        fixedToday,
        mock3PM
      );
      expect(res.displayStatus).toBe("confirmed");
      expect(res.badgeLabel).toBe("Confirmed");
      expect(res.canCancel).toBe(true);
    });

    it("keeps future dates (> today) as Confirmed with Cancel Booking available", () => {
      const res = getExperienceBookingStatus(
        { booking_date: "2026-11-08", status: "confirmed" },
        fixedToday,
        mock3PM
      );
      expect(res.displayStatus).toBe("confirmed");
      expect(res.badgeLabel).toBe("Confirmed");
      expect(res.canCancel).toBe(true);
    });

    it("verifies isExperienceSessionActive and isExperienceSessionCompleted directly", () => {
      expect(isExperienceSessionActive("09:00 AM", fixedToday, 2, mock912AM)).toBe(true);
      expect(isExperienceSessionActive("09:00 AM", fixedToday, 2, mock1130AM)).toBe(false);
      expect(isExperienceSessionCompleted("09:00 AM", fixedToday, 2, mock1130AM)).toBe(true);
      expect(isExperienceSessionCompleted("09:00 AM", fixedToday, 2, mock912AM)).toBe(false);
    });

    it("extracts duration_hours from listings object or array", () => {
      expect(extractBookingDurationHours({ duration_hours: 3 })).toBe(3);
      expect(extractBookingDurationHours([{ duration_hours: 2.5 }])).toBe(2.5);
      expect(extractBookingDurationHours(null)).toBeNull();
    });
  });

  describe("getRentalBookingStatus", () => {
    const fixedToday = "2026-11-02";

    it("marks cancelled rentals as Cancelled with no cancel button", () => {
      const res = getRentalBookingStatus(
        { pickup_date: "2026-10-25", return_date: "2026-10-28", status: "cancelled" },
        fixedToday
      );
      expect(res.displayStatus).toBe("cancelled");
      expect(res.badgeLabel).toBe("Cancelled");
      expect(res.canCancel).toBe(false);
    });

    it("marks rentals with return_date < today as Completed", () => {
      const res = getRentalBookingStatus(
        { pickup_date: "2026-10-25", return_date: "2026-10-31", status: "confirmed" },
        fixedToday
      );
      expect(res.displayStatus).toBe("completed");
      expect(res.badgeLabel).toBe("Completed");
      expect(res.badgeClass).toBe("status-completed");
      expect(res.canCancel).toBe(false);
    });

    it("marks rentals currently in use (pickup <= today <= return) as In Use / Active", () => {
      const res = getRentalBookingStatus(
        { pickup_date: "2026-11-01", return_date: "2026-11-05", status: "confirmed" },
        fixedToday
      );
      expect(res.displayStatus).toBe("active");
      expect(res.badgeLabel).toBe("In Use / Active");
      expect(res.badgeClass).toBe("status-active");
      expect(res.canCancel).toBe(false);
    });

    it("marks rentals starting today as In Use / Active and non-cancellable", () => {
      const res = getRentalBookingStatus(
        { pickup_date: "2026-11-02", return_date: "2026-11-04", status: "confirmed" },
        fixedToday
      );
      expect(res.displayStatus).toBe("active");
      expect(res.badgeLabel).toBe("In Use / Active");
      expect(res.canCancel).toBe(false);
    });

    it("marks future rentals (pickup > today) as Confirmed with Cancel Booking available", () => {
      const res = getRentalBookingStatus(
        { pickup_date: "2026-11-05", return_date: "2026-11-10", status: "confirmed" },
        fixedToday
      );
      expect(res.displayStatus).toBe("confirmed");
      expect(res.badgeLabel).toBe("Confirmed");
      expect(res.canCancel).toBe(true);
    });
  });
});

