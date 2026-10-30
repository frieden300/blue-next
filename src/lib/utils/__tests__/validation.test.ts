import { describe, it, expect } from "vitest";
import {
  isValidUUID,
  isValidIntegerRange,
  isValidBookingQuantity,
  UUID_REGEX,
} from "../validation";

describe("validation utils", () => {
  describe("isValidUUID", () => {
    it("accepts valid lowercase and uppercase UUIDs", () => {
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
      expect(isValidUUID("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);
      expect(isValidUUID("  a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  ")).toBe(true);
    });

    it("rejects invalid UUID formats", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("123e4567-e89b-12d3-a456")).toBe(false);
      expect(isValidUUID("123e4567-e89b-12d3-a456-426614174000-extra")).toBe(false);
      expect(isValidUUID("123e4567-e89b-12d3-a456-42661417400g")).toBe(false); // invalid hex char 'g'
    });

    it("rejects empty or whitespace-only strings", () => {
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID("   ")).toBe(false);
    });

    it("rejects non-string inputs safely without throwing", () => {
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(12345)).toBe(false);
      expect(isValidUUID({})).toBe(false);
      expect(isValidUUID([])).toBe(false);
      expect(isValidUUID(true)).toBe(false);
    });

    it("exposes the standard UUID regex pattern", () => {
      expect(UUID_REGEX.test("00000000-0000-0000-0000-000000000000")).toBe(true);
    });
  });

  describe("isValidIntegerRange", () => {
    it("validates integers strictly within the inclusive range", () => {
      expect(isValidIntegerRange(5, 1, 10)).toBe(true);
      expect(isValidIntegerRange(1, 1, 10)).toBe(true);
      expect(isValidIntegerRange(10, 1, 10)).toBe(true);
      expect(isValidIntegerRange("7", 1, 10)).toBe(true);
    });

    it("rejects integers outside the allowed range", () => {
      expect(isValidIntegerRange(0, 1, 10)).toBe(false);
      expect(isValidIntegerRange(11, 1, 10)).toBe(false);
      expect(isValidIntegerRange(-5, 1, 10)).toBe(false);
      expect(isValidIntegerRange(999, 1, 10)).toBe(false);
    });

    it("rejects decimal / non-integer values", () => {
      expect(isValidIntegerRange(2.5, 1, 10)).toBe(false);
      expect(isValidIntegerRange(1.0001, 1, 10)).toBe(false);
      expect(isValidIntegerRange("3.14", 1, 10)).toBe(false);
    });

    it("rejects non-numeric inputs", () => {
      expect(isValidIntegerRange("abc", 1, 10)).toBe(false);
      expect(isValidIntegerRange(NaN, 1, 10)).toBe(false);
      expect(isValidIntegerRange(null, 1, 10)).toBe(false);
      expect(isValidIntegerRange(undefined, 1, 10)).toBe(false);
      expect(isValidIntegerRange({}, 1, 10)).toBe(false);
    });
  });

  describe("isValidBookingQuantity", () => {
    it("uses default bounds (1 to 50)", () => {
      expect(isValidBookingQuantity(1)).toBe(true);
      expect(isValidBookingQuantity(25)).toBe(true);
      expect(isValidBookingQuantity(50)).toBe(true);

      // Boundaries outside 1–50
      expect(isValidBookingQuantity(0)).toBe(false);
      expect(isValidBookingQuantity(-1)).toBe(false);
      expect(isValidBookingQuantity(51)).toBe(false);
    });

    it("accepts custom domain-specific limits", () => {
      // E.g. Experiences guest limits (1 to 12)
      expect(isValidBookingQuantity(1, 1, 12)).toBe(true);
      expect(isValidBookingQuantity(12, 1, 12)).toBe(true);
      expect(isValidBookingQuantity(13, 1, 12)).toBe(false);

      // E.g. Single unit only
      expect(isValidBookingQuantity(1, 1, 1)).toBe(true);
      expect(isValidBookingQuantity(2, 1, 1)).toBe(false);
    });

    it("rejects decimals and invalid input for booking quantities", () => {
      expect(isValidBookingQuantity(2.5)).toBe(false);
      expect(isValidBookingQuantity("five")).toBe(false);
      expect(isValidBookingQuantity(null)).toBe(false);
    });
  });
});
