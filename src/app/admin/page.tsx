import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import "./admin.css";

export const metadata = {
  title: "Admin Dashboard — BLUE",
  description: "Manage partner applications and listing moderation for the Blue marketplace.",
};

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className="admin-main">
        <Suspense fallback={<AdminLoading />}>
          <AdminContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function AdminLoading() {
  return (
    <div className="admin-page">
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Loading admin dashboard…</p>
    </div>
  );
}

async function AdminContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="admin-main">
        <div className="admin-denied">
          <div className="admin-denied-icon" aria-hidden="true">🔒</div>
          <h1 className="admin-denied-title">Access Restricted</h1>
          <p className="admin-denied-sub">Sign in with an admin account to access the dashboard.</p>
          <Link href="/account/login" className="pf-submit-btn" style={{ marginTop: "16px", display: "inline-block" }}>
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  // Concurrently verify admin role and fetch applications, partner stats, and listings for moderation
  const [adminRoleRes, applicationsRes, approvedPartnersRes, listingsRes] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("partner_applications")
      .select("id, user_id, business_name, contact_email, location, description, services, status, reviewer_note, submitted_at, reviewed_at")
      .order("submitted_at", { ascending: false })
      .limit(50),
    supabase
      .from("partner_profiles")
      .select("id", { count: "exact", head: true })
      .eq("verified", true),
    supabase
      .from("listings")
      .select(`
        id, category, subcategory, title, description, location, price_from,
        status, reviewer_note, created_at,
        partner_profiles:partner_id ( business_name, user_id ),
        listing_images ( id, url, alt_text, sort_order )
      `)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const adminRole = adminRoleRes.data;

  if (!adminRole) {
    return (
      <div className="admin-main">
        <div className="admin-denied">
          <div className="admin-denied-icon" aria-hidden="true">⛔</div>
          <h1 className="admin-denied-title">Access Denied</h1>
          <p className="admin-denied-sub">
            You do not have admin privileges. Contact a system administrator to request access.
          </p>
          <Link href="/account" className="pf-submit-btn" style={{ marginTop: "16px", display: "inline-block" }}>
            Return to Account
          </Link>
        </div>
      </div>
    );
  }

  const applications = applicationsRes.data;
  const approvedPartnersCount = approvedPartnersRes.count;
  const listings = listingsRes.data;

  // Compute stats
  const pendingApps = (applications ?? []).filter((a) => a.status === "pending").length;
  const pendingListings = (listings ?? []).filter((l) => l.status === "pending").length;
  const activeListings = (listings ?? []).filter((l) => l.status === "active").length;

  return (
    <AdminDashboardClient
      applications={applications ?? []}
      listings={(listings ?? []) as unknown as Parameters<typeof AdminDashboardClient>[0]['listings']}
      stats={{
        pendingApps,
        approvedPartners: approvedPartnersCount ?? 0,
        pendingListings,
        activeListings,
      }}
    />
  );
}
