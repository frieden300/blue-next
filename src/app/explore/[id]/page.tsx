import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, type Experience } from "../page";
import Link from "next/link";
import ExperienceBookingForm from "@/components/marketplace/ExperienceBookingForm";
import ListingImageGallery from "@/components/marketplace/ListingImageGallery";
import "../explore.css";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXPERIENCE_CATEGORIES = ["experience", "diving", "snorkeling", "boat_tour", "guided"];

const WHAT_TO_EXPECT: Record<string, string[]> = {
  diving: [
    "Pre-dive safety briefing and equipment fitting",
    "Guided underwater exploration with a certified divemaster",
    "Encounter marine life in their natural habitat",
    "Post-dive debrief and refreshments",
  ],
  snorkeling: [
    "Mask, fins, and flotation aid provided",
    "Safety briefing on currents and marine etiquette",
    "Guided surface snorkeling over coral formations",
    "Freshwater rinse station and towels on return",
  ],
  boat_tour: [
    "Welcome aboard with safety orientation",
    "Scenic cruising through marine-protected waters",
    "Stops for swimming or snorkeling at anchor points",
    "Refreshments and certified crew throughout",
  ],
  guided: [
    "Expert naturalist guide leading your group",
    "Interpretive commentary on marine ecosystems",
    "Small-group format for an immersive experience",
    "All equipment and safety gear provided",
  ],
};

interface ExperienceDetail extends Experience {
  max_capacity?: number;
  experience_sessions?: Array<{
    id: string;
    departure_time: string;
    label: string | null;
    max_capacity: number;
    status: string;
  }>;
  partner_profiles?: { business_name: string; verified: boolean } | null;
}

