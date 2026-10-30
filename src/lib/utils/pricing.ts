/**
 * Formats a numeric currency value into localized Indian Rupee format (e.g., "₹1,500").
 */
export function formatINR(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export interface RentalPricingBreakdown {
  rentalTotal: number;
  depositAmount: number;
  grandTotal: number;
}

/**
 * Calculates rental total, security deposit, and grand total matching the database RPC formula.
 */
export function calculateRentalPricing(
  dailyRate: number,
  durationDays: number,
  quantity = 1
): RentalPricingBreakdown {
  const rentalTotal = Math.max(0, durationDays) * Number(dailyRate) * Math.max(1, quantity);
  const depositAmount = Math.round(Number(dailyRate) * 1.5) * Math.max(1, quantity);
  return {
    rentalTotal,
    depositAmount,
    grandTotal: rentalTotal + depositAmount,
  };
}

/**
 * Calculates experience booking total based on unit price and number of guests.
 */
export function calculateExperienceTotal(
  unitPrice: number,
  guests: number
): number {
  return Number(unitPrice) * Math.max(0, guests);
}

/**
 * Calculates gear item subtotal.
 */
export function calculateItemSubtotal(
  unitPrice: number,
  quantity: number
): number {
  return Number(unitPrice) * Math.max(0, quantity);
}
