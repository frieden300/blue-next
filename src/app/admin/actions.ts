"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface AdminActionState {
  error?: string | null;
  success?: string | null;
}

// ── Helper: verify caller is admin ───────────────────────────
async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) return { error: "Access denied. Admin role required." };
  return { userId: user.id };
}

// ── Approve a partner application ────────────────────────────
export async function approveApplicationAction(
  applicationId: string
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const supabase = await createClient();

  // Fetch the application
  const { data: app, error: fetchErr } = await supabase
    .from("partner_applications")
    .select("id, user_id, business_name, description, location, services")
    .eq("id", applicationId)
    .single();

  if (fetchErr || !app) return { error: "Application not found." };

  // 1. Update application status
  const { error: appUpdateErr } = await supabase
    .from("partner_applications")
    .update({
      status: "approved",
      reviewer_id: check.userId,
      reviewer_note: null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (appUpdateErr) return { error: `Failed to update application: ${appUpdateErr.message}` };

  // 2. Upsert partner profile
  const serviceTypes: string[] = Array.isArray(app.services) ? app.services : [];
  const { error: profileErr } = await supabase.from("partner_profiles").upsert(
    {
      user_id: app.user_id,
      business_name: app.business_name,
      description: app.description,
      location: app.location,
      verified: true,
      service_types: serviceTypes,
    },
    { onConflict: "user_id" }
  );

  if (profileErr) return { error: `Failed to create partner profile: ${profileErr.message}` };

  // 3. Grant partner role (idempotent via ON CONFLICT)
  const { error: roleErr } = await supabase.from("user_roles").insert({
    user_id: app.user_id,
    role: "partner",
    granted_by: check.userId,
  });

  // Ignore conflict (role already exists)
  if (roleErr && !roleErr.message.includes("duplicate")) {
    return { error: `Failed to grant partner role: ${roleErr.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/partner/dashboard");
  revalidatePath("/partner/apply");
  return { success: "Application approved. Partner account created." };
}

// ── Reject a partner application ─────────────────────────────
export async function rejectApplicationAction(
  applicationId: string,
  reason: string
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  if (!reason.trim()) return { error: "A rejection reason is required." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("partner_applications")
    .update({
      status: "rejected",
      reviewer_id: check.userId,
      reviewer_note: reason.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) return { error: `Failed to reject application: ${error.message}` };

  revalidatePath("/admin");
  return { success: "Application rejected." };
}

// ── Approve a pending listing ─────────────────────────────────
export async function approveListingAction(
  listingId: string
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({
      status: "active",
      reviewer_id: check.userId,
      reviewer_note: null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", listingId);

  if (error) return { error: `Failed to approve listing: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: "Listing approved and published." };
}

// ── Reject a listing ─────────────────────────────────────────
export async function rejectListingAction(
  listingId: string,
  reason: string
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  if (!reason.trim()) return { error: "A rejection reason is required." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({
      status: "rejected",
      reviewer_id: check.userId,
      reviewer_note: reason.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", listingId);

  if (error) return { error: `Failed to reject listing: ${error.message}` };

  revalidatePath("/admin");
  return { success: "Listing rejected." };
}

// ── Pause / reactivate a listing ─────────────────────────────
export async function setListingStatusAction(
  listingId: string,
  newStatus: "paused" | "active"
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", listingId);

  if (error) return { error: `Failed to update listing: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");
  return { success: `Listing ${newStatus === "paused" ? "paused" : "reactivated"}.` };
}

// ── Revoke / Remove an approved partner ────────────────────────
export async function revokePartnerAction(
  userId: string,
  applicationId?: string
): Promise<AdminActionState> {
  const check = await requireAdmin();
  if ("error" in check) return check;

  const supabase = await createClient();

  // 1. Find partner profile
  const { data: profile } = await supabase
    .from("partner_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) {
    // 1a. Inactivate experience sessions for partner listings to prevent new bookings while preserving history
    const { data: partnerListings } = await supabase
      .from("listings")
      .select("id")
      .eq("partner_id", profile.id);

    const listingIds = partnerListings?.map((l) => l.id) ?? [];
    if (listingIds.length > 0) {
      await supabase
        .from("experience_sessions")
        .update({ status: "inactive" })
        .in("listing_id", listingIds);
    }

    // 1b. Archive partner listings so they are hidden from public discovery while preserving historical records
    await supabase
      .from("listings")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("partner_id", profile.id);

    // 1c. Deactivate partner profile (preserves historical references for past bookings and customer receipts)
    const { error: unverifyErr } = await supabase
      .from("partner_profiles")
      .update({ verified: false })
      .eq("id", profile.id);

    if (unverifyErr) {
      return { error: `Failed to deactivate partner profile: ${unverifyErr.message}` };
    }
  }

  // 2. Remove 'partner' role
  const { error: delRoleErr } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", "partner");

  if (delRoleErr) {
    return { error: `Failed to revoke partner role: ${delRoleErr.message}` };
  }

  // 3. Update application status to rejected
  const appQuery = supabase
    .from("partner_applications")
    .update({
      status: "rejected",
      reviewer_id: check.userId,
      reviewer_note: "Partner access revoked by Admin",
      reviewed_at: new Date().toISOString(),
    });

  if (applicationId) {
    await appQuery.eq("id", applicationId);
  } else {
    await appQuery.eq("user_id", userId);
  }

  revalidatePath("/admin");
  revalidatePath("/partner/dashboard");
  revalidatePath("/explore");
  revalidatePath("/gear");
  revalidatePath("/rentals");

  return { success: "Partner access revoked successfully." };
}
