"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface PartnerActionState {
  error?: string | null;
  success?: string | null;
}

// ── Submit or resubmit a partner application ──────────────────
export async function submitPartnerApplicationAction(
  _prev: PartnerActionState,
  formData: FormData
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in to apply." };

  const businessName = formData.get("business_name")?.toString().trim();
  const contactEmail = formData.get("contact_email")?.toString().trim();
  const location = formData.get("location")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim();
  const services = formData.getAll("services").map((s) => s.toString());

  if (!businessName) return { error: "Business name is required." };
  if (!contactEmail) return { error: "Contact email is required." };
  if (!description) return { error: "Description is required." };
  if (services.length === 0) return { error: "Select at least one service type." };

  const validServices = ["experience", "sell", "rent"];
  if (services.some((s) => !validServices.includes(s))) {
    return { error: "Invalid service type selected." };
  }

  // Check partner profile to see if user is an existing verified partner
  const { data: partnerProfile } = await supabase
    .from("partner_profiles")
    .select("id, verified, service_types, business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const isVerifiedPartner = !!partnerProfile?.verified;
  const existingServices: string[] = Array.isArray(partnerProfile?.service_types)
    ? (partnerProfile!.service_types as string[])
    : [];

  const mergedServices = Array.from(new Set([...existingServices, ...services]));

  // Check for existing active or pending application
  const { data: existingApp } = await supabase
    .from("partner_applications")
    .select("id, status, services")
    .eq("user_id", user.id)
    .in("status", ["pending", "approved"])
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingApp?.status === "pending") {
    return { error: "You already have a pending application or upgrade under review." };
  }

  if (isVerifiedPartner) {
    if (existingServices.length >= 3 || mergedServices.length === existingServices.length) {
      return { error: "You already have all requested services approved." };
    }

    if (existingApp) {
      // Update existing application with merged services
      const { error } = await supabase
        .from("partner_applications")
        .update({
          business_name: businessName,
          contact_email: contactEmail,
          location,
          description,
          services: mergedServices,
          status: "pending",
          reviewer_id: null,
          reviewer_note: null,
          reviewed_at: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id);

      if (error) return { error: `Failed to submit upgrade: ${error.message}` };
    } else {
      const { error } = await supabase.from("partner_applications").insert({
        user_id: user.id,
        business_name: businessName,
        contact_email: contactEmail,
        location,
        description,
        services: mergedServices,
        status: "pending",
      });

      if (error) return { error: `Failed to submit upgrade: ${error.message}` };
    }

    revalidatePath("/partner/apply");
    revalidatePath("/partner/dashboard");
    return { success: "Service upgrade request submitted! We will review it shortly." };
  }

  // Check if there's a rejected application to update instead of inserting new
  const { data: rejected } = await supabase
    .from("partner_applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "rejected")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rejected) {
    // Resubmit: reset to pending, clear reviewer fields
    const { error } = await supabase
      .from("partner_applications")
      .update({
        business_name: businessName,
        contact_email: contactEmail,
        location,
        description,
        services,
        status: "pending",
        reviewer_id: null,
        reviewer_note: null,
        reviewed_at: null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", rejected.id);

    if (error) return { error: `Failed to resubmit: ${error.message}` };
  } else {
    // Fresh insert
    const { error } = await supabase.from("partner_applications").insert({
      user_id: user.id,
      business_name: businessName,
      contact_email: contactEmail,
      location,
      description,
      services,
      status: "pending",
    });

    if (error) return { error: `Submission failed: ${error.message}` };
  }

  revalidatePath("/partner/apply");
  revalidatePath("/partner/dashboard");
  return { success: "Application submitted successfully! We will review it shortly." };
}

// ── Create a listing (approved partner only) ──────────────────
export async function createListingAction(
  _prev: PartnerActionState,
  formData: FormData
): Promise<PartnerActionState & { listingId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Get partner profile
  const { data: partnerProfile } = await supabase
    .from("partner_profiles")
    .select("id, verified, service_types")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!partnerProfile?.verified) {
    return { error: "Your partner account must be approved to create listings." };
  }

  const category = formData.get("category")?.toString();
  const subcategory = formData.get("subcategory")?.toString().trim() || null;
  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;
  const location = formData.get("location")?.toString().trim() || null;
  const priceStr = formData.get("price_from")?.toString();
  const durationStr = formData.get("duration_hours")?.toString() || null;
  const difficulty = formData.get("difficulty")?.toString() || null;

  if (!category) return { error: "Category is required." };
  if (!title) return { error: "Title is required." };
  if (!priceStr) return { error: "Price is required." };

  // Validate subcategory for gear / rental
  if (category === "gear" && !subcategory) {
    return { error: "Subcategory is required for gear listings." };
  }
  if (category === "rental" && !subcategory) {
    return { error: "Subcategory is required for rental listings." };
  }

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) return { error: "Price must be a positive number." };

  const duration = durationStr ? parseFloat(durationStr) : null;

  // Map category to DB enum values
  const VALID_CATEGORIES = ["diving", "snorkeling", "boat_tour", "guided", "rental", "gear", "experience"];
  if (!VALID_CATEGORIES.includes(category)) {
    return { error: "Invalid category." };
  }

  // Check partner is approved for this service type
  const serviceTypes: string[] = (partnerProfile.service_types as string[]) ?? [];
  const categoryToService: Record<string, string> = {
    diving: "experience",
    snorkeling: "experience",
    boat_tour: "experience",
    guided: "experience",
    experience: "experience",
    rental: "rent",
    gear: "sell",
  };
  const requiredService = categoryToService[category];
  if (requiredService && !serviceTypes.includes(requiredService)) {
    return { error: `Your partner account is not approved for "${requiredService}" listings.` };
  }

  // Extract category-specific inventory/capacity settings
  const invStr = formData.get("inventory_count")?.toString();
  const stockStr = formData.get("stock_count")?.toString();
  const capStr = formData.get("max_capacity")?.toString();

  let inventoryCount = 5;
  let stockCount = 10;
  let maxCapacity = 10;

  if (category === "rental") {
    if (invStr) {
      const parsed = parseInt(invStr, 10);
      if (isNaN(parsed) || parsed < 1) return { error: "Rental inventory must be at least 1 unit." };
      inventoryCount = parsed;
    }
  } else if (category === "gear") {
    if (stockStr) {
      const parsed = parseInt(stockStr, 10);
      if (isNaN(parsed) || parsed < 0) return { error: "Gear stock must be a non-negative integer (0 or more)." };
      stockCount = parsed;
    }
  } else {
    if (capStr) {
      const parsed = parseInt(capStr, 10);
      if (isNaN(parsed) || parsed < 1) return { error: "Experience guest capacity must be at least 1." };
      maxCapacity = parsed;
    }
  }

  // Insert listing as 'pending' (requires admin approval)
  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .insert({
      partner_id: partnerProfile.id,
      category,
      subcategory: subcategory || null,
      title,
      description,
      location,
      price_from: price,
      duration_hours: duration,
      difficulty: difficulty || null,
      inventory_count: inventoryCount,
      stock_count: stockCount,
      max_capacity: maxCapacity,
      status: "pending",
    })
    .select("id")
    .single();

  if (listingError) return { error: `Failed to create listing: ${listingError.message}` };

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: "Listing submitted for review.", listingId: listing.id };
}

