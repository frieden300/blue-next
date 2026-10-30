import { describe, it, expect } from "vitest";
import {
  formatINR,
  calculateRentalPricing,
  calculateExperienceTotal,
  calculateItemSubtotal,
} from "../pricing";

describe("pricing utils", () => {
  describe("formatINR", () => {
    it("formats numbers into Indian Rupee currency strings", () => {
      expect(formatINR(0)).toBe("₹0");
      expect(formatINR(1500)).toBe("₹1,500");
      expect(formatINR(100000)).toBe("₹1,00,000");
      expect(formatINR(2500.5)).toBe("₹2,500.5");
    });

    it("handles negative numbers and string-number inputs", () => {
      expect(formatINR(-500)).toBe("₹-500");
      expect(formatINR(Number("4200"))).toBe("₹4,200");
    });
  });

  describe("calculateRentalPricing", () => {
    it("calculates single-unit rental totals and 1.5x refundable deposit", () => {
      // 1000/day * 3 days = 3000 rental total. Deposit = round(1000 * 1.5) = 1500. Grand = 4500.
      const breakdown = calculateRentalPricing(1000, 3, 1);
      expect(breakdown.rentalTotal).toBe(3000);
      expect(breakdown.depositAmount).toBe(1500);
      expect(breakdown.grandTotal).toBe(4500);
    });

    it("scales correctly with multi-unit quantities", () => {
      // 1500/day * 2 days * 3 units = 9000. Deposit = round(1500 * 1.5) * 3 = 2250 * 3 = 6750. Grand = 15750.
      const breakdown = calculateRentalPricing(1500, 2, 3);
      expect(breakdown.rentalTotal).toBe(9000);
      expect(breakdown.depositAmount).toBe(6750);
      expect(breakdown.grandTotal).toBe(15750);
    });

    it("rounds deposits for rates with fractional halves", () => {
      // 333/day * 1.5 = 499.5 -> rounds to 500
      const breakdown = calculateRentalPricing(333, 1, 1);
      expect(breakdown.depositAmount).toBe(500);
      expect(breakdown.grandTotal).toBe(333 + 500);
    });

    it("handles 0 or negative duration safely", () => {
      const zeroDuration = calculateRentalPricing(1000, 0, 1);
      expect(zeroDuration.rentalTotal).toBe(0);
      expect(zeroDuration.depositAmount).toBe(1500);
      expect(zeroDuration.grandTotal).toBe(1500);

      const negDuration = calculateRentalPricing(1000, -3, 1);
      expect(negDuration.rentalTotal).toBe(0);
      expect(negDuration.depositAmount).toBe(1500);
      expect(negDuration.grandTotal).toBe(1500);
    });

    it("defaults quantity to at least 1 when 0 or undefined is supplied", () => {
      const defaultQty = calculateRentalPricing(1000, 2);
      expect(defaultQty.rentalTotal).toBe(2000);
      expect(defaultQty.depositAmount).toBe(1500);
      expect(defaultQty.grandTotal).toBe(3500);

      const zeroQty = calculateRentalPricing(1000, 2, 0);
      expect(zeroQty.rentalTotal).toBe(2000);
      expect(zeroQty.depositAmount).toBe(1500);
    });
  });

  describe("calculateExperienceTotal", () => {
    it("calculates unitPrice * guests", () => {
      expect(calculateExperienceTotal(2500, 2)).toBe(5000);
      expect(calculateExperienceTotal(4500, 4)).toBe(18000);
      expect(calculateExperienceTotal(1200, 1)).toBe(1200);
    });

    it("handles 0 guests safely", () => {
      expect(calculateExperienceTotal(2500, 0)).toBe(0);
    });

    it("guards against negative guest numbers by clamping to 0", () => {
      expect(calculateExperienceTotal(2500, -2)).toBe(0);
    });
  });

  describe("calculateItemSubtotal", () => {
    it("calculates unitPrice * quantity for gear items", () => {
      expect(calculateItemSubtotal(899, 1)).toBe(899);
      expect(calculateItemSubtotal(450, 3)).toBe(1350);
    });

    it("handles 0 quantity", () => {
      expect(calculateItemSubtotal(899, 0)).toBe(0);
    });

    it("clamps negative quantity to 0", () => {
      expect(calculateItemSubtotal(899, -5)).toBe(0);
    });
  });
});
