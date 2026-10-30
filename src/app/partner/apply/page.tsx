import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PartnerApplyForm from "@/components/forms/PartnerApplyForm";
import "../partner.css";

export const metadata = {
  title: "Partner Application — BLUE",
  description: "Apply to become a Blue partner and list marine experiences, gear, or rental equipment.",
};

export default function PartnerApplyPage() {
  return (
    <>
      <SiteHeader />
      <main className="partner-main">
        <Suspense fallback={<ApplyLoading />}>
          <ApplyContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function ApplyLoading() {
  return (
    <div className="partner-page">
      <div className="partner-hero">
        <p className="partner-kicker">BLUE MARKETPLACE</p>
        <h1 className="partner-heading">Become a <em>Partner</em></h1>
      </div>
    </div>
  );
}

async function ApplyContent() {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="partner-main">
        <div className="partner-gateway">
          <div className="partner-gateway-icon" aria-hidden="true">🤝</div>
          <h1 className="partner-heading">Become a <em>Partner</em></h1>
          <p className="partner-sub">
            Sign in with your Blue account to apply as a marine operator, gear seller,
            or equipment rental provider.
          </p>
          <div style={{ display: "flex", gap: "12px", marginTop: "28px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/account/login" className="pf-submit-btn">Sign In →</Link>
            <Link href="/account/signup" style={{ padding: "13px 24px", border: "1px solid var(--border)", borderRadius: "999px", color: "var(--muted)", fontSize: "14px", fontWeight: "500" }}>Create Account</Link>
          </div>
        </div>
      </div>
    );
  }

  // Concurrently fetch existing application and partner profile
  const [applicationRes, partnerProfileRes] = await Promise.all([
    supabase
      .from("partner_applications")
      .select("id, business_name, contact_email, location, description, status, reviewer_note, submitted_at, services")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("partner_profiles")
      .select("id, business_name, description, location, verified, service_types")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const application = applicationRes.data;
  const partnerProfile = partnerProfileRes.data;

  const currentServices: string[] = (partnerProfile?.service_types as string[] | undefined) ?? [];
  const allServices = ["experience", "sell", "rent"];
  const hasAllServices = Boolean(
    partnerProfile?.verified && allServices.every((s) => currentServices.includes(s))
  );
  const isPendingUpgrade = Boolean(partnerProfile?.verified && application?.status === "pending");

  return (
    <div className="partner-page">
      <div className="partner-hero">
        <p className="partner-kicker">BLUE MARKETPLACE</p>
        <h1 className="partner-heading">Become a <em>Partner</em></h1>
        <p className="partner-sub">
          Join Blue&apos;s network of certified marine operators, gear sellers, and rental providers.
          Submit your application to get started.
        </p>
      </div>

      {/* Case 1: Approved partner with all 3 services */}
      {partnerProfile?.verified && hasAllServices && (
        <div className="partner-status-card status-approved">
          <div className="partner-status-badge badge-approved">✓ Approved Partner — All Services Active</div>
          <p className="partner-status-title">{partnerProfile.business_name}</p>
          <p className="partner-status-sub">
            Your partner account is active across all service categories (Experiences, Gear, and Rentals). Visit your dashboard to manage your listings.
          </p>
          <Link
            href="/partner/dashboard"
            className="pf-submit-btn"
            style={{ alignSelf: "flex-start", marginTop: "8px" }}
          >
            Go to Dashboard →
          </Link>
        </div>
      )}

      {/* Case 2: Approved partner with fewer than 3 services */}
      {partnerProfile?.verified && !hasAllServices && (
        <>
          <div className="partner-status-card status-approved">
            <div className="partner-status-badge badge-approved">✓ Approved Partner</div>
            <p className="partner-status-title">{partnerProfile.business_name}</p>
            <p className="partner-status-sub">
              Your partner account is active. Active services:{" "}
              <strong style={{ color: "#38bdf8" }}>
                {currentServices.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") || "None"}
              </strong>
            </p>
            <Link
              href="/partner/dashboard"
              className="pf-submit-btn"
              style={{ alignSelf: "flex-start", marginTop: "8px" }}
            >
              Go to Dashboard →
            </Link>
          </div>

          {isPendingUpgrade ? (
            <div className="partner-status-card status-pending" style={{ marginTop: "24px" }}>
              <div className="partner-status-badge badge-pending">⏳ Upgrade Pending Review</div>
              <p className="partner-status-title">Service Upgrade Request Pending Admin Review</p>
              <p className="partner-status-sub">
                Your request to expand your partner services is currently being reviewed by our team. You can continue managing your active services in the dashboard while you wait.
              </p>
              <Link
                href="/partner/dashboard"
                className="pf-submit-btn"
                style={{ alignSelf: "flex-start", marginTop: "8px" }}
              >
                Go to Dashboard →
              </Link>
            </div>
          ) : (
            <div className="partner-form-card" style={{ marginTop: "32px" }}>
              <h2>Expand Your Partner Services</h2>
              <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "20px" }}>
                Select additional services you would like to offer on BLUE. Your existing approved services are preserved.
              </p>
              <PartnerApplyForm
                isUpgrade={true}
                existingServices={currentServices}
                defaultValues={{
                  business_name: partnerProfile.business_name ?? application?.business_name ?? "",
                  contact_email: application?.contact_email ?? user.email ?? "",
                  location: partnerProfile.location ?? application?.location ?? "",
                  description: partnerProfile.description ?? application?.description ?? "",
                  services: currentServices,
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Case 3: Non-verified user with pending application */}
      {!partnerProfile?.verified && application?.status === "pending" && (
        <div className="partner-status-card status-pending">
          <div className="partner-status-badge badge-pending">⏳ Under Review</div>
          <p className="partner-status-title">Application submitted</p>
          <p className="partner-status-sub">
            Your application for <strong>{application.business_name}</strong> is being reviewed by
            our team. We will update your account status once a decision is made.
          </p>
        </div>
      )}

      {/* Case 4: Non-verified user with rejected application */}
      {!partnerProfile?.verified && application?.status === "rejected" && (
        <div className="partner-status-card status-rejected">
          <div className="partner-status-badge badge-rejected">✗ Not Approved</div>
          <p className="partner-status-title">Application not approved</p>
          {application.reviewer_note && (
            <div className="rejection-reason-box">
              <strong>Reason:</strong> {application.reviewer_note}
            </div>
          )}
          <p className="partner-status-sub">
            You can correct the details below and resubmit your application.
          </p>
        </div>
      )}

      {/* Case 5: New applicant or rejected applicant resubmitting */}
      {(!application || application.status === "rejected") && !partnerProfile?.verified && (
        <div className="partner-form-card">
          <h2>Application Details</h2>
          <PartnerApplyForm
            defaultValues={
              application?.status === "rejected"
                ? {
                    business_name: application.business_name,
                    contact_email: application.contact_email ?? "",
                    location: application.location ?? "",
                    description: application.description ?? "",
                    services: application.services as string[] | null,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
