import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MarketplaceFilter from "@/components/marketplace/MarketplaceFilter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import "./gear.css";

export const metadata = {
  title: "Gear Marketplace — BLUE",
  description: "Browse certified marine and diving equipment for purchase from authorized expedition partners.",
};
import GearCard from "@/components/marketplace/cards/GearCard";
import type { GearListing, ListingImage, PartnerProfile } from "@/types/marketplace";

export type { GearListing, ListingImage, PartnerProfile };

import { GEAR_PAGE_CATEGORIES } from "@/lib/constants/marketplace";

export default function GearPage(props: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  return (
    <>
      <SiteHeader />

      <main className="gear-main">
        {/* Hero Section */}
        <section className="gear-hero">
          <p className="gear-kicker">MARINE EQUIPMENT MARKETPLACE</p>
          <h1 className="gear-heading">
            Expedition-grade <em>diving gear</em>
          </h1>
          <p className="gear-sub">
            Purchase professional diving equipment and marine essentials directly
            from verified dive operators and certified distributors.
          </p>
        </section>

        {/* Filter & Search Bar */}
        <section className="gear-filters" aria-label="Filter equipment">
          <div className="gear-filters-inner">
            <Suspense fallback={null}>
              <MarketplaceFilter
                categories={GEAR_PAGE_CATEGORIES}
                placeholder="Search by gear name, model, brand..."
                defaultCategory="all"
              />
            </Suspense>
          </div>
        </section>

        {/* Product Grid */}
        <section className="gear-grid-section">
          <div className="gear-grid-inner">
            <Suspense fallback={<GearGridLoading />}>
              <GearGrid searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function GearGridLoading() {
  return (
    <div className="gear-empty">
      <div className="gear-empty-icon" aria-hidden="true">🤿</div>
      <h2 className="gear-empty-title">Loading marine gear...</h2>
      <p className="gear-empty-text">Searching expedition catalog for certified equipment.</p>
    </div>
  );
}

async function GearGrid(props: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  // Opt into request-time rendering — supabase-ssr uses Date.now() for JWT
  // expiry checks, which Next.js flags during static prerendering.
  await connection();

  const searchParams = await props.searchParams;
  const q = searchParams.q?.trim() || "";
  const type = searchParams.type || "all";

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(`
      id,
      title,
      description,
      location,
      price_from,
      status,
      stock_count,
      created_at,
      partner_profiles:partner_id (
        business_name,
        location,
        verified
      ),
      listing_images (
        url,
        alt_text,
        sort_order
      )
    `)
    .eq("category", "gear")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(48);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (type && type !== "all") {
    const typeFilters: Record<string, string[]> = {
      regulators: ["regulators", "regulator", "bcd"],
      wetsuits: ["wetsuits", "wetsuit", "exposure", "thermal"],
      masks_fins: ["masks_fins", "masks", "mask", "fins", "fin", "optics", "propulsion"],
      computers: ["computers", "computer"],
      accessories: ["accessories", "accessory"],
    };
    const keywords = typeFilters[type] || [type];
    const orConditions = [
      ...keywords.map((k) => `subcategory.eq.${k}`),
      ...keywords.map((k) => `title.ilike.%${k}%`),
      ...keywords.map((k) => `description.ilike.%${k}%`),
    ];
    query = query.or(orConditions.join(","));
  }

  const { data: listings, error } = await query;

  if (error) {
    return (
      <div className="gear-empty">
        <div className="gear-empty-icon" aria-hidden="true">⚠️</div>
        <h2 className="gear-empty-title">Unable to load gear listings</h2>
        <p className="gear-empty-text">
          There was a connection issue with the database. Please try refreshing.
        </p>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="gear-empty">
        <div className="gear-empty-icon" aria-hidden="true">🤿</div>
        <h2 className="gear-empty-title">
          {q || type !== "all" ? "No gear matches your search" : "No gear listed yet"}
        </h2>
        <p className="gear-empty-text">
          {q || type !== "all"
            ? "Try adjusting your search terms or resetting the filter chips above."
            : "Certified marine equipment and expedition gear will appear here once partner retailers publish their listings."}
        </p>
        {q || type !== "all" ? (
          <Link href="/gear" className="gear-empty-cta">
            Reset Filters &rarr;
          </Link>
        ) : (
          <Link href="/partner/apply" className="gear-empty-cta">
            Become a Gear Partner &rarr;
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="gear-grid-header">
        <span className="gear-count-text">
          Showing {listings.length} {listings.length === 1 ? "product" : "products"}
          {q && ` for "${q}"`}
        </span>
      </div>

      <div className="gear-grid">
        {(listings as unknown as GearListing[]).map((item) => (
          <GearCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
