import { describe, it, expect } from "vitest";
import {
  calculateRentalDays,
  getTodayISO,
  getTomorrowISO,
  todayStr,
  tomorrowStr,
  formatDisplayDate,
  formatDurationHours,
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
});
