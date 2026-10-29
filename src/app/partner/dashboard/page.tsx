import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PartnerDashboardClient from "@/components/partner/PartnerDashboardClient";
import "../partner.css";

export const metadata = {
  title: "Partner Dashboard — BLUE",
  description: "Manage your Blue partner listings, applications, and account.",
};

export default function PartnerDashboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="partner-main">
        <Suspense fallback={<DashLoadingFallback />}>
          <DashboardContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function DashLoadingFallback() {
  return (
    <div className="pdash-page">
      <p className="partner-kicker">PARTNER DASHBOARD</p>
      <h1 className="partner-heading"><em>Loading</em> dashboard…</h1>
    </div>
  );
}

async function DashboardContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="partner-main">
        <div className="partner-gateway">
          <div className="partner-gateway-icon" aria-hidden="true">🌊</div>
          <h1 className="partner-heading">Partner <em>Dashboard</em></h1>
          <p className="partner-sub">You must be signed in to access the partner dashboard.</p>
          <Link href="/account/login" className="pf-submit-btn" style={{ marginTop: "24px", display: "inline-block" }}>
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  // Concurrently fetch partner profile, application, and listings
  const [partnerProfileRes, applicationRes, listingsRes] = await Promise.all([
    supabase
      .from("partner_profiles")
      .select("id, business_name, description, location, verified, service_types")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("partner_applications")
      .select("id, status, submitted_at")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("listings")
      .select(`
        id, category, subcategory, title, description, location, price_from,
        duration_hours, difficulty, status, reviewer_note, created_at, updated_at,
        inventory_count, stock_count, max_capacity,
        partner_profiles!inner(user_id),
        listing_images ( id, url, alt_text, sort_order ),
        experience_sessions ( id, departure_time, max_capacity, label, status )
      `)
      .eq("partner_profiles.user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const partnerProfile = partnerProfileRes.data;
  const application = applicationRes.data;

  if (!partnerProfile?.verified) {
    return (
      <div className="pdash-page">
        <div className="partner-gateway-icon" aria-hidden="true" style={{ fontSize: "48px", textAlign: "center" }}>🤝</div>
        <div style={{ textAlign: "center" }}>
          <h1 className="partner-heading">Partner <em>Dashboard</em></h1>
          <p className="partner-sub">
            {application?.status === "pending"
              ? "Your partner application is under review. Once approved, you'll have access to the dashboard."
              : "You don't have an active partner account. Apply to become a partner to list your services."}
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "28px", flexWrap: "wrap" }}>
            <Link
              href="/partner/apply"
              className="pf-submit-btn"
            >
              {application?.status === "pending" ? "View Application →" : "Apply as Partner →"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const listings = listingsRes.data;

  const serviceTypes: string[] = Array.isArray(partnerProfile.service_types)
    ? (partnerProfile.service_types as string[])
    : [];

  return (
    <PartnerDashboardClient
      partnerProfile={{
        id: partnerProfile.id,
        business_name: partnerProfile.business_name,
        location: partnerProfile.location,
        service_types: serviceTypes,
      }}
      listings={listings ?? []}
    />
  );
}
