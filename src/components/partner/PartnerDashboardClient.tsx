"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  createListingAction,
  updateListingAction,
  resubmitListingAction,
  deleteListingAction,
  uploadListingImageAction,
  deleteListingImageAction,
  createExperienceSessionAction,
  updateExperienceSessionAction,
  deleteExperienceSessionAction,
} from "@/app/partner/actions";
import {
  GEAR_SUBCATEGORIES,
  RENTAL_SUBCATEGORIES,
  SUBCAT_LABEL,
  normalizeSubcategory,
} from "@/lib/constants/marketplace";
import type { ListingImage } from "@/types/marketplace";

export interface ExperienceSession {
  id: string;
  departure_time: string;
  max_capacity: number;
  label?: string | null;
  status: "active" | "inactive";
}

interface Listing {
  id: string;
  category: string;
  subcategory?: string | null;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  duration_hours: number | null;
  difficulty: string | null;
  inventory_count?: number;
  stock_count?: number;
  max_capacity?: number;
  status: string;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
  listing_images?: ListingImage[];
  experience_sessions?: ExperienceSession[];
}

interface PartnerProfile {
  id: string;
  business_name: string;
  location: string | null;
  service_types: string[];
}

interface Props {
  partnerProfile: PartnerProfile;
  listings: Listing[];
}

const CAT_LABEL: Record<string, string> = {
  diving: "Diving",
  snorkeling: "Snorkeling",
  boat_tour: "Boat Tour",
  guided: "Guided",
  rental: "Rental",
  gear: "Gear/Sell",
  experience: "Experience",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "ls-pending",
  active: "ls-active",
  rejected: "ls-rejected",
  paused: "ls-paused",
  draft: "ls-draft",
};

const SERVICE_TO_CATS: Record<string, { value: string; label: string }[]> = {
  experience: [
    { value: "diving", label: "Scuba Diving" },
    { value: "snorkeling", label: "Snorkeling" },
    { value: "boat_tour", label: "Boat Tour" },
    { value: "guided", label: "Guided Experience" },
  ],
  sell: [{ value: "gear", label: "Gear / Product" }],
  rent: [{ value: "rental", label: "Equipment Rental" }],
};

const initial = { error: null, success: null };