// ── Upload listing image ──────────────────────────────────────
export async function uploadListingImageAction(
  listingId: string,
  imageFile: File,
  sortOrder?: number
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  // Verify ownership
  const { data: listing } = await supabase
    .from("listings")
    .select("id, partner_id, partner_profiles!inner(user_id)")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) return { error: "Listing not found." };

  // Determine sort_order if not provided
  let targetSortOrder = sortOrder;
  if (typeof targetSortOrder !== "number") {
    const { count } = await supabase
      .from("listing_images")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId);
    targetSortOrder = count ?? 0;
  }

  const ext = imageFile.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${listingId}/${Date.now()}_${targetSortOrder}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, imageFile, { contentType: imageFile.type, upsert: false });

  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: publicUrl } = supabase.storage.from("listing-images").getPublicUrl(path);

  // Save to listing_images table with correct sort_order
  const { error: dbError } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    url: publicUrl.publicUrl,
    alt_text: null,
    sort_order: targetSortOrder,
  });

  if (dbError) return { error: `Image record failed: ${dbError.message}` };

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { url: publicUrl.publicUrl };
}

// ── Delete listing image ──────────────────────────────────────
export async function deleteListingImageAction(
  imageId: string
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  // Fetch the image and verify partner ownership via listing -> partner_profiles
  const { data: imgRow } = await supabase
    .from("listing_images")
    .select("id, url, listing_id, listings!inner(id, partner_id, partner_profiles!inner(user_id))")
    .eq("id", imageId)
    .maybeSingle();

  if (!imgRow) return { error: "Image not found or permission denied." };

  // Delete from storage if possible
  try {
    const url = imgRow.url;
    const marker = "/listing-images/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const storagePath = decodeURIComponent(url.substring(idx + marker.length).split("?")[0]);
      await supabase.storage.from("listing-images").remove([storagePath]);
    }
  } catch (storageErr) {
    console.warn("Could not delete from storage bucket:", storageErr);
  }

  // Delete from listing_images table
  const { error: deleteErr } = await supabase
    .from("listing_images")
    .delete()
    .eq("id", imageId);

  if (deleteErr) return { error: `Failed to delete image: ${deleteErr.message}` };

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: true };
}

