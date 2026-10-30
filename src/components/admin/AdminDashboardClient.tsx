"use client";

import { useState, useTransition } from "react";
import {
  approveApplicationAction,
  rejectApplicationAction,
  approveListingAction,
  rejectListingAction,
  setListingStatusAction,
  revokePartnerAction,
} from "@/app/admin/actions";
import {
  GEAR_SUBCATEGORIES,
  RENTAL_SUBCATEGORIES,
  SUBCAT_LABEL,
  normalizeSubcategory,
} from "@/lib/constants/marketplace";
import type { ListingImage } from "@/types/marketplace";
import { sortListingImages } from "@/lib/utils/images";

interface Application {
  id: string;
  user_id: string;
  business_name: string;
  contact_email: string;
  location: string | null;
  description: string;
  services: string[] | null;
  status: string;
  reviewer_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

function AdminListingCardMedia({
  images,
  title,
}: {
  images?: ListingImage[];
  title: string;
}) {
  const sorted = sortListingImages(images);
  const [idx, setIdx] = useState(0);
  const current = sorted[idx] ?? sorted[0];

  if (!current) {
    return <div className="admin-listing-thumb-ph" aria-hidden="true">🌊</div>;
  }

  return (
    <div
      style={{
        position: "relative",
        width: "120px",
        flexShrink: 0,
        minHeight: "120px",
        background: "#020a11",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt_text || title}
        className="admin-listing-thumb"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {sorted.length > 1 && (
        <>
          <div
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              background: "rgba(2, 10, 17, 0.8)",
              backdropFilter: "blur(4px)",
              color: "#82d9ed",
              fontSize: "9px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "999px",
              border: "1px solid rgba(130, 217, 237, 0.3)",
              zIndex: 2,
            }}
          >
            {idx + 1}/{sorted.length}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "4px",
              right: "4px",
              display: "flex",
              gap: "3px",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            {sorted.map((img, i) => (
              <button
                key={img.id || `${img.url}-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
                style={{
                  width: i === idx ? "10px" : "4px",
                  height: "4px",
                  borderRadius: "999px",
                  border: "none",
                  background: i === idx ? "#38bdf8" : "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((prev) => (prev > 0 ? prev - 1 : sorted.length - 1));
            }}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: "4px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            ‹
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((prev) => (prev < sorted.length - 1 ? prev + 1 : 0));
            }}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: "4px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

interface Listing {
  id: string;
  category: string;
  subcategory?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  partner_profiles: { business_name: string; user_id: string } | null;
  listing_images?: ListingImage[];
}

interface Stats {
  pendingApps: number;
  approvedPartners: number;
  pendingListings: number;
  activeListings: number;
}

interface Props {
  applications: Application[];
  listings: Listing[];
  stats: Stats;
}

const CAT_LABEL: Record<string, string> = {
  diving: "Diving",
  snorkeling: "Snorkeling",
  boat_tour: "Boat Tour",
  guided: "Guided",
  rental: "Rental",
  gear: "Gear/Sell",
};

function StatusBadge({ status }: { status: string }) {
  const cls = `admin-status-badge astatus-${status}`;
  return <span className={cls}>{status}</span>;
}

/* ── Application Card ────────────────────────────────────────── */
function AppCard({ app }: { app: Application }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);

  const isPending = app.status === "pending";
  const isApproved = app.status === "approved";
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function handleApprove() {
    if (!confirm(`Approve "${app.business_name}"?`)) return;
    setProcessing(true);
    const result = await approveApplicationAction(app.id);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setMsg({ text: "Please enter a rejection reason.", ok: false });
      return;
    }
    setProcessing(true);
    const result = await rejectApplicationAction(app.id, rejectReason);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
    if (result.success) setShowReject(false);
  }

  async function handleRevoke() {
    setProcessing(true);
    const result = await revokePartnerAction(app.user_id, app.id);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
    setConfirmRevoke(false);
  }

  return (
    <div className="admin-app-card">
      <div className="admin-app-header">
        <div>
          <p className="admin-app-biz">{app.business_name}</p>
          <p className="admin-app-email">{app.contact_email}</p>
          {app.location && <p className="admin-app-email">📍 {app.location}</p>}
          <div className="admin-app-services">
            {(app.services ?? []).map((s) => (
              <span key={s} className="admin-app-svc">{s}</span>
            ))}
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <p className="admin-app-desc">{app.description}</p>

      <p className="admin-app-date">
        Submitted:{" "}
        {new Date(app.submitted_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>

      {app.reviewer_note && (
        <p style={{ fontSize: "12px", color: "#fca5a5" }}>
          Reason: {app.reviewer_note}
        </p>
      )}

      {msg && (
        <p className={`admin-action-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>
      )}

      {isPending && (
        <div className="admin-actions-row">
          <button
            id={`admin-approve-app-${app.id}`}
            className="admin-action-btn admin-action-approve"
            onClick={() => startTransition(() => { void handleApprove(); })}
            disabled={processing}
          >
            ✓ Approve
          </button>
          <button
            id={`admin-reject-app-${app.id}`}
            className="admin-action-btn admin-action-reject"
            onClick={() => setShowReject(!showReject)}
            disabled={processing}
          >
            ✕ Reject
          </button>
        </div>
      )}

      {showReject && isPending && (
        <div className="admin-reject-row">
          <input
            type="text"
            className="admin-reject-input"
            placeholder="Enter reason for rejection…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <button
            className="admin-action-btn admin-action-reject"
            onClick={() => startTransition(() => { void handleReject(); })}
            disabled={processing}
          >
            Confirm Reject
          </button>
        </div>
      )}

      {isApproved && (
        <div className="admin-actions-row" style={{ marginTop: "12px" }}>
          {!confirmRevoke ? (
            <button
              id={`admin-revoke-partner-${app.id}`}
              className="admin-action-btn admin-action-reject"
              style={{
                borderColor: "rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                background: "rgba(239, 68, 68, 0.08)",
              }}
              onClick={() => setConfirmRevoke(true)}
              disabled={processing}
            >
              ⚠️ Revoke Partner
            </button>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#fca5a5" }}>Revoke access?</span>
              <button
                id={`admin-confirm-revoke-${app.id}`}
                className="admin-action-btn admin-action-reject"
                style={{
                  borderColor: "rgba(239, 68, 68, 0.8)",
                  color: "#ffffff",
                  background: "rgba(239, 68, 68, 0.8)",
                }}
                onClick={() => startTransition(() => { void handleRevoke(); })}
                disabled={processing}
              >
                {processing ? "Revoking…" : "Confirm Revoke"}
              </button>
              <button
                type="button"
                className="admin-action-btn"
                style={{ color: "var(--muted)" }}
                onClick={() => setConfirmRevoke(false)}
                disabled={processing}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Listing Card ────────────────────────────────────────────── */
function ListingCard({ listing }: { listing: Listing }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [, startTransition] = useTransition();
  const [processing, setProcessing] = useState(false);

  const isPending = listing.status === "pending";
  const isActive = listing.status === "active";
  const isPaused = listing.status === "paused";

  async function handleApprove() {
    setProcessing(true);
    const result = await approveListingAction(listing.id);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      setMsg({ text: "Please enter a rejection reason.", ok: false });
      return;
    }
    setProcessing(true);
    const result = await rejectListingAction(listing.id, rejectReason);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
    if (result.success) setShowReject(false);
  }

  async function handleStatusChange(status: "paused" | "active") {
    if (!confirm(`${status === "paused" ? "Pause" : "Reactivate"} this listing?`)) return;
    setProcessing(true);
    const result = await setListingStatusAction(listing.id, status);
    setMsg({ text: result.success ?? result.error ?? "Done", ok: !!result.success });
    setProcessing(false);
  }

  return (
    <div className="admin-listing-card">
      <AdminListingCardMedia images={listing.listing_images} title={listing.title} />

      <div className="admin-listing-body">
        <div className="admin-listing-top">
          <h3 className="admin-listing-title">{listing.title}</h3>
          <StatusBadge status={listing.status} />
        </div>

        <div className="admin-listing-meta">
          <span style={{ marginRight: "12px" }}>
            Category: <strong>{CAT_LABEL[listing.category] ?? listing.category}{listing.subcategory ? ` • ${SUBCAT_LABEL[listing.subcategory] ?? listing.subcategory}` : ""}</strong>
          </span>
          {listing.partner_profiles?.business_name && (
            <span style={{ marginRight: "12px" }}>
              Partner: <strong>{listing.partner_profiles.business_name}</strong>
            </span>
          )}
          {listing.location && <span>📍 {listing.location}</span>}
        </div>

        <p className="admin-listing-price">
          ₹{Number(listing.price_from).toLocaleString("en-IN")}
        </p>

        {listing.description && (
          <p className="admin-listing-meta" style={{ WebkitLineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {listing.description}
          </p>
        )}

        {listing.reviewer_note && (
          <p style={{ fontSize: "12px", color: "#fca5a5" }}>
            Note: {listing.reviewer_note}
          </p>
        )}

        {msg && (
          <p className={`admin-action-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>
        )}

        <div className="admin-actions-row">
          {isPending && (
            <>
              <button
                id={`admin-approve-listing-${listing.id}`}
                className="admin-action-btn admin-action-approve"
                onClick={() => startTransition(() => { void handleApprove(); })}
                disabled={processing}
              >
                ✓ Approve
              </button>
              <button
                id={`admin-reject-listing-${listing.id}`}
                className="admin-action-btn admin-action-reject"
                onClick={() => setShowReject(!showReject)}
                disabled={processing}
              >
                ✕ Reject
              </button>
            </>
          )}
          {isActive && (
            <button
              id={`admin-pause-listing-${listing.id}`}
              className="admin-action-btn admin-action-pause"
              onClick={() => startTransition(() => { void handleStatusChange("paused"); })}
              disabled={processing}
            >
              Pause
            </button>
          )}
          {isPaused && (
            <button
              id={`admin-reactivate-listing-${listing.id}`}
              className="admin-action-btn admin-action-reactivate"
              onClick={() => startTransition(() => { void handleStatusChange("active"); })}
              disabled={processing}
            >
              Reactivate
            </button>
          )}
        </div>

        {showReject && isPending && (
          <div className="admin-reject-row">
            <input
              type="text"
              className="admin-reject-input"
              placeholder="Rejection reason…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              className="admin-action-btn admin-action-reject"
              onClick={() => startTransition(() => { void handleReject(); })}
              disabled={processing}
            >
              Confirm Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main client component ───────────────────────────────────── */
export default function AdminDashboardClient({ applications, listings, stats }: Props) {
  const [activeTab, setActiveTab] = useState<"applications" | "listings">("applications");
  const [listingSearch, setListingSearch] = useState("");
  const [listingCatFilter, setListingCatFilter] = useState("all");
  const [listingSubcatFilter, setListingSubcatFilter] = useState("all");
  const [listingStatusFilter, setListingStatusFilter] = useState("all");

  const pendingApps = applications.filter((a) => a.status === "pending");
  const reviewedApps = applications.filter((a) => a.status !== "pending");
  const pendingListings = listings.filter((l) => l.status === "pending");
  const otherListings = listings.filter((l) => l.status !== "pending");

  const filteredOtherListings = otherListings.filter((l) => {
    if (listingStatusFilter !== "all" && l.status !== listingStatusFilter) return false;
    if (listingCatFilter !== "all") {
      if (listingCatFilter === "experience") {
        if (!["diving", "snorkeling", "boat_tour", "guided", "experience"].includes(l.category)) return false;
        if (listingSubcatFilter !== "all" && l.category !== listingSubcatFilter) return false;
      } else if (listingCatFilter === "gear") {
        if (l.category !== "gear") return false;
        if (listingSubcatFilter !== "all" && normalizeSubcategory(l.subcategory) !== listingSubcatFilter) return false;
      } else if (listingCatFilter === "rental") {
        if (l.category !== "rental") return false;
        if (listingSubcatFilter !== "all" && normalizeSubcategory(l.subcategory) !== listingSubcatFilter) return false;
      } else if (l.category !== listingCatFilter) {
        return false;
      }
    }
    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase().trim();
      const titleMatch = l.title?.toLowerCase().includes(q);
      const locMatch = l.location?.toLowerCase().includes(q);
      const bizMatch = l.partner_profiles?.business_name?.toLowerCase().includes(q);
      const subcatMatch = l.subcategory?.toLowerCase().includes(q);
      if (!titleMatch && !locMatch && !bizMatch && !subcatMatch) return false;
    }
    return true;
  });

  const hasActiveFilters =
    listingSearch.trim() !== "" ||
    listingCatFilter !== "all" ||
    listingSubcatFilter !== "all" ||
    listingStatusFilter !== "all";

  return (
    <div className="admin-page">
      {/* Admin banner */}
      <div className="admin-banner">
        <span className="admin-banner-icon" aria-hidden="true">🛡️</span>
        <div>
          <p className="admin-banner-title">Admin Dashboard</p>
          <p className="admin-banner-sub">
            Review partner applications and moderate listings. Actions are applied directly to Supabase.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <p className="admin-stat-label">Pending Applications</p>
          <p className="admin-stat-value">{stats.pendingApps}</p>
          <p className="admin-stat-desc">Awaiting review</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Approved Partners</p>
          <p className="admin-stat-value">{stats.approvedPartners}</p>
          <p className="admin-stat-desc">Active partner accounts</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Pending Listings</p>
          <p className="admin-stat-value">{stats.pendingListings}</p>
          <p className="admin-stat-desc">Awaiting approval</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Active Listings</p>
          <p className="admin-stat-value">{stats.activeListings}</p>
          <p className="admin-stat-desc">Publicly visible</p>
        </div>
      </div>

      {/* Tab row */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
        {(["applications", "listings"] as const).map((tab) => (
          <button
            key={tab}
            id={`admin-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              color: activeTab === tab ? "var(--blue)" : "var(--muted)",
              borderBottom: activeTab === tab ? "2px solid var(--blue)" : "2px solid transparent",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "color 0.2s",
              marginBottom: "-1px",
            }}
          >
            {tab === "applications" ? "Applications" : "Listings"}
            {tab === "applications" && stats.pendingApps > 0 && (
              <span style={{ marginLeft: "8px", padding: "2px 7px", borderRadius: "999px", background: "rgba(234,179,8,0.2)", color: "#fde047", fontSize: "11px", fontWeight: 700 }}>
                {stats.pendingApps}
              </span>
            )}
            {tab === "listings" && stats.pendingListings > 0 && (
              <span style={{ marginLeft: "8px", padding: "2px 7px", borderRadius: "999px", background: "rgba(234,179,8,0.2)", color: "#fde047", fontSize: "11px", fontWeight: 700 }}>
                {stats.pendingListings}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Applications tab */}
      {activeTab === "applications" && (
        <>
          {/* Pending */}
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">Pending Applications</h2>
              <span className="admin-section-count">{pendingApps.length} pending</span>
            </div>
            <div className="admin-app-grid">
              {pendingApps.length === 0 ? (
                <div className="admin-empty">
                  <div className="admin-empty-icon" aria-hidden="true">✓</div>
                  <p style={{ color: "var(--muted)", fontSize: "14px" }}>No pending applications.</p>
                </div>
              ) : (
                pendingApps.map((app) => <AppCard key={app.id} app={app} />)
              )}
            </div>
          </div>

          {/* Previously reviewed */}
          {reviewedApps.length > 0 && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h2 className="admin-section-title">Reviewed Applications</h2>
                <span className="admin-section-count">{reviewedApps.length} total</span>
              </div>
              <div className="admin-app-grid">
                {reviewedApps.map((app) => <AppCard key={app.id} app={app} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Listings tab */}
      {activeTab === "listings" && (
        <>
          {/* Pending listings */}
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">Pending Listings</h2>
              <span className="admin-section-count">{pendingListings.length} pending</span>
            </div>
            <div className="admin-app-grid">
              {pendingListings.length === 0 ? (
                <div className="admin-empty">
                  <div className="admin-empty-icon" aria-hidden="true">✓</div>
                  <p style={{ color: "var(--muted)", fontSize: "14px" }}>No pending listings.</p>
                </div>
              ) : (
                pendingListings.map((l) => <ListingCard key={l.id} listing={l as unknown as Listing} />)
              )}
            </div>
          </div>

          {/* Other listings with filters */}
          <div className="admin-section">
            <div className="admin-section-header" style={{ flexWrap: "wrap", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <h2 className="admin-section-title">All Listings</h2>
                <span className="admin-section-count">
                  Showing {filteredOtherListings.length} of {otherListings.length} listings
                </span>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  id="admin-clear-listing-filters"
                  onClick={() => {
                    setListingSearch("");
                    setListingCatFilter("all");
                    setListingSubcatFilter("all");
                    setListingStatusFilter("all");
                  }}
                  className="admin-action-btn"
                  style={{ fontSize: "12px", color: "var(--blue)", borderColor: "rgba(130,217,237,0.3)" }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Filter controls */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                background: "rgba(5, 24, 36, 0.4)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "16px",
                alignItems: "center",
              }}
            >
              <div>
                <input
                  id="admin-filter-search"
                  type="text"
                  placeholder="Search title, location, partner…"
                  value={listingSearch}
                  onChange={(e) => setListingSearch(e.target.value)}
                  className="admin-reject-input"
                  style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px" }}
                />
              </div>

              <div>
                <select
                  id="admin-filter-category"
                  value={listingCatFilter}
                  onChange={(e) => {
                    setListingCatFilter(e.target.value);
                    setListingSubcatFilter("all");
                  }}
                  className="admin-reject-input"
                  style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px", cursor: "pointer" }}
                >
                  <option value="all">All Listing Types</option>
                  <option value="experience">Experiences</option>
                  <option value="gear">Gear / Products</option>
                  <option value="rental">Equipment Rentals</option>
                </select>
              </div>

              {listingCatFilter === "experience" && (
                <div>
                  <select
                    id="admin-filter-subcategory"
                    value={listingSubcatFilter}
                    onChange={(e) => setListingSubcatFilter(e.target.value)}
                    className="admin-reject-input"
                    style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px", cursor: "pointer" }}
                  >
                    <option value="all">All Experience Types</option>
                    <option value="diving">Scuba Diving</option>
                    <option value="snorkeling">Snorkeling</option>
                    <option value="boat_tour">Boat Tour</option>
                    <option value="guided">Guided Experience</option>
                  </select>
                </div>
              )}

              {listingCatFilter === "gear" && (
                <div>
                  <select
                    id="admin-filter-subcategory"
                    value={listingSubcatFilter}
                    onChange={(e) => setListingSubcatFilter(e.target.value)}
                    className="admin-reject-input"
                    style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px", cursor: "pointer" }}
                  >
                    <option value="all">All Gear Subcategories</option>
                    {GEAR_SUBCATEGORIES.map((sc) => (
                      <option key={sc.value} value={sc.value}>{sc.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {listingCatFilter === "rental" && (
                <div>
                  <select
                    id="admin-filter-subcategory"
                    value={listingSubcatFilter}
                    onChange={(e) => setListingSubcatFilter(e.target.value)}
                    className="admin-reject-input"
                    style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px", cursor: "pointer" }}
                  >
                    <option value="all">All Rental Subcategories</option>
                    {RENTAL_SUBCATEGORIES.map((sc) => (
                      <option key={sc.value} value={sc.value}>{sc.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <select
                  id="admin-filter-status"
                  value={listingStatusFilter}
                  onChange={(e) => setListingStatusFilter(e.target.value)}
                  className="admin-reject-input"
                  style={{ width: "100%", margin: 0, padding: "8px 12px", fontSize: "13px", cursor: "pointer" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="admin-app-grid">
              {filteredOtherListings.length === 0 ? (
                <div className="admin-empty" style={{ gridColumn: "1 / -1" }}>
                  <div className="admin-empty-icon" aria-hidden="true">🔍</div>
                  <p style={{ color: "var(--muted)", fontSize: "14px" }}>
                    No listings match the selected filters.
                  </p>
                </div>
              ) : (
                filteredOtherListings.map((l) => <ListingCard key={l.id} listing={l as unknown as Listing} />)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
