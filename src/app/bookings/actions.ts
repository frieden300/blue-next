"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to cancel a reservation or order." };
  }

  let table: "orders" | "rental_bookings" | "experience_bookings";
  if (type === "order") {
    table = "orders";
  } else if (type === "rental") {
    table = "rental_bookings";
  } else if (type === "experience") {
    table = "experience_bookings";
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