/* ── Metadata ─────────────────────────────────────────────────── */
export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  if (!UUID_REGEX.test(id)) return { title: "Experience Not Found — BLUE" };

  await connection();

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("title")
    .in("category", EXPERIENCE_CATEGORIES)
    .eq("id", id)
    .maybeSingle();

  return {
    title: data?.title ? `${data.title} — BLUE Experiences` : "Ocean Experience — BLUE",
    description: "Discover this certified marine experience with Project Blue.",
  };
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function ExperienceDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <SiteHeader />
      <main className="explore-main">
        <Suspense fallback={<DetailLoading />}>
          <ExperienceDetailContent params={props.params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function DetailLoading() {
  return (
    <div className="exp-detail-page">
      <div className="not-found-screen">
        <div className="not-found-icon" aria-hidden="true">🌊</div>
        <h1 className="not-found-title">Loading experience…</h1>
        <p className="not-found-desc">Fetching details and availability.</p>
      </div>
    </div>
  );
}

/* ── Content (async server component) ────────────────────────── */
async function ExperienceDetailContent(props: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await props.params;

  if (!UUID_REGEX.test(id)) return <ExperienceNotFound />;

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("listings")
    .select(`
      id, title, category, description, location,
      price_from, duration_hours, difficulty, status, max_capacity,
      partner_profiles:partner_id ( business_name, verified ),
      listing_images ( url, alt_text, sort_order ),
      experience_sessions ( id, departure_time, max_capacity, label, status )
    `)
    .in("category", EXPERIENCE_CATEGORIES)
    .eq("id", id)
    .maybeSingle();

  if (error || !item) return <ExperienceNotFound />;

  return <ExperienceDetailView exp={item as unknown as ExperienceDetail} />;
}

/* ── Shared view ──────────────────────────────────────────────── */
function ExperienceDetailView({
  exp,
}: {
  exp: ExperienceDetail;
}) {
  const catLabel = CATEGORY_LABELS[exp.category] ?? exp.category;
  const durationLabel = exp.duration_hours
    ? exp.duration_hours < 1
      ? `${exp.duration_hours * 60} min`
      : exp.duration_hours === 1
      ? "1 hr"
      : `${exp.duration_hours} hrs`
    : "Flexible";

  const diffClass = exp.difficulty ? `difficulty-${exp.difficulty}` : "";
  const whatToExpect = WHAT_TO_EXPECT[exp.category] ?? WHAT_TO_EXPECT.guided;

  return (
    <div className="exp-detail-page">
      {/* Breadcrumb */}
      <nav className="exp-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <Link href="/explore">Explore</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <span aria-current="page">{exp.title}</span>
      </nav>

      <div className="exp-detail-grid">
        {/* Gallery */}
        <div className="exp-detail-gallery">
          <ListingImageGallery
            images={exp.listing_images}
            title={exp.title}
            cardClassName="exp-detail-img-card"
            imgClassName="exp-detail-img"
            placeholderClassName="exp-detail-img-placeholder"
            placeholderIcon="🌊"
            placeholderText="Demo Experience"
          />

          {/* Partner badge */}
          {exp.partner_profiles && (
            <div className="partner-trust-card">
              <div className="partner-avatar" aria-hidden="true">🤿</div>
              <div className="partner-trust-info">
                <p className="partner-trust-name">
                  {exp.partner_profiles.business_name}
                  {exp.partner_profiles.verified && " ✓"}
                </p>
                <p className="partner-trust-sub">Verified Marine Operator</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="exp-detail-info">
          {/* Badges */}
          <div className="exp-detail-badge-row">
            <span className="exp-detail-cat-tag">{catLabel}</span>
            {exp.difficulty && (
              <span className={`difficulty-badge ${diffClass} exp-detail-diff-tag`}>
                {exp.difficulty.charAt(0).toUpperCase() + exp.difficulty.slice(1)}
              </span>
            )}
          </div>

          <h1 className="exp-detail-title">{exp.title}</h1>

          {exp.location && (
            <p className="exp-detail-location">
              <span aria-hidden="true">📍</span> {exp.location}
            </p>
          )}

          {/* Stats row */}
          <div className="exp-stats-row">
            <div className="exp-stat">
              <span className="exp-stat-label">Duration</span>
              <span className="exp-stat-value">⏱ {durationLabel}</span>
            </div>
            <div className="exp-stat">
              <span className="exp-stat-label">Level</span>
              <span className="exp-stat-value">
                {exp.difficulty
                  ? exp.difficulty.charAt(0).toUpperCase() + exp.difficulty.slice(1)
                  : "All Levels"}
              </span>
            </div>
            <div className="exp-stat">
              <span className="exp-stat-label">Type</span>
              <span className="exp-stat-value">{catLabel}</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="exp-pricing-card">
            <span className="section-label">Price Per Person</span>
            <p className="exp-price-amount">
              ₹{Number(exp.price_from).toLocaleString("en-IN")}
            </p>
            <p className="exp-price-note">
              Includes certified guide, safety equipment &bull; Taxes at checkout
            </p>
          </div>

          {/* Description */}
          <div className="exp-desc-section">
            <span className="section-label">About This Experience</span>
            <p className="exp-desc-text">
              {exp.description ||
                "A breathtaking marine experience curated by our certified partner operators. Your safety and enjoyment are our highest priorities throughout the journey."}
            </p>
          </div>

          {/* What to Expect */}
          <div className="exp-expect-section">
            <span className="section-label">What to Expect</span>
            <ul className="exp-expect-list">
              {whatToExpect.map((point) => (
                <li key={point} className="exp-expect-item">{point}</li>
              ))}
            </ul>
          </div>

          {/* Book CTA Form */}
          <ExperienceBookingForm
            listingId={exp.id}
            listingTitle={exp.title}
            unitPrice={Number(exp.price_from)}
            maxCapacity={exp.max_capacity ?? 12}
            initialSessions={exp.experience_sessions}
          />
        </div>
      </div>
    </div>
  );
}

function ExperienceNotFound() {
  return (
    <div className="not-found-screen">
      <div className="not-found-icon" aria-hidden="true">🌊</div>
      <h1 className="not-found-title">Experience Not Found</h1>
      <p className="not-found-desc">
        This experience may have ended, been archived, or the link is invalid.
      </p>
      <Link href="/explore" className="not-found-back-btn">
        &larr; Back to Explore
      </Link>
    </div>
  );
}
