import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import UpdateProfileForm from "@/components/account/UpdateProfileForm";
import ChangePasswordCard from "@/components/account/ChangePasswordCard";
import { logoutAction } from "@/app/account/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import "./account.css";

export const metadata = {
  title: "Account — BLUE",
  description: "Manage your Project Blue profile, bookings, and expedition equipment.",
};

interface ProfileData {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRoleData {
  role: string;
}

export default function AccountPage() {
  return (
    <>
      <SiteHeader />
      <main className="account-main">
        <Suspense fallback={<AccountLoadingFallback />}>
          <AccountContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function AccountLoadingFallback() {
  return (
    <div className="account-dashboard" style={{ alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
      <div className="gateway-icon" style={{ animation: "gatewayFloat 2s ease-in-out infinite" }}>
        ⚓
      </div>
      <p style={{ color: "var(--muted)", fontSize: "14px" }}>Loading expedition account...</p>
    </div>
  );
}

async function AccountContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If unauthenticated, show polished guest gateway with sign-in prompt
  if (!user) {
    return (
      <div className="account-gateway">
        <div className="gateway-icon" aria-hidden="true">⚓</div>
        <h1 className="gateway-heading">
          Your Expedition <em>Account</em>
        </h1>
        <p className="gateway-sub">
          Sign in to manage your ocean journeys, view active bookings, rent expedition-grade
          diving equipment, or apply as an authorized operator.
        </p>

        <div className="gateway-btn-group">
          <Link href="/account/login" className="gateway-btn-primary">
            Sign In &rarr;
          </Link>
          <Link href="/account/signup" className="gateway-btn-secondary">
            Create Account
          </Link>
        </div>
      </div>
    );
  }

  // Authenticated state: Fetch profile, roles, partner profile, and recent application concurrently
  const [profileRes, rolesRes, partnerProfileRes, appRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
    supabase
      .from("partner_profiles")
      .select("id, verified, service_types")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("partner_applications")
      .select("status")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const rolesData = rolesRes.data;
  const partnerProfile = partnerProfileRes.data;
  const app = appRes.data;

  const roles = (rolesData as UserRoleData[] | null)?.map((r) => r.role) || ["customer"];
  const isAdmin = roles.includes("admin");
  const isPartner = roles.includes("partner") || Boolean(partnerProfile?.verified);

  const primaryRole = isAdmin
    ? "admin"
    : isPartner
    ? "partner"
    : "customer";

  const applicationStatus = !isPartner ? (app?.status ?? null) : null;

  const typedProfile = profile as ProfileData | null;
  const currentDisplayName =
    typedProfile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Diver";

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const initials = currentDisplayName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "B";

  return (
    <div className="account-dashboard">
      {/* Profile Overview Card */}
          <div className="profile-card">
            <div className="profile-identity">
              <div className="profile-avatar-circle" aria-hidden="true">
                {initials}
              </div>

              <div className="profile-details">
                <div className="profile-name-row">
                  <h1 className="profile-name">{currentDisplayName}</h1>
                  <span className={`role-badge role-${primaryRole}`}>
                    {primaryRole}
                  </span>
                </div>
                <p className="profile-email">{user.email}</p>
                <p className="profile-joined">Expedition Member since {memberSince}</p>
              </div>
            </div>

            <div className="profile-actions">
              <form action={logoutAction}>
                <button type="submit" className="btn-logout">
                  <span aria-hidden="true">↪</span> Sign Out
                </button>
              </form>
            </div>
          </div>

          {/* Two-Column Section: Edit Profile + Shortcuts */}
          <div className="account-columns">
            {/* Column 1: Profile Settings & Security */}
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              <section className="account-section-card" aria-labelledby="settings-heading">
                <div>
                  <h2 id="settings-heading" className="section-card-title">
                    Profile Settings
                  </h2>
                  <p className="section-card-sub">
                    Update your public display name shown across bookings and reviews.
                  </p>
                </div>

                <UpdateProfileForm initialDisplayName={currentDisplayName} />
              </section>

              <ChangePasswordCard email={user.email ?? ""} />
            </div>

            {/* Column 2: Navigation & Quick Links */}
            <section className="account-section-card" aria-labelledby="shortcuts-heading">
              <div>
                <h2 id="shortcuts-heading" className="section-card-title">
                  Expedition Portal
                </h2>
                <p className="section-card-sub">
                  Quick access to your planned trips, rental equipment, and partner tools.
                </p>
              </div>

              <div className="account-links-grid">
                <Link href="/bookings" className="account-link-item">
                  <div className="link-item-left">
                    <span className="link-item-icon" aria-hidden="true">🎟️</span>
                    <div>
                      <p className="link-item-title">My Bookings</p>
                      <p className="link-item-desc">View your upcoming diving & boat trips</p>
                    </div>
                  </div>
                  <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                </Link>

                <Link href="/rentals" className="account-link-item">
                  <div className="link-item-left">
                    <span className="link-item-icon" aria-hidden="true">⚓</span>
                    <div>
                      <p className="link-item-title">Equipment Rentals</p>
                      <p className="link-item-desc">Rent dive kits, tanks, and underwater cameras</p>
                    </div>
                  </div>
                  <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                </Link>

                <Link href="/gear" className="account-link-item">
                  <div className="link-item-left">
                    <span className="link-item-icon" aria-hidden="true">🤿</span>
                    <div>
                      <p className="link-item-title">Gear Marketplace</p>
                      <p className="link-item-desc">Purchase expedition-grade diving equipment</p>
                    </div>
                  </div>
                  <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                </Link>

                {/* ── Admin Dashboard (admins only) ── */}
                {isAdmin && (
                  <Link href="/admin" className="account-link-item">
                    <div className="link-item-left">
                      <span className="link-item-icon" aria-hidden="true">🛡️</span>
                      <div>
                        <p className="link-item-title">Admin Dashboard</p>
                        <p className="link-item-desc">Review applications and moderate listings</p>
                      </div>
                    </div>
                    <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                )}

                {/* ── Partner Dashboard or Apply link ── */}
                {isPartner ? (
                  <Link href="/partner/dashboard" className="account-link-item">
                    <div className="link-item-left">
                      <span className="link-item-icon" aria-hidden="true">🤝</span>
                      <div>
                        <p className="link-item-title">Partner Dashboard</p>
                        <p className="link-item-desc">Manage your operator listings and bookings</p>
                      </div>
                    </div>
                    <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                ) : (
                  <Link href="/partner/apply" className="account-link-item">
                    <div className="link-item-left">
                      <span className="link-item-icon" aria-hidden="true">🤝</span>
                      <div>
                        <p className="link-item-title">
                          {applicationStatus === "pending"
                            ? "Application Pending"
                            : applicationStatus === "rejected"
                            ? "Application Rejected — Resubmit"
                            : "Become a Partner"}
                        </p>
                        <p className="link-item-desc">
                          {applicationStatus === "pending"
                            ? "Your application is under review"
                            : applicationStatus === "rejected"
                            ? "View reason and resubmit your application"
                            : "Apply to list marine tours and diving gear"}
                        </p>
                      </div>
                    </div>
                    <span className="link-item-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                )}
              </div>
            </section>
          </div>
        </div>
  );
}