// ── Update own listing (partner, non-admin fields only) ────────
export async function updateListingAction(
  _prev: PartnerActionState,
  formData: FormData
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  const listingId = formData.get("listing_id")?.toString();
  if (!listingId) return { error: "Listing ID missing." };

  const title = formData.get("title")?.toString().trim();
  const description = formData.get("description")?.toString().trim() || null;
  const location = formData.get("location")?.toString().trim() || null;
  const priceStr = formData.get("price_from")?.toString();
  const durationStr = formData.get("duration_hours")?.toString() || null;
  const difficulty = formData.get("difficulty")?.toString() || null;
  const subcategory = formData.get("subcategory")?.toString().trim() || null;
  const category = formData.get("category")?.toString().trim() || null;

  if (!title) return { error: "Title is required." };
  if (!priceStr) return { error: "Price is required." };

  const price = parseFloat(priceStr);
  if (isNaN(price) || price < 0) return { error: "Price must be a positive number." };

  const updateData: Record<string, unknown> = {
    title,
    description,
    location,
    price_from: price,
    duration_hours: durationStr ? parseFloat(durationStr) : null,
    difficulty: difficulty || null,
    subcategory: subcategory || null,
    updated_at: new Date().toISOString(),
  };

  if (category) {
    updateData.category = category;
  }

  // Handle category-specific stock / inventory / capacity
  if (category === "rental" || (!category && formData.has("inventory_count"))) {
    const invStr = formData.get("inventory_count")?.toString();
    if (invStr) {
      const newInv = parseInt(invStr, 10);
      if (isNaN(newInv) || newInv < 1) {
        return { error: "Rental inventory must be at least 1 unit." };
      }
      // Use database RPC to guarantee inventory cannot be reduced below committed overlapping bookings
      const { data: invRes, error: invErr } = await supabase.rpc("update_rental_inventory", {
        p_listing_id: listingId,
        p_inventory_count: newInv,
      });
      if (invErr || (invRes && !invRes.success)) {
        return { error: invErr?.message || invRes?.error || "Cannot reduce inventory below committed bookings." };
      }
    }
  }

  if (category === "gear" || (!category && formData.has("stock_count"))) {
    const stockStr = formData.get("stock_count")?.toString();
    if (stockStr) {
      const newStock = parseInt(stockStr, 10);
      if (isNaN(newStock) || newStock < 0) {
        return { error: "Gear stock must be a non-negative integer (0 or more)." };
      }
      updateData.stock_count = newStock;
    }
  }

  if (formData.has("max_capacity")) {
    const capStr = formData.get("max_capacity")?.toString();
    if (capStr) {
      const newCap = parseInt(capStr, 10);
      if (isNaN(newCap) || newCap < 1) {
        return { error: "Guest capacity must be at least 1." };
      }
      updateData.max_capacity = newCap;
    }
  }

  // RLS enforces ownership — this will fail if user doesn't own listing
  const { error } = await supabase
    .from("listings")
    .update(updateData)
    .eq("id", listingId);

  if (error) return { error: `Update failed: ${error.message}` };

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: "Listing updated successfully." };
}

// ── Experience Departure Session Server Actions ───────────────

export async function createExperienceSessionAction(
  listingId: string,
  departureTime: string,
  maxCapacity: number,
  label?: string
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  if (!listingId || !departureTime || !maxCapacity || maxCapacity < 1) {
    return { error: "Invalid departure session details. Time and positive capacity required." };
  }

  const { error } = await supabase.from("experience_sessions").insert({
    listing_id: listingId,
    departure_time: departureTime.trim(),
    max_capacity: maxCapacity,
    label: label?.trim() || null,
    status: "active",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A departure time slot with this time already exists for this experience." };
    }
    return { error: `Failed to create departure time: ${error.message}` };
  }

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  return { success: "Departure time slot added." };
}

export async function updateExperienceSessionAction(
  sessionId: string,
  maxCapacity: number,
  status: "active" | "inactive" = "active"
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Call atomic RPC that prevents reducing capacity below committed guests on upcoming dates
  const { data, error } = await supabase.rpc("update_experience_session", {
    p_session_id: sessionId,
    p_max_capacity: maxCapacity,
    p_status: status,
  });

  if (error || (data && !data.success)) {
    return { error: error?.message || data?.error || "Failed to update departure session." };
  }

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  return { success: "Departure time slot updated." };
}

