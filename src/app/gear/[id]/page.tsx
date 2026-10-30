import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import AddToCartButton from "@/components/marketplace/AddToCartButton";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ListingImageGallery from "@/components/marketplace/ListingImageGallery";
import "../gear.css";

import { isValidUUID } from "@/lib/utils/validation";
import { getMainListingImage } from "@/lib/utils/images";
import { formatINR } from "@/lib/utils/pricing";
import type { GearDetail, ListingImage, PartnerProfile } from "@/types/marketplace";

export type { GearDetail, ListingImage, PartnerProfile };

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!isValidUUID(id)) {
    return { title: "Product Not Found — BLUE" };
  }

  await connection();

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("title")
    .eq("id", id)
    .eq("category", "gear")
    .maybeSingle();

  return {
    title: data?.title ? `${data.title} — BLUE Gear` : "Product Details — BLUE Gear",
    description: "Expedition-grade marine and diving gear details.",
  };
}

export default function GearDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <SiteHeader />

      <main className="gear-main">
        <Suspense fallback={<GearDetailLoading />}>
          <GearDetailContent params={props.params} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

function GearDetailLoading() {
  return (
    <div className="product-detail-page">
      <div className="not-found-screen">
        <div className="not-found-icon" aria-hidden="true">🤿</div>
        <h1 className="not-found-title">Loading Gear Details...</h1>
        <p className="not-found-desc">Fetching technical specifications and inventory status.</p>
      </div>
    </div>
  );
}

async function GearDetailContent(props: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await props.params;

  // Gracefully handle invalid UUIDs before querying Supabase
  if (!isValidUUID(id)) {
    return <GearNotFoundScreen />;
  }

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      description,
      location,
      price_from,
      status,
      difficulty,
      duration_hours,
      stock_count,
      created_at,
      partner_profiles:partner_id (
        business_name,
        location,
        verified,
        description
      ),
      listing_images (
        url,
        alt_text,
        sort_order
      )
    `)
    .eq("id", id)
    .eq("category", "gear")
    .maybeSingle();

  if (error || !item) {
    return <GearNotFoundScreen />;
  }

  const gear = item as unknown as GearDetail;
  const primaryImage = getMainListingImage(gear.listing_images);

  return (
    <div className="product-detail-page">
      {/* Breadcrumb Navigation */}
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <Link href="/gear">Gear Marketplace</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <span aria-current="page">{gear.title}</span>
      </nav>

      <div className="product-grid-layout">
        {/* Gallery Column */}
        <div className="product-gallery">
          <ListingImageGallery
            images={gear.listing_images}
            title={gear.title}
            cardClassName="product-main-img-card"
            imgClassName="product-main-img"
            placeholderClassName="product-main-img-placeholder"
            placeholderIcon="🤿"
            placeholderText="Certified Marine Equipment"
          />

          {/* Partner Trust Card */}
          {gear.partner_profiles && (
            <div className="partner-trust-card">
              <div className="partner-avatar" aria-hidden="true">⚓</div>
              <div className="partner-trust-info">
                <p className="partner-trust-name">
                  {gear.partner_profiles.business_name}
                  {gear.partner_profiles.verified && " ✓"}
                </p>
                <p className="partner-trust-sub">
                  {gear.partner_profiles.location || gear.location || "Authorized Distributor"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Information & Purchase Column */}
        <div className="product-info-col">
          <div className="product-meta-header">
            <div className="product-badge-row">
              <span className="product-cat-tag">Expedition Gear</span>
              {gear.difficulty && (
                <span className="product-partner-tag">Grade: {gear.difficulty}</span>
              )}
            </div>

            <h1 className="product-detail-title">{gear.title}</h1>

            {gear.location && (
              <div className="product-location-row">
                <span aria-hidden="true">📍</span> Ships / Available from: {gear.location}
              </div>
            )}
          </div>

          {/* Pricing Box */}
          <div className="product-pricing-card">
            <span className="section-label">Price</span>
            <p className="product-price-amount">
              {formatINR(gear.price_from)}
            </p>
            <p className="product-price-note">
              Price includes standard expedition warranty &bull; Taxes calculated at simulated checkout
            </p>
          </div>

          {/* Description */}
          <div className="product-description-wrap">
            <span className="section-label">Overview</span>
            <p className="product-desc-text">
              {gear.description ||
                "Engineered for deep-sea endurance and marine exploration. Built to international diving standards with corrosion-resistant finishes."}
            </p>
          </div>

          {/* Technical Specifications */}
          <div className="product-specs-card">
            <span className="section-label">Equipment Specs</span>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-name">Certification</span>
                <span className="spec-val">CE / EN 250 Certified</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Condition</span>
                <span className="spec-val">Brand New &bull; Inspected</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Dispatch</span>
                <span className="spec-val">Within 48 hours</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Stock Level</span>
                <span className="spec-val">
                  {(gear.stock_count ?? 10) > 0 ? `${gear.stock_count ?? 10} units in stock` : "Sold Out"}
                </span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Status</span>
                <span className="spec-val">{gear.status.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <AddToCartButton
            listingId={gear.id}
            productTitle={gear.title}
            price={Number(gear.price_from)}
            imageUrl={primaryImage?.url}
            stockCount={gear.stock_count ?? 10}
          />
        </div>
      </div>
    </div>
  );
}

function GearNotFoundScreen() {
  return (
    <div className="not-found-screen">
      <div className="not-found-icon" aria-hidden="true">🌊</div>
      <h1 className="not-found-title">Product Not Found</h1>
      <p className="not-found-desc">
        The equipment listing you requested does not exist, has been archived, or an invalid ID was provided.
      </p>
      <Link href="/gear" className="not-found-back-btn">
        &larr; Back to Gear Marketplace
      </Link>
    </div>
  );
}
