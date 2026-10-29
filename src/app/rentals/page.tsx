import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import MarketplaceFilter from "@/components/marketplace/MarketplaceFilter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import "./rentals.css";

export const metadata = {
  title: "Gear Rentals — BLUE",
  description: "Rent certified diving kits, cylinder sets, cameras, and marine gear for your ocean expeditions.",
};

interface ListingImage {
  url: string;
  alt_text: string | null;
  sort_order: number;
}

interface PartnerProfile {
  business_name: string;
  location: string | null;
  verified: boolean;
}

interface RentalListing {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  duration_hours: number | null;
  status: string;
  inventory_count?: number;
  created_at: string;
  partner_profiles?: PartnerProfile | null;
  listing_images?: ListingImage[];
}

import { RENTAL_PAGE_CATEGORIES } from "@/lib/constants/marketplace";

export default function RentalsPage(props: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  return (
    <>
      <SiteHeader />

      <main className="rentals-main">
        {/* Hero Section */}
        <section className="rentals-hero">
          <p className="rentals-kicker">EXPEDITION EQUIPMENT RENTALS</p>
          <h1 className="rentals-heading">
            Diving gear <em>on demand</em>
          </h1>
          <p className="rentals-sub">
            Rent certified dive kits, cylinder sets, cameras, and technical marine gear
            from certified local dive centers at your destination.
          </p>
        </section>

        {/* Filter Bar */}
        <section className="rentals-filters" aria-label="Filter rental equipment">
          <div className="rentals-filters-inner">
            <Suspense fallback={null}>
              <MarketplaceFilter
                categories={RENTAL_PAGE_CATEGORIES}
                placeholder="Search rental kits, cylinders, cameras..."
                defaultCategory="all"
              />
            </Suspense>
          </div>
        </section>

        {/* Rentals Grid Section */}
        <section className="rentals-grid-section">
          <div className="rentals-grid-inner">
            <Suspense fallback={<RentalsLoading />}>
              <RentalsGrid searchParams={props.searchParams} />
            </Suspense>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function RentalsLoading() {
  return (
    <div className="rentals-empty">
      <div className="rentals-empty-icon" aria-hidden="true">⚓</div>
      <h2 className="rentals-empty-title">Searching rental inventory...</h2>
      <p className="rentals-empty-text">Loading certified diving gear and expedition kits available for rental.</p>
    </div>
  );
}

async function RentalsGrid(props: {
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
      duration_hours,
      status,
      inventory_count,
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
    .eq("category", "rental")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(48);

  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  }

  if (type && type !== "all") {
    const typeFilters: Record<string, string[]> = {
      kits: ["kits", "kit"],
      tanks: ["tanks", "tank", "cylinder", "cylinders"],
      cameras: ["cameras", "camera", "drone", "drones"],
      scooters: ["scooters", "scooter", "dpv"],
      safety: ["safety", "light", "lights", "torch"],
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
      <div className="rentals-empty">
        <div className="rentals-empty-icon" aria-hidden="true">⚠️</div>
        <h2 className="rentals-empty-title">Unable to load rental listings</h2>
        <p className="rentals-empty-text">
          There was a connection issue with the database. Please try refreshing.
        </p>
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="rentals-empty">
        <div className="rentals-empty-icon" aria-hidden="true">⚓</div>
        <h2 className="rentals-empty-title">
          {q || type !== "all" ? "No rentals match your search" : "No rental gear available yet"}
        </h2>
        <p className="rentals-empty-text">
          {q || type !== "all"
            ? "Try adjusting your search terms or selecting another category filter above."
            : "Certified rental equipment from partner dive shops will appear here once listings are published."}
        </p>
        {q || type !== "all" ? (
          <Link href="/rentals" className="rentals-empty-cta">
            Reset Filters &rarr;
          </Link>
        ) : (
          <Link href="/partner/apply" className="rentals-empty-cta">
            List Rental Gear &rarr;
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rentals-grid-header">
        <span className="rentals-count-text">
          Showing {listings.length} {listings.length === 1 ? "rental item" : "rental items"}
          {q && ` for "${q}"`}
        </span>
      </div>

      <div className="rentals-grid">
        {(listings as unknown as RentalListing[]).map((item) => {
          const sortedImages = item.listing_images?.sort(
            (a, b) => a.sort_order - b.sort_order
          );
          const mainImage = sortedImages?.[0];

          return (
            <article key={item.id} className="rental-card">
              <Link
                href={`/rentals/${item.id}`}
                className="rental-card-img-wrap"
                style={{ display: "block", cursor: "pointer" }}
                aria-label={`Reserve ${item.title}`}
              >
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImage.url}
                    alt={mainImage.alt_text || item.title}
                    className="rental-card-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="rental-card-img-placeholder" aria-hidden="true">
                    ⚓
                  </div>
                )}

                <span className="rental-card-tag">Rental</span>

                {item.partner_profiles?.business_name && (
                  <span className="rental-card-partner-badge">
                    {item.partner_profiles.business_name}
                  </span>
                )}
              </Link>

              <div className="rental-card-body">
                <div className="rental-card-cat-row">
                  <span className="rental-card-cat">
                    Rental &bull; {item.inventory_count ?? 5} units in fleet
                  </span>
                  {item.location && (
                    <span className="rental-card-location">{item.location}</span>
                  )}
                </div>

                <h2 className="rental-card-title">{item.title}</h2>

                {item.description && (
                  <p className="rental-card-desc">{item.description}</p>
                )}

                <div className="rental-card-footer">
                  <div>
                    <p className="rental-card-rate-label">Daily Rate</p>
                    <p className="rental-card-rate">
                      ₹{Number(item.price_from).toLocaleString("en-IN")}{" "}
                      <span>/ day</span>
                    </p>
                  </div>

                  <Link href={`/rentals/${item.id}`} className="rental-card-view-btn">
                    Reserve &rarr;
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
