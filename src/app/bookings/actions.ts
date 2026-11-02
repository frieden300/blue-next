"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID } from "@/lib/utils/validation";
import { getTodayISO, isSessionTimePassed } from "@/lib/utils/dates";

export interface CancelBookingResult {
  success?: boolean;
  error?: string;
}

export async function cancelBookingAction(
  type: "order" | "rental" | "experience",
  id: string
): Promise<CancelBookingResult> {
  if (!id || !type) {
    return { error: "Missing required cancel parameters." };
  }
  if (!isValidUUID(id)) {
    return { error: "Invalid booking ID format." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to cancel a reservation or order." };
  }

  const today = getTodayISO();

  let table: "orders" | "rental_bookings" | "experience_bookings";
  if (type === "order") {
    table = "orders";
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return { error: `Verification failed: ${fetchErr.message}` };
    }
    if (!order) {
      return { error: "Record not found or permission denied." };
    }
    if (order.status === "cancelled") {
      return { error: "This order is already cancelled." };
    }
    if (order.status !== "confirmed") {
      return { error: "Only confirmed orders can be cancelled." };
    }
  } else if (type === "rental") {
    table = "rental_bookings";
    const { data: booking, error: fetchErr } = await supabase
      .from("rental_bookings")
      .select("id, status, pickup_date, return_date")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return { error: `Verification failed: ${fetchErr.message}` };
    }
    if (!booking) {
      return { error: "Record not found or permission denied." };
    }
    if (booking.status === "cancelled") {
      return { error: "This booking is already cancelled." };
    }
    if (booking.status !== "confirmed") {
      return { error: "Only confirmed bookings can be cancelled." };
    }
    if (booking.pickup_date <= today) {
      return { error: "Active or past rentals cannot be cancelled." };
    }
  } else if (type === "experience") {
    table = "experience_bookings";
    const { data: booking, error: fetchErr } = await supabase
      .from("experience_bookings")
      .select("id, status, booking_date, departure_time, session_id, experience_sessions(departure_time)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchErr) {
      return { error: `Verification failed: ${fetchErr.message}` };
    }
    if (!booking) {
      return { error: "Record not found or permission denied." };
    }
    if (booking.status === "cancelled") {
      return { error: "This booking is already cancelled." };
    }
    if (booking.status !== "confirmed") {
      return { error: "Only confirmed bookings can be cancelled." };
    }
    const sess = Array.isArray(booking.experience_sessions)
      ? booking.experience_sessions[0]
      : booking.experience_sessions;
    const resolvedTime = sess?.departure_time || booking.departure_time;
    const isPast =
      booking.booking_date < today ||
      (booking.booking_date === today &&
        isSessionTimePassed(resolvedTime, booking.booking_date));
    if (isPast) {
      return { error: "Past experiences cannot be cancelled." };
    }
  } else {
    return { error: "Invalid booking type." };
  }

  const { data, error } = await supabase
    .from(table)
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .select("id");

  if (error) {
    return { error: `Cancellation failed: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return { error: "Record not found, already cancelled, or permission denied." };
  }

  revalidatePath("/bookings");
  return { success: true };
}

export async function cancelExperienceBooking(id: string): Promise<CancelBookingResult> {
  return cancelBookingAction("experience", id);
}

export async function cancelRentalBooking(id: string): Promise<CancelBookingResult> {
  return cancelBookingAction("rental", id);
}

