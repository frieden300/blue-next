import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import "./explore.css";

export const metadata = {
  title: "Explore Ocean Experiences — BLUE",
  description:
    "Discover scuba diving, snorkeling, boat tours, and guided marine experiences with certified operators in India.",
};

import ExperienceCard from "@/components/marketplace/cards/ExperienceCard";
import type { Experience, ListingImage } from "@/types/marketplace";

export type { Experience, ListingImage };

const CATEGORIES = [
  { value: "all",         label: "All Experiences" },
  { value: "diving",      label: "Diving" },
  { value: "snorkeling",  label: "Snorkeling" },
  { value: "boat_tour",   label: "Boat Tours" },
  { value: "guided",      label: "Guided" },
] as const;

const DIFFICULTIES = [
  { value: "all",           label: "All Levels" },
  { value: "beginner",      label: "Beginner" },
  { value: "intermediate",  label: "Intermediate" },
  { value: "advanced",      label: "Advanced" },
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  diving:     "Scuba Diving",
  snorkeling: "Snorkeling",
  boat_tour:  "Boat Tour",
  guided:     "Guided Experience",
};


/* ── Page ─────────────────────────────────────────────────────── */
export default function ExplorePage(props: {
  searchParams: Promise<{ cat?: string; diff?: string }>;
}) {
  return (
    <>
      <SiteHeader />

      <main className="explore-main">
        {/* Hero */}
        <section className="explore-hero">
          <p className="explore-kicker">MARINE TOURISM — DISCOVER BLUE</p>
          <h1 className="explore-heading">
            Explore Ocean <em>Experiences</em>
          </h1>
          <p className="explore-sub">
            Dive into crystal-clear waters, glide beside coral reefs, and sail
            at sunset. Certified operators. Real ocean expeditions across
            India&apos;s most stunning coastlines.
          </p>
        </section>

        {/* Filter bar */}
        <section className="explore-filters" aria-label="Filter experiences">
          <div className="explore-filters-inner">
            <Suspense fallback={null}>
              <ExploreFilters searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>

        {/* Grid */}
        <section className="explore-grid-section">
          <div className="explore-grid-inner">
            <Suspense fallback={<ExploreLoading />}>
              <ExploreListings searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ── Filter bar (server — reads searchParams) ─────────────────── */
async function ExploreFilters(props: {
  searchParams: Promise<{ cat?: string; diff?: string }>;
}) {
  const sp = await props.searchParams;
  const activeCat  = sp.cat  || "all";
  const activeDiff = sp.diff || "all";

  const buildHref = (cat: string, diff: string) => {
    const params = new URLSearchParams();
    if (cat  !== "all") params.set("cat",  cat);
    if (diff !== "all") params.set("diff", diff);
    const qs = params.toString();
    return `/explore${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="explore-filter-wrap">
      {/* Category chips */}
      <div className="filter-row" role="group" aria-label="Filter by category">
        <span className="filter-row-label">Category</span>
        <div className="filter-chip-group">
          {CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={buildHref(c.value, activeDiff)}
              className={`filter-chip${activeCat === c.value ? " active" : ""}`}
              aria-current={activeCat === c.value ? "true" : undefined}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Difficulty chips */}
      <div className="filter-row" role="group" aria-label="Filter by difficulty">
        <span className="filter-row-label">Level</span>
        <div className="filter-chip-group">
          {DIFFICULTIES.map((d) => (
            <Link
              key={d.value}
              href={buildHref(activeCat, d.value)}
              className={`filter-chip${activeDiff === d.value ? " active" : ""}`}
              aria-current={activeDiff === d.value ? "true" : undefined}
            >
              {d.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Listings grid (server async) ─────────────────────────────── */
async function ExploreListings(props: {
  searchParams: Promise<{ cat?: string; diff?: string }>;
}) {
  await connection();

  const sp = await props.searchParams;
  const cat  = sp.cat  || "all";
  const diff = sp.diff || "all";

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(`
      id, title, category, subcategory, description, location,
      price_from, duration_hours, difficulty, status,
      listing_images ( url, alt_text, sort_order )
    `)
    .in("category", ["experience", "diving", "snorkeling", "boat_tour", "guided"])
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(48);

  if (diff !== "all") {
    query = query.eq("difficulty", diff);
  }

  if (cat !== "all") {
    query = query.or(`category.eq.${cat},subcategory.eq.${cat}`);
  }

  const { data: listings, error } = await query;

  if (error || !listings || listings.length === 0) {
    return <ExploreEmpty cat={cat} diff={diff} />;
  }

  const rows = listings as unknown as Experience[];

  return (
    <>
      <div className="explore-results-header">
        <p className="explore-results-count">
          Showing {rows.length} {rows.length === 1 ? "experience" : "experiences"}
          {cat !== "all" && ` · ${CATEGORY_LABELS[cat] ?? cat}`}
          {diff !== "all" && ` · ${diff.charAt(0).toUpperCase() + diff.slice(1)}`}
        </p>
      </div>
      <div className="explore-grid">
        {rows.map((exp) => (
          <ExperienceCard key={exp.id} exp={exp} />
        ))}
      </div>
    </>
  );
}

/* ── States ───────────────────────────────────────────────────── */
function ExploreLoading() {
  return (
    <div className="explore-empty">
      <div className="explore-empty-icon" aria-hidden="true">🌊</div>
      <h2 className="explore-empty-heading">Searching the depths…</h2>
      <p className="explore-empty-body">Loading verified ocean expeditions and marine tours.</p>
    </div>
  );
}

function ExploreEmpty({ cat, diff }: { cat: string; diff: string }) {
  const isFiltered = cat !== "all" || diff !== "all";
  return (
    <div className="explore-empty">
      <div className="explore-empty-icon" aria-hidden="true">🐠</div>
      <h2 className="explore-empty-heading">
        {isFiltered ? "No experiences match your filters" : "No experiences yet"}
      </h2>
      <p className="explore-empty-body">
        {isFiltered
          ? "Try clearing the category or difficulty filter above."
          : "Marine experiences will appear here once our partners publish their listings."}
      </p>
      {isFiltered && (
        <Link href="/explore" className="explore-empty-cta">Clear Filters →</Link>
      )}
    </div>
  );
}