export async function deleteExperienceSessionAction(
  sessionId: string
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Call atomic RPC that prevents deleting a session if upcoming confirmed bookings exist,
  // and archives it as inactive if historical bookings exist.
  const { data, error } = await supabase.rpc("delete_experience_session", {
    p_session_id: sessionId,
  });

  const res = data as { success: boolean; error?: string; archived?: boolean; message?: string } | null;

  if (error || (res && !res.success)) {
    return { error: error?.message || res?.error || "Failed to remove departure session." };
  }

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  return {
    success: res?.archived
      ? "Session has historical bookings and was safely archived as inactive."
      : "Departure time slot removed.",
  };
}

// ── Delete a listing (partner only) ───────────────────────────
export async function deleteListingAction(
  listingId: string
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Verify ownership via partner profile
  const { data: partnerProfile } = await supabase
    .from("partner_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!partnerProfile) {
    return { error: "Partner profile not found." };
  }

  const { data: listing, error: fetchErr } = await supabase
    .from("listings")
    .select("id, partner_id")
    .eq("id", listingId)
    .eq("partner_id", partnerProfile.id)
    .maybeSingle();

  if (fetchErr || !listing) {
    return { error: "Listing not found or access denied." };
  }

  // Check if listing has any historical orders, bookings, or sessions
  const [
    { count: rentalCount },
    { count: expCount },
    { count: orderCount },
    { count: sessionCount }
  ] = await Promise.all([
    supabase.from("rental_bookings").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
    supabase.from("experience_bookings").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
    supabase.from("order_items").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
    supabase.from("experience_sessions").select("id", { count: "exact", head: true }).eq("listing_id", listingId),
  ]);

  const hasHistory = (rentalCount ?? 0) > 0 || (expCount ?? 0) > 0 || (orderCount ?? 0) > 0;

  if (hasHistory) {
    // Inactivate any sessions linked to this listing
    if ((sessionCount ?? 0) > 0) {
      await supabase
        .from("experience_sessions")
        .update({ status: "inactive" })
        .eq("listing_id", listingId);
    }

    // Cannot hard-delete due to foreign-key integrity; archive instead
    const { error: archiveErr } = await supabase
      .from("listings")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", listingId)
      .eq("partner_id", partnerProfile.id);

    if (archiveErr) return { error: `Failed to archive listing: ${archiveErr.message}` };

    revalidatePath("/partner/dashboard");
    revalidatePath("/explore");
    revalidatePath("/gear");
    revalidatePath("/rentals");
    return { success: "Listing has customer booking history and has been safely archived instead of deleted." };
  }

  // Delete unused sessions if any before removing listing (since sessions foreign key is RESTRICT)
  if ((sessionCount ?? 0) > 0) {
    await supabase
      .from("experience_sessions")
      .delete()
      .eq("listing_id", listingId);
  }

  // Delete associated images in storage if any
  const { data: images } = await supabase
    .from("listing_images")
    .select("url")
    .eq("listing_id", listingId);

  if (images && images.length > 0) {
    const paths: string[] = [];
    for (const img of images) {
      try {
        const parts = img.url.split("/listing-images/");
        if (parts[1]) paths.push(decodeURIComponent(parts[1]));
      } catch {
        // ignore url parsing error
      }
    }
    if (paths.length > 0) {
      await supabase.storage.from("listing-images").remove(paths);
    }
  }

  // Delete from listings table (cascade deletes listing_images)
  const { error: deleteErr } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("partner_id", partnerProfile.id);

  if (deleteErr) {
    // If foreign key constraint prevents deletion, fallback to archiving listing and inactivating sessions
    if (deleteErr.code === "23503") {
      await supabase
        .from("experience_sessions")
        .update({ status: "inactive" })
        .eq("listing_id", listingId);

      await supabase
        .from("listings")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", listingId)
        .eq("partner_id", partnerProfile.id);

      revalidatePath("/partner/dashboard");
      return { success: "Listing has associated records and has been safely archived." };
    }
    return { error: `Failed to delete listing: ${deleteErr.message}` };
  }

  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: "Listing deleted successfully." };
}

// ── Resubmit rejected listing ─────────────────────────────────
export async function resubmitListingAction(
  listingId: string
): Promise<PartnerActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  // Verify ownership & rejected status via RLS
  const { error } = await supabase
    .from("listings")
    .update({ status: "pending", reviewer_note: null, reviewer_id: null, reviewed_at: null })
    .eq("id", listingId)
    .eq("status", "rejected");

  // Note: RLS "Partners update own listings" allows status changes only if partner owns it,
  // but doesn't block setting admin fields. The migration locks admin fields via a separate approach.
  // For demo, we rely on RLS ownership check + explicit status filter.

  if (error) return { error: `Resubmission failed: ${error.message}` };

  revalidatePath("/partner/dashboard");
  return { success: "Listing resubmitted for review." };
}
