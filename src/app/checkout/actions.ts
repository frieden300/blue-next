"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID, isValidBookingQuantity } from "@/lib/utils/validation";

export interface CartItemInput {
  listingId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

export interface ConfirmOrderResult {
  success?: boolean;
  orderId?: string;
  error?: string;
}

/**
 * Confirms a demo gear order.
 * - Verifies each listing_id exists and is active in the DB
 * - Snapshots the server-side price (does NOT trust client price)
 * - Inserts order + order_items within one logical operation
 * - Returns orderId on success
 */
export async function confirmOrderAction(
  items: CartItemInput[]
): Promise<ConfirmOrderResult> {
  if (!items || items.length === 0) {
    return { error: "Your cart is empty." };
  }

  const supabase = await createClient();

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to confirm an order." };
  }

  // Validate quantities
  for (const item of items) {
    if (!isValidUUID(item.listingId)) {
      return { error: "Invalid item in cart." };
    }
    if (!isValidBookingQuantity(item.quantity, 1, 50)) {
      return { error: `Invalid quantity for "${item.title}".` };
    }
  }

  // Prepare sanitized items for atomic transactional creation
  const sanitizedItems = items.map((item) => ({
    listing_id: item.listingId,
    quantity: item.quantity,
    image_url: item.imageUrl ?? null,
  }));

  const { data, error: rpcError } = await supabase.rpc("create_order", {
    p_items: sanitizedItems,
  });

  if (rpcError) {
    return { error: rpcError.message || "Failed to create order." };
  }

  const res = data as {
    success: boolean;
    order_id?: string;
    total_amount?: number;
    error?: string;
  };

  if (!res || !res.success) {
    return { error: res?.error || "Failed to create order. Please try again." };
  }

  revalidatePath("/bookings");
  revalidatePath("/checkout");

  return { success: true, orderId: res.order_id };
}