function CardImageCarousel({
  images,
  title,
  imgClassName = "pdash-listing-img",
  phClassName = "pdash-listing-img-ph",
  phIcon = "🌊",
}: {
  images?: ListingImage[];
  title: string;
  imgClassName?: string;
  phClassName?: string;
  phIcon?: string;
}) {
  const sorted = (images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const [idx, setIdx] = useState(0);
  const current = sorted[idx] ?? sorted[0];

  if (!current) {
    return (
      <div className={phClassName} aria-hidden="true">
        {phIcon}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "160px", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.url} alt={current.alt_text || title} className={imgClassName} />
      {sorted.length > 1 && (
        <>
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(2, 10, 17, 0.75)",
              backdropFilter: "blur(6px)",
              color: "#82d9ed",
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "999px",
              border: "1px solid rgba(130, 217, 237, 0.3)",
              zIndex: 2,
            }}
          >
            {idx + 1} / {sorted.length} photos
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              right: "8px",
              display: "flex",
              gap: "4px",
              zIndex: 2,
              justifyContent: "center",
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
                  width: i === idx ? "16px" : "6px",
                  height: "6px",
                  borderRadius: "999px",
                  border: "none",
                  background: i === idx ? "#38bdf8" : "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.2s",
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
              left: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
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
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
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

export default function PartnerDashboardClient({ partnerProfile, listings }: Props) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editListing, setEditListing] = useState<Listing | null>(null);
  const [managingSessionsListing, setManagingSessionsListing] = useState<Listing | null>(null);
  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableCats = partnerProfile.service_types.flatMap(
    (s) => SERVICE_TO_CATS[s] ?? []
  );

  return (
    <div className="pdash-page">
      {/* Header */}
      <div className="pdash-header-card">
        <div>
          <h1 className="pdash-title">
            Partner <em>Dashboard</em>
          </h1>
          <p className="pdash-biz">{partnerProfile.business_name}</p>
          <div className="pdash-services">
            {partnerProfile.service_types.map((s) => (
              <span key={s} className="pdash-service-tag">
                {s === "experience" ? "🤿 Experience" : s === "sell" ? "🛒 Sell" : "⚓ Rent"}
              </span>
            ))}
            {partnerProfile.service_types.length < 3 && (
              <Link
                href="/partner/apply"
                className="pdash-service-tag"
                style={{
                  textDecoration: "none",
                  borderStyle: "dashed",
                  color: "#38bdf8",
                  borderColor: "rgba(56, 189, 248, 0.4)",
                  background: "rgba(14, 165, 233, 0.08)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                + Request Additional Services
              </Link>
            )}
          </div>
        </div>
        <button
          id="pdash-add-listing-btn"
          className="pdash-cta-btn"
          onClick={() => {
            setEditListing(null);
            setShowCreateModal(true);
          }}
          disabled={availableCats.length === 0}
        >
          + Add New Listing
        </button>
      </div>

      {/* Listings section */}
      <div className="pdash-section">
        <h2 className="pdash-section-title">My Listings</h2>

        {listings.length === 0 ? (
          <div className="pdash-empty">
            <div className="pdash-empty-icon" aria-hidden="true">🌊</div>
            <h3 className="pdash-empty-title">No listings yet</h3>
            <p className="pdash-empty-sub">
              Create your first listing to start reaching customers on Blue.
            </p>
            <button
              className="pdash-cta-btn"
              onClick={() => setShowCreateModal(true)}
            >
              + Add First Listing
            </button>
          </div>
        ) : (
          <div className="pdash-listing-grid">
            {listings.map((listing) => (
              <article key={listing.id} className="pdash-listing-card">
                <CardImageCarousel images={listing.listing_images} title={listing.title} />

                <div className="pdash-listing-body">
                  <div className="pdash-listing-meta">
                    <span className="pdash-listing-cat">
                      {CAT_LABEL[listing.category] ?? listing.category}
                      {listing.subcategory ? ` • ${SUBCAT_LABEL[listing.subcategory] ?? listing.subcategory}` : ""}
                    </span>
                    <span
                      className={`pdash-listing-status ${STATUS_CLASS[listing.status] ?? ""}`}
                    >
                      {listing.status}
                    </span>
                  </div>

                  <p className="pdash-listing-title">{listing.title}</p>
                  <p className="pdash-listing-price">
                    ₹{Number(listing.price_from).toLocaleString("en-IN")}
                  </p>

                  {listing.category === "rental" && (
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                      ⚓ Fleet Inventory: <strong style={{ color: "var(--blue)" }}>{listing.inventory_count ?? 5} units</strong>
                    </p>
                  )}
                  {listing.category === "gear" && (
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                      🛒 Stock: <strong style={{ color: (listing.stock_count ?? 10) > 0 ? "var(--blue)" : "#fca5a5" }}>{(listing.stock_count ?? 10) > 0 ? `${listing.stock_count ?? 10} units in stock` : "Sold Out"}</strong>
                    </p>
                  )}
                  {["diving", "snorkeling", "boat_tour", "guided", "experience"].includes(listing.category) && (
                    <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                      🌊 Capacity: <strong style={{ color: "var(--blue)" }}>{listing.max_capacity ?? 10} guests</strong>
                      {listing.experience_sessions && listing.experience_sessions.length > 0 && (
                        <span> • {listing.experience_sessions.length} departure slot{listing.experience_sessions.length !== 1 ? "s" : ""}</span>
                      )}
                    </p>
                  )}

                  {listing.status === "rejected" && listing.reviewer_note && (
                    <div className="pdash-rejection-note">
                      <strong>Reason:</strong> {listing.reviewer_note}
                    </div>
                  )}

                  <div className="pdash-listing-actions">
                    {/* Departures for experiences */}
                    {["diving", "snorkeling", "boat_tour", "guided", "experience"].includes(listing.category) && (
                      <button
                        id={`manage-sessions-${listing.id}`}
                        className="pdash-action-btn"
                        style={{ color: "var(--blue)", borderColor: "rgba(130,217,237,0.3)" }}
                        onClick={() => setManagingSessionsListing(listing)}
                      >
                        Departures ({listing.experience_sessions?.length ?? 0})
                      </button>
                    )}

                    {/* Edit always available */}
                    <button
                      id={`edit-listing-${listing.id}`}
                      className="pdash-action-btn"
                      onClick={() => {
                        setEditListing(listing);
                        setShowCreateModal(true);
                      }}
                    >
                      Edit
                    </button>

                    {/* Resubmit when rejected */}
                    {listing.status === "rejected" && (
                      <button
                        id={`resubmit-listing-${listing.id}`}
                        className="pdash-action-btn"
                        disabled={resubmitting === listing.id}
                        onClick={async () => {
                          setResubmitting(listing.id);
                          await resubmitListingAction(listing.id);
                          setResubmitting(null);
                        }}
                        style={{ color: "var(--blue)", borderColor: "rgba(130,217,237,0.4)" }}
                      >
                        {resubmitting === listing.id ? "Submitting…" : "Resubmit"}
                      </button>
                    )}

                    {/* Delete listing */}
                    {deletingListingId !== listing.id ? (
                      <button
                        id={`delete-listing-${listing.id}`}
                        className="pdash-action-btn danger"
                        onClick={() => setDeletingListingId(listing.id)}
                      >
                        Delete
                      </button>
                    ) : (
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button
                          id={`confirm-delete-${listing.id}`}
                          className="pdash-action-btn danger"
                          style={{
                            background: "rgba(239,68,68,0.2)",
                            color: "#fca5a5",
                            borderColor: "rgba(239,68,68,0.5)",
                          }}
                          onClick={async () => {
                            setIsDeleting(true);
                            await deleteListingAction(listing.id);
                            setIsDeleting(false);
                            setDeletingListingId(null);
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? "Deleting…" : "Confirm?"}
                        </button>
                        <button
                          type="button"
                          className="pdash-action-btn"
                          onClick={() => setDeletingListingId(null)}
                          disabled={isDeleting}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <ListingFormModal
          serviceTypes={partnerProfile.service_types}
          editListing={editListing}
          onClose={() => {
            setShowCreateModal(false);
            setEditListing(null);
          }}
        />
      )}

      {/* Manage Sessions Modal */}
      {managingSessionsListing && (
        <ManageSessionsModal
          listing={managingSessionsListing}
          onClose={() => setManagingSessionsListing(null)}
        />
      )}
    </div>
  );
}



/* ── Listing Form Modal ─────────────────────────────────────── */
function ListingFormModal({
  serviceTypes,
  editListing,
  onClose,
}: {
  serviceTypes: string[];
  editListing: Listing | null;
  onClose: () => void;
}) {
  const isEdit = !!editListing;

  const TOP_LEVEL_OPTIONS = [
    { type: "experience", label: "🤿 Experience", service: "experience" },
    { type: "sell", label: "🛒 Gear / Product", service: "sell" },
    { type: "rent", label: "⚓ Equipment Rental", service: "rent" },
  ];

  const availableTopTypes = TOP_LEVEL_OPTIONS.filter((opt) =>
    serviceTypes.includes(opt.service)
  );

  function getInitialTopType() {
    if (editListing) {
      if (["diving", "snorkeling", "boat_tour", "guided", "experience"].includes(editListing.category)) {
        return "experience";
      }
      if (editListing.category === "gear") return "sell";
      if (editListing.category === "rental") return "rent";
    }
    return availableTopTypes[0]?.type ?? "experience";
  }

  const [selectedTopType, setSelectedTopType] = useState<string>(getInitialTopType);

  const [selectedExpCategory, setSelectedExpCategory] = useState<string>(
    editListing && ["diving", "snorkeling", "boat_tour", "guided"].includes(editListing.category)
      ? editListing.category
      : "diving"
  );

  const [selectedSubcat, setSelectedSubcat] = useState<string>(() =>
    normalizeSubcategory(editListing?.subcategory)
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>(editListing?.difficulty ?? "beginner");

  const [existingImages, setExistingImages] = useState<ListingImage[]>(
    editListing?.listing_images ?? []
  );
  const [deletingImgId, setDeletingImgId] = useState<string | null>(null);

  const [stagedFiles, setStagedFiles] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatusText, setSubmitStatusText] = useState("");
  const [formMsg, setFormMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isExperience = selectedTopType === "experience";
  const isRental = selectedTopType === "rent";
  const isGear = selectedTopType === "sell";

  function handleTopTypeChange(newType: string) {
    setSelectedTopType(newType);
    if (newType === "experience") {
      setSelectedSubcat("");
    } else if (newType === "sell") {
      setSelectedSubcat(editListing?.category === "gear" ? normalizeSubcategory(editListing.subcategory) : "");
    } else if (newType === "rent") {
      setSelectedSubcat(editListing?.category === "rental" ? normalizeSubcategory(editListing.subcategory) : "");
    }
  }

  async function handleDeleteExistingImage(imageId: string) {
    setDeletingImgId(imageId);
    const res = await deleteListingImageAction(imageId);
    setDeletingImgId(null);
    if (res.error) {
      setFormMsg({ text: res.error, ok: false });
    } else {
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    }
  }

  function handleFileSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setStagedFiles((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  function removeStagedFile(index: number) {
    setStagedFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormMsg(null);
    const fd = new FormData(e.currentTarget);
    const finalCat = selectedTopType === "sell" ? "gear" : selectedTopType === "rent" ? "rental" : selectedExpCategory;
    fd.set("category", finalCat);
    if (selectedTopType === "experience") {
      fd.delete("subcategory");
      if (selectedDifficulty) fd.set("difficulty", selectedDifficulty);
    } else {
      if (selectedSubcat) fd.set("subcategory", selectedSubcat);
      fd.delete("difficulty");
      fd.delete("duration_hours");
    }

    setSubmitting(true);
    setSubmitStatusText(stagedFiles.length > 0 ? "Creating & Uploading Images…" : "Creating Listing…");

    try {
      const res = await createListingAction(initial, fd);
      if (res.error) {
        setFormMsg({ text: res.error, ok: false });
        setSubmitting(false);
        return;
      }

      if (res.listingId && stagedFiles.length > 0) {
        setSubmitStatusText(`Uploading ${stagedFiles.length} image${stagedFiles.length > 1 ? "s" : ""}…`);
        const uploadResults = await Promise.all(
          stagedFiles.map((sf, i) =>
            uploadListingImageAction(res.listingId!, sf.file, i)
          )
        );
        uploadResults.forEach((upRes) => {
          if (upRes.error) {
            console.error("Image upload warning:", upRes.error);
          }
        });
      }

      setFormMsg({ text: res.success || "Listing submitted for review.", ok: true });
      stagedFiles.forEach((sf) => URL.revokeObjectURL(sf.preview));
      setStagedFiles([]);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setFormMsg({ text: err instanceof Error ? err.message : "Creation failed", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormMsg(null);
    const fd = new FormData(e.currentTarget);
    const finalCat = selectedTopType === "sell" ? "gear" : selectedTopType === "rent" ? "rental" : selectedExpCategory;
    fd.set("category", finalCat);
    if (selectedTopType === "experience") {
      fd.delete("subcategory");
      if (selectedDifficulty) fd.set("difficulty", selectedDifficulty);
    } else {
      if (selectedSubcat) fd.set("subcategory", selectedSubcat);
      fd.delete("difficulty");
      fd.delete("duration_hours");
    }

    setSubmitting(true);
    setSubmitStatusText(stagedFiles.length > 0 ? "Saving & Uploading Images…" : "Saving Changes…");

    try {
      const res = await updateListingAction(initial, fd);
      if (res.error) {
        setFormMsg({ text: res.error, ok: false });
        setSubmitting(false);
        return;
      }

      if (editListing && stagedFiles.length > 0) {
        const baseOrder = existingImages.length;
        setSubmitStatusText(`Uploading ${stagedFiles.length} image${stagedFiles.length > 1 ? "s" : ""}…`);
        const uploadResults = await Promise.all(
          stagedFiles.map((sf, i) =>
            uploadListingImageAction(editListing.id, sf.file, baseOrder + i)
          )
        );
        uploadResults.forEach((upRes) => {
          if (upRes.error) {
            console.error("Image upload warning:", upRes.error);
          }
        });
        stagedFiles.forEach((sf) => URL.revokeObjectURL(sf.preview));
        setStagedFiles([]);
      }

      setFormMsg({ text: res.success || "Listing updated successfully.", ok: true });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setFormMsg({ text: err instanceof Error ? err.message : "Update failed", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteListing() {
    if (!editListing) return;
    setSubmitting(true);
    setSubmitStatusText("Deleting Listing…");
    const res = await deleteListingAction(editListing.id);
    if (res.error) {
      setFormMsg({ text: res.error, ok: false });
      setSubmitting(false);
    } else {
      setFormMsg({ text: "Listing deleted successfully.", ok: true });
      setTimeout(() => {
        onClose();
      }, 800);
    }
  }

  return (
    <div className="pdash-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pdash-form-modal">
        <div className="pdash-modal-header">
          <h2 className="pdash-modal-title">
            {isEdit ? "Edit Listing" : "Create New Listing"}
          </h2>
          <button className="pdash-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Top-Level Service / Listing Type selector */}
        {availableTopTypes.length > 1 && (
          <div style={{ marginBottom: "20px" }}>
            <p className="pf-label" style={{ marginBottom: "10px" }}>
              Listing Type <span style={{ color: "#fca5a5" }}>*</span>
            </p>
            <div className="pdash-cat-tabs">
              {availableTopTypes.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  className={`pdash-cat-tab ${selectedTopType === opt.type ? "active" : ""}`}
                  onClick={() => handleTopTypeChange(opt.type)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {formMsg && (
          <div className={`pf-alert ${formMsg.ok ? "pf-alert-success" : "pf-alert-error"}`}>
            {formMsg.text}
          </div>
        )}

        <form
          className="partner-form"
          onSubmit={isEdit ? handleUpdateSubmit : handleCreateSubmit}
        >
          {isEdit && (
            <input type="hidden" name="listing_id" value={editListing!.id} />
          )}

          {/* Experience Category + Difficulty + Duration */}
          {selectedTopType === "experience" && (
            <>
              <div className="pf-group">
                <label className="pf-label" htmlFor="lf-category">
                  Experience Category <span style={{ color: "#fca5a5" }}>*</span>
                </label>
                <select
                  id="lf-category"
                  name="category"
                  className="pf-input"
                  required
                  value={selectedExpCategory}
                  onChange={(e) => setSelectedExpCategory(e.target.value)}
                >
                  <option value="diving">Scuba Diving</option>
                  <option value="snorkeling">Snorkeling</option>
                  <option value="boat_tour">Boat Tour</option>
                  <option value="guided">Guided Experience</option>
                </select>
              </div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="lf-difficulty">
                  Difficulty Level
                </label>
                <select
                  id="lf-difficulty"
                  name="difficulty"
                  className="pf-input"
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="pf-group">
                <label className="pf-label" htmlFor="lf-duration">
                  Duration (hours)
                </label>
                <input
                  id="lf-duration"
                  name="duration_hours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  className="pf-input"
                  defaultValue={editListing?.duration_hours ?? ""}
                  placeholder="e.g. 3"
                />
              </div>
            </>
          )}

          {/* Gear Subcategory */}
          {selectedTopType === "sell" && (
            <div className="pf-group">
              <label className="pf-label" htmlFor="lf-subcategory">
                Gear Subcategory <span style={{ color: "#fca5a5" }}>*</span>
              </label>
              <select
                id="lf-subcategory"
                name="subcategory"
                className="pf-input"
                required
                value={selectedSubcat}
                onChange={(e) => setSelectedSubcat(e.target.value)}
              >
                <option value="">— Select Subcategory —</option>
                {GEAR_SUBCATEGORIES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    {sc.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rental Subcategory */}
          {selectedTopType === "rent" && (
            <div className="pf-group">
              <label className="pf-label" htmlFor="lf-subcategory">
                Rental Subcategory <span style={{ color: "#fca5a5" }}>*</span>
              </label>
              <select
                id="lf-subcategory"
                name="subcategory"
                className="pf-input"
                required
                value={selectedSubcat}
                onChange={(e) => setSelectedSubcat(e.target.value)}
              >
                <option value="">— Select Subcategory —</option>
                {RENTAL_SUBCATEGORIES.map((sc) => (
                  <option key={sc.value} value={sc.value}>
                    {sc.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pf-group">
            <label className="pf-label" htmlFor="lf-title">
              {isRental ? "Equipment Name" : isGear ? "Product Name" : "Experience Title"}{" "}
              <span style={{ color: "#fca5a5" }}>*</span>
            </label>
            <input
              id="lf-title"
              name="title"
              type="text"
              className="pf-input"
              required
              maxLength={150}
              defaultValue={editListing?.title ?? ""}
              placeholder={isRental ? "e.g. Full Scuba Kit" : isGear ? "e.g. Carbon Freediving Fins" : "e.g. Beginner Diving Experience"}
            />
          </div>

          <div className="pf-group">
            <label className="pf-label" htmlFor="lf-description">Description</label>
            <textarea
              id="lf-description"
              name="description"
              className="pf-textarea"
              rows={3}
              maxLength={2000}
              defaultValue={editListing?.description ?? ""}
              placeholder="Describe the experience, product, or rental item..."
            />
          </div>

          <div className="pf-group">
            <label className="pf-label" htmlFor="lf-location">Location</label>
            <input
              id="lf-location"
              name="location"
              type="text"
              className="pf-input"
              maxLength={120}
              defaultValue={editListing?.location ?? ""}
              placeholder="e.g. Goa, India"
            />
          </div>

          <div className="pf-group">
            <label className="pf-label" htmlFor="lf-price">
              {isRental ? "Daily Rental Rate (₹)" : isGear ? "Price (₹)" : "Price per Person (₹)"}{" "}
              <span style={{ color: "#fca5a5" }}>*</span>
            </label>
            <input
              id="lf-price"
              name="price_from"
              type="number"
              min="0"
              step="0.01"
              className="pf-input"
              required
              defaultValue={editListing?.price_from ?? ""}
              placeholder="0.00"
            />
          </div>

          {/* Rental Fleet Inventory */}
          {isRental && (
            <div className="pf-group">
              <label className="pf-label" htmlFor="lf-inventory">
                Total Available Units (Fleet Size) <span style={{ color: "#fca5a5" }}>*</span>
              </label>
              <input
                id="lf-inventory"
                name="inventory_count"
                type="number"
                min="1"
                step="1"
                className="pf-input"
                required
                defaultValue={editListing?.inventory_count ?? 5}
                placeholder="e.g. 5"
              />
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Total fleet units available for simultaneous customer reservations.
              </p>
            </div>
          )}

          {/* Purchasable Gear Stock */}
          {isGear && (
            <div className="pf-group">
              <label className="pf-label" htmlFor="lf-stock">
                Purchasable Stock Quantity <span style={{ color: "#fca5a5" }}>*</span>
              </label>
              <input
                id="lf-stock"
                name="stock_count"
                type="number"
                min="0"
                step="1"
                className="pf-input"
                required
                defaultValue={editListing?.stock_count ?? 10}
                placeholder="e.g. 10 (0 for Sold Out)"
              />
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Current units available in inventory. Setting to 0 marks product as Sold Out.
              </p>
            </div>
          )}

          {/* Experience Guest Capacity */}
          {isExperience && (
            <div className="pf-group">
              <label className="pf-label" htmlFor="lf-capacity">
                Default Guest Capacity (Per Departure / Date) <span style={{ color: "#fca5a5" }}>*</span>
              </label>
              <input
                id="lf-capacity"
                name="max_capacity"
                type="number"
                min="1"
                step="1"
                className="pf-input"
                required
                defaultValue={editListing?.max_capacity ?? 10}
                placeholder="e.g. 10"
              />
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Maximum guests allowed for date-only bookings or default session capacity.
              </p>
            </div>
          )}

          {/* Always visible Image Upload Section */}
          <div className="pf-group" style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
              <p className="pf-label" style={{ marginBottom: 0 }}>Listing Images</p>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>PNG, JPG, WEBP</span>
            </div>

            {/* 5:4 Aspect Ratio Helper Note */}
            <div
              style={{
                background: "rgba(130, 217, 237, 0.05)",
                border: "1px solid rgba(130, 217, 237, 0.18)",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "12px",
                lineHeight: "1.5",
                color: "var(--muted)",
                marginBottom: "14px",
              }}
            >
              <span style={{ color: "var(--blue)", fontWeight: 600 }}>💡 Recommended:</span>{" "}
              Upload landscape images with a 5:4 aspect ratio (e.g., 1250×1000 px) or wider. Square or portrait images will be cropped at the top and bottom on listing cards.
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              id="lf-image-file"
              multiple
              onChange={handleFileSelection}
              style={{ display: "none" }}
            />

            {/* Styled File Upload Trigger */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
              <label
                htmlFor="lf-image-file"
                className="pdash-upload-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "12px",
                  background: "rgba(130, 217, 237, 0.08)",
                  border: "1px dashed rgba(130, 217, 237, 0.4)",
                  color: "var(--blue)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <span aria-hidden="true">📷</span>
                <span>{isEdit ? "Add / Upload Images" : "Choose Images"}</span>
              </label>
              {stagedFiles.length > 0 && (
                <span style={{ fontSize: "13px", color: "var(--blue)" }}>
                  {stagedFiles.length} new image{stagedFiles.length > 1 ? "s" : ""} selected
                </span>
              )}
            </div>

            {/* Current images for edit */}
            {isEdit && existingImages.length > 0 && (
              <div style={{ marginBottom: "14px" }}>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
                  Current Images ({existingImages.length}):
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {existingImages.map((img, i) => (
                    <div
                      key={img.id || `${img.url}-${i}`}
                      style={{
                        width: "72px",
                        height: "58px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        position: "relative",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="Listing image" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {img.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExistingImage(img.id!)}
                          disabled={deletingImgId === img.id}
                          title="Delete image"
                          style={{
                            position: "absolute",
                            top: "2px",
                            right: "2px",
                            width: "18px",
                            height: "18px",
                            borderRadius: "50%",
                            background: "rgba(239, 68, 68, 0.9)",
                            color: "white",
                            border: "none",
                            fontSize: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                            zIndex: 2,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staged new image thumbnails */}
            {stagedFiles.length > 0 && (
              <div>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
                  {isEdit ? "New Images to Upload:" : "Staged Images (will upload on save):"}
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {stagedFiles.map((sf, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: "72px",
                        height: "58px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        border: "1px solid rgba(130, 217, 237, 0.4)",
                        position: "relative",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sf.preview} alt="Staged upload preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => removeStagedFile(idx)}
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: "rgba(0, 0, 0, 0.75)",
                          color: "#ffffff",
                          border: "none",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            id="lf-submit-btn"
            type="submit"
            className="pf-submit-btn"
            disabled={submitting}
          >
            {submitting
              ? submitStatusText || "Saving…"
              : isEdit
                ? "Save Changes"
                : "Create Listing (Pending Review) →"}
          </button>
        </form>

        {/* Delete listing option in Edit modal */}
        {isEdit && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
            {!confirmDelete ? (
              <button
                type="button"
                className="pdash-action-btn danger"
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
              >
                🗑️ Delete Listing
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#fca5a5" }}>Permanently delete?</span>
                <button
                  type="button"
                  className="pdash-action-btn danger"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.5)" }}
                  onClick={handleDeleteListing}
                  disabled={submitting}
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  className="pdash-action-btn"
                  onClick={() => setConfirmDelete(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Manage Experience Departure Sessions Modal ──────────────── */
function ManageSessionsModal({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ExperienceSession[]>(
    listing.experience_sessions ?? []
  );
  const [newTime, setNewTime] = useState("09:00 AM");
  const [newCapacity, setNewCapacity] = useState(listing.max_capacity ?? 10);
  const [newLabel, setNewLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const res = await createExperienceSessionAction(
      listing.id,
      newTime,
      newCapacity,
      newLabel || undefined
    );

    setIsSubmitting(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg("Departure slot added successfully!");
      setSessions((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          departure_time: newTime,
          max_capacity: newCapacity,
          label: newLabel || null,
          status: "active",
        },
      ]);
      setNewLabel("");
    }
  };

  const handleToggleStatus = async (session: ExperienceSession) => {
    const nextStatus = session.status === "active" ? "inactive" : "active";
    setErrorMsg(null);
    const res = await updateExperienceSessionAction(session.id, session.max_capacity, nextStatus);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? { ...s, status: nextStatus } : s))
      );
    }
  };

  const handleDelete = async (sessionId: string) => {
    setErrorMsg(null);
    const res = await deleteExperienceSessionAction(sessionId);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  };

  return (
    <div className="pdash-form-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pdash-form-modal" style={{ maxWidth: "560px" }}>
        <div className="pdash-modal-header">
          <div>
            <h2 className="pdash-modal-title">Departure Times</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>
              {listing.title}
            </p>
          </div>
          <button className="pdash-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {errorMsg && <div className="pf-alert pf-alert-error">{errorMsg}</div>}
        {successMsg && <div className="pf-alert pf-alert-success">{successMsg}</div>}

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)", marginBottom: "8px" }}>
            Current Departure Slots ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p style={{ fontSize: "12px", color: "var(--muted)", fontStyle: "italic", marginBottom: "16px" }}>
              No departure times configured. This experience currently operates with daily calendar capacity ({listing.max_capacity ?? 10} guests).
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "rgba(10, 25, 47, 0.6)",
                    border: "1px solid rgba(14, 165, 233, 0.15)",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--white)", marginRight: "8px" }}>
                      ⏰ {sess.departure_time}
                    </span>
                    {sess.label && (
                      <span style={{ fontSize: "12px", color: "var(--blue)", marginRight: "8px" }}>
                        ({sess.label})
                      </span>
                    )}
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Max: {sess.max_capacity} guests
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="pdash-action-btn"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      onClick={() => handleToggleStatus(sess)}
                    >
                      {sess.status === "active" ? "Active" : "Inactive"}
                    </button>
                    <button
                      type="button"
                      className="pdash-action-btn danger"
                      style={{ fontSize: "11px", padding: "4px 8px" }}
                      onClick={() => handleDelete(sess.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--white)", marginBottom: "10px" }}>
              + Add New Departure Slot
            </h3>
            <form onSubmit={handleAddSession} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label className="pf-label" style={{ fontSize: "11px" }}>Departure Time</label>
                  <input
                    type="text"
                    className="pf-input"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    placeholder="e.g. 09:00 AM or 14:00"
                  />
                </div>
                <div>
                  <label className="pf-label" style={{ fontSize: "11px" }}>Capacity (Guests)</label>
                  <input
                    type="number"
                    min="1"
                    className="pf-input"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="pf-label" style={{ fontSize: "11px" }}>Slot Label (Optional)</label>
                <input
                  type="text"
                  className="pf-input"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Morning Dive / Sunset Tour"
                />
              </div>
              <button
                type="submit"
                className="pf-submit-btn"
                disabled={isSubmitting}
                style={{ marginTop: "4px" }}
              >
                {isSubmitting ? "Adding…" : "+ Add Departure Slot"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
