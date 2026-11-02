"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID, isValidBookingQuantity } from "@/lib/utils/validation";
import { calculateRentalDays, getTodayISO, getTomorrowISO, isTodayRentalPickupClosed } from "@/lib/utils/dates";

export interface RentalBookingInput {
  listingId: string;
  pickupDate: string;  // YYYY-MM-DD
  returnDate: string;  // YYYY-MM-DD
  quantity?: number;
}

export interface RentalBookingResult {
  success?: boolean;
  bookingId?: string;
  rentalTotal?: number;
  depositAmount?: number;
  durationDays?: number;
  quantity?: number;
  error?: string;
}

export async function confirmRentalBookingAction(
  input: RentalBookingInput
): Promise<RentalBookingResult> {
  const { listingId, pickupDate, returnDate, quantity = 1 } = input;

  // Basic input validation
  if (!listingId || !pickupDate || !returnDate) {
    return { error: "Missing required booking fields." };
  }

  if (!isValidUUID(listingId)) {
    return { error: "Invalid listing ID format." };
  }

  const requestedQty = Number(quantity);
  if (!isValidBookingQuantity(requestedQty, 1, 50)) {
    return { error: "Quantity must be a valid whole number between 1 and 50." };
  }

  const pickup = new Date(pickupDate);
  const ret = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(pickup.getTime()) || isNaN(ret.getTime())) {
    return { error: "Invalid dates provided." };
  }
  if (pickup < today) {
    return { error: "Pickup date cannot be in the past." };
  }
  if (pickupDate === getTodayISO() && isTodayRentalPickupClosed()) {
    return {
      error: "Pickup hours for today (08:00 — 18:00) have ended. Please select tomorrow or a later date for equipment pickup.",
    };
  }
  if (ret <= pickup) {
    return { error: "Return date must be after the pickup date." };
  }

  const durationDays = calculateRentalDays(pickupDate, returnDate);

  if (durationDays < 1 || durationDays > 365) {
    return { error: "Rental duration must be between 1 and 365 days." };
  }

  const supabase = await createClient();

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to make a rental booking." };
  }

  // Atomically lock listing row, check overlapping confirmed inventory, and insert reservation
  const { data, error: rpcError } = await supabase.rpc("book_rental", {
    p_listing_id: listingId,
    p_pickup_date: pickupDate,
    p_return_date: returnDate,
    p_quantity: requestedQty,
  });

  if (rpcError) {
    return { error: rpcError.message || "Failed to confirm rental booking." };
  }

  const res = data as {
    success: boolean;
    booking_id?: string;
    rental_total?: number;
    deposit_amount?: number;
    duration_days?: number;
    quantity?: number;
    error?: string;
  };

  if (!res || !res.success) {
    return { error: res?.error || "Unable to confirm rental booking." };
  }

  revalidatePath("/bookings");

  return {
    success: true,
    bookingId: res.booking_id,
    rentalTotal: Number(res.rental_total),
    depositAmount: Number(res.deposit_amount),
    durationDays: Number(res.duration_days),
    quantity: Number(res.quantity),
  };
}

export interface RentalAvailabilityResult {
  available: boolean;
  inventoryCount?: number;
  maxReserved?: number;
  remaining?: number;
  nextAvailableDate?: string | null;
  error?: string;
}

export async function checkRentalAvailabilityAction(
  listingId: string,
  pickupDate: string,
  returnDate: string,
  quantity = 1
): Promise<RentalAvailabilityResult> {
  if (!isValidUUID(listingId) || !pickupDate || !returnDate) {
    return { available: false, error: "Missing required date fields." };
  }

  if (pickupDate === getTodayISO() && isTodayRentalPickupClosed()) {
    return {
      available: false,
      remaining: 0,
      nextAvailableDate: getTomorrowISO(),
      error: "Pickup hours for today (08:00 — 18:00) have ended.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_rental_availability", {
    p_listing_id: listingId,
    p_pickup_date: pickupDate,
    p_return_date: returnDate,
    p_quantity: quantity,
  });

  if (error) {
    return { available: false, error: error.message };
  }

  const res = data as {
    available: boolean;
    inventory_count?: number;
    max_reserved?: number;
    remaining?: number;
    next_available_date?: string | null;
    error?: string;
  };

  return {
    available: !!res?.available,
    inventoryCount: res?.inventory_count,
    maxReserved: res?.max_reserved,
    remaining: res?.remaining,
    nextAvailableDate: res?.next_available_date,
    error: res?.error,
  };
}
