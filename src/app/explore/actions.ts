"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID, isValidBookingQuantity } from "@/lib/utils/validation";

export interface ExperienceBookingInput {
  listingId: string;
  listingTitle?: string;
  bookingDate: string; // YYYY-MM-DD
  guests: number;
  sessionId?: string;
}

export interface ExperienceBookingResult {
  success?: boolean;
  bookingId?: string;
  totalAmount?: number;
  unitPrice?: number;
  guests?: number;
  error?: string;
}

export async function confirmExperienceBookingAction(
  input: ExperienceBookingInput
): Promise<ExperienceBookingResult> {
  const { listingId, bookingDate, guests } = input;

  // Basic validation
  if (!listingId || !bookingDate || !guests) {
    return { error: "Missing required booking fields." };
  }

  // Reject non-UUID listing references
  if (!isValidUUID(listingId)) {
    return {
      error: "Invalid listing reference. Experience booking requires an active database listing.",
    };
  }

  const dateObj = new Date(bookingDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(dateObj.getTime())) {
    return { error: "Invalid booking date provided." };
  }
  if (dateObj < today) {
    return { error: "Booking date cannot be in the past." };
  }
  if (!isValidBookingQuantity(guests)) {
    return { error: "Number of guests must be a valid whole number between 1 and 50." };
  }

  const supabase = await createClient();

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to book an experience." };
  }

  // Atomically lock listing row, check calendar date/session capacity, derive price, and insert reservation
  const { data, error: rpcError } = await supabase.rpc("book_experience", {
    p_listing_id: listingId,
    p_booking_date: bookingDate,
    p_guests: guests,
    p_session_id: input.sessionId || null,
  });

  if (rpcError) {
    return { error: rpcError.message || "Failed to confirm experience booking." };
  }

  const res = data as {
    success: boolean;
    booking_id?: string;
    total_amount?: number;
    unit_price?: number;
    guests?: number;
    error?: string;
  };

  if (!res || !res.success) {
    return { error: res?.error || "Unable to confirm experience booking." };
  }

  revalidatePath("/bookings");
  return {
    success: true,
    bookingId: res.booking_id,
    totalAmount: Number(res.total_amount),
    unitPrice: Number(res.unit_price),
    guests: Number(res.guests),
  };
}

export interface SessionAvailabilityItem {
  sessionId: string;
  departureTime: string;
  label: string | null;
  maxCapacity: number;
  bookedGuests: number;
  availableSpots: number;
  isAvailable: boolean;
}

export async function getExperienceSessionsAvailabilityAction(
  listingId: string,
  bookingDate: string
): Promise<{ sessions?: SessionAvailabilityItem[]; error?: string }> {
  if (!isValidUUID(listingId)) {
    return { sessions: [] };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_experience_sessions_availability", {
      p_listing_id: listingId,
      p_booking_date: bookingDate,
    });

    if (error) {
      return { error: error.message };
    }

    const rows = (data || []) as Array<{
      session_id: string;
      departure_time: string;
      label: string | null;
      max_capacity: number;
      booked_guests: number | string;
      available_spots: number | string;
      is_available: boolean;
    }>;

    return {
      sessions: rows.map((r) => ({
        sessionId: r.session_id,
        departureTime: r.departure_time,
        label: r.label,
        maxCapacity: Number(r.max_capacity),
        bookedGuests: Number(r.booked_guests),
        availableSpots: Number(r.available_spots),
        isAvailable: Boolean(r.is_available),
      })),
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load session availability." };
  }
}
