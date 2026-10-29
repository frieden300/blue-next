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

interface GearListing {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  status: string;
  stock_count?: number;
  created_at: string;
  partner_profiles?: PartnerProfile | null;
  listing_images?: ListingImage[];
}

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
        {(listings as unknown as GearListing[]).map((item) => {
          const sortedImages = item.listing_images?.sort(
            (a, b) => a.sort_order - b.sort_order
          );
          const mainImage = sortedImages?.[0];
          const stock = item.stock_count ?? 10;
          const isSoldOut = stock <= 0;
          const isLowStock = stock > 0 && stock <= 3;

          return (
            <article key={item.id} className="gear-card" style={isSoldOut ? { opacity: 0.85 } : undefined}>
              <Link
                href={`/gear/${item.id}`}
                className="gear-card-img-wrap"
                style={{ display: "block", cursor: "pointer" }}
                aria-label={`View details for ${item.title}`}
              >
                {mainImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImage.url}
                    alt={mainImage.alt_text || item.title}
                    className="gear-card-img"
                    loading="lazy"
                  />
                ) : (
                  <div className="gear-card-img-placeholder" aria-hidden="true">
                    🤿
                  </div>
                )}

                {isSoldOut ? (
                  <span
                    className="gear-card-tag"
                    style={{ background: "rgba(220, 38, 38, 0.9)", color: "#fff" }}
                  >
                    Sold Out
                  </span>
                ) : isLowStock ? (
                  <span
                    className="gear-card-tag"
                    style={{ background: "rgba(217, 119, 6, 0.9)", color: "#fff" }}
                  >
                    Only {stock} Left
                  </span>
                ) : (
                  <span className="gear-card-tag">In Stock</span>
                )}

                {item.partner_profiles?.business_name && (
                  <span className="gear-card-partner-badge">
                    {item.partner_profiles.business_name}
                  </span>
                )}
              </Link>

              <div className="gear-card-body">
                <div className="gear-card-cat-row">
                  <span
                    className="gear-card-cat"
                    style={
                      isSoldOut
                        ? { color: "#f87171" }
                        : isLowStock
                        ? { color: "#fbbf24" }
                        : { color: "#34d399" }
                    }
                  >
                    {isSoldOut
                      ? "✕ Sold Out"
                      : isLowStock
                      ? `🔥 Only ${stock} left`
                      : `✓ In Stock (${stock})`}
                  </span>
                  {item.location && (
                    <span className="gear-card-location">{item.location}</span>
                  )}
                </div>

                <h2 className="gear-card-title">{item.title}</h2>

                {item.description && (
                  <p className="gear-card-desc">{item.description}</p>
                )}

                <div className="gear-card-footer">
                  <div>
                    <p className="gear-card-price-label">Price</p>
                    <p className="gear-card-price">
                      ₹{Number(item.price_from).toLocaleString("en-IN")}
                    </p>
                  </div>

                  <Link href={`/gear/${item.id}`} className="gear-card-view-btn">
                    {isSoldOut ? "Details →" : "Buy Now →"}
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
