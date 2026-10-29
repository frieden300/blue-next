import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import RentalBookingForm from "@/components/marketplace/RentalBookingForm";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ListingImageGallery from "@/components/marketplace/ListingImageGallery";
import "../rentals.css";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ListingImage {
  url: string;
  alt_text: string | null;
  sort_order: number;
}

interface PartnerProfile {
  business_name: string;
  location: string | null;
  verified: boolean;
  description: string | null;
}

interface RentalDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  duration_hours: number | null;
  status: string;
  difficulty: string | null;
  created_at: string;
  inventory_count?: number;
  partner_profiles?: PartnerProfile | null;
  listing_images?: ListingImage[];
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!UUID_REGEX.test(id)) {
    return { title: "Rental Not Found — BLUE" };
  }

  await connection();

  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("title")
    .eq("id", id)
    .eq("category", "rental")
    .maybeSingle();

  return {
    title: data?.title ? `${data.title} — BLUE Rentals` : "Rental Details — BLUE",
    description: "Expedition rental equipment details and reservation rates.",
  };
}

export default function RentalDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <>
      <SiteHeader />

      <main className="rentals-main">
        <Suspense fallback={<RentalDetailLoading />}>
          <RentalDetailContent params={props.params} />
        </Suspense>
      </main>

      <SiteFooter />
    </>
  );
}

function RentalDetailLoading() {
  return (
    <div className="rental-detail-page">
      <div className="not-found-screen">
        <div className="not-found-icon" aria-hidden="true">⚓</div>
        <h1 className="not-found-title">Loading Rental Gear...</h1>
        <p className="not-found-desc">Fetching rental rates, maintenance logs, and equipment specs.</p>
      </div>
    </div>
  );
}

async function RentalDetailContent(props: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await props.params;

  // Gracefully handle invalid UUIDs before querying Supabase
  if (!UUID_REGEX.test(id)) {
    return <RentalNotFoundScreen />;
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
      duration_hours,
      status,
      difficulty,
      inventory_count,
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
    .eq("category", "rental")
    .maybeSingle();

  if (error || !item) {
    return <RentalNotFoundScreen />;
  }

  const rental = item as unknown as RentalDetail;

  return (
    <div className="rental-detail-page">
      {/* Breadcrumb Navigation */}
      <nav className="rental-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <Link href="/rentals">Equipment Rentals</Link>
        <span className="breadcrumb-sep">&gt;</span>
        <span aria-current="page">{rental.title}</span>
      </nav>

      <div className="rental-grid-layout">
        {/* Gallery & Operator Info Column */}
        <div className="rental-gallery">
          <ListingImageGallery
            images={rental.listing_images}
            title={rental.title}
            cardClassName="rental-main-img-card"
            imgClassName="rental-main-img"
            placeholderClassName="rental-main-img-placeholder"
            placeholderIcon="⚓"
            placeholderText="Certified Rental Equipment"
          />

          {/* Partner Dive Shop Info */}
          {rental.partner_profiles && (
            <div className="rental-partner-card">
              <div className="rental-partner-avatar" aria-hidden="true">🤿</div>
              <div className="rental-partner-info">
                <p className="rental-partner-name">
                  {rental.partner_profiles.business_name}
                  {rental.partner_profiles.verified && " ✓"}
                </p>
                <p className="rental-partner-sub">
                  {rental.partner_profiles.location || rental.location || "Certified Outfitter"} &bull; Verified Partner
                </p>
                {rental.partner_profiles.description && (
                  <p className="rental-partner-desc">
                    {rental.partner_profiles.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pricing & Booking Reservation Column */}
        <div className="rental-info-col">
          <div className="rental-meta-header">
            <div className="rental-badge-row">
              <span className="rental-tag-pill">Rental Equipment</span>
              {rental.difficulty && (
                <span className="rental-level-pill">Grade: {rental.difficulty}</span>
              )}
            </div>

            <h1 className="rental-detail-title">{rental.title}</h1>

            {rental.location && (
              <div className="rental-location-row">
                <span aria-hidden="true">📍</span> Depot Location: {rental.location}
              </div>
            )}
          </div>

          {/* Rate Display */}
          <div className="rental-rate-card">
            <span className="section-label">Rental Rate</span>
            <div className="rental-rate-display">
              <span className="rental-rate-num">
                ₹{Number(rental.price_from).toLocaleString("en-IN")}
              </span>
              <span className="rental-rate-unit"> / calendar day</span>
            </div>
            <p className="rental-rate-note">
              Damage protection deposit calculated at counter &bull; Flexible returns
            </p>
          </div>

          {/* Overview & Description */}
          <div className="rental-desc-box">
            <span className="section-label">Equipment Overview</span>
            <p className="rental-desc-text">
              {rental.description ||
                "Professional-grade rental equipment maintained to the highest safety and hydrostatic testing standards. Inspected before and after each journey."}
            </p>
          </div>

          {/* Technical Specifications */}
          <div className="rental-specs-card">
            <span className="section-label">Rental Details</span>
            <div className="specs-grid">
              <div className="spec-item">
                <span className="spec-name">Maintenance</span>
                <span className="spec-val">Hydrostatic &amp; VIP Tested</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Sanitization</span>
                <span className="spec-val">Hospital-grade Disinfected</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Pickup Hours</span>
                <span className="spec-val">08:00 &mdash; 18:00 Daily</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Fleet Inventory</span>
                <span className="spec-val">{rental.inventory_count ?? 5} units total</span>
              </div>
              <div className="spec-item">
                <span className="spec-name">Status</span>
                <span className="spec-val">Available for Reservation</span>
              </div>
            </div>
          </div>

          {/* Interactive Reservation Calculator */}
          <RentalBookingForm
            listingId={rental.id}
            rentalTitle={rental.title}
            dailyRate={Number(rental.price_from)}
            inventoryCount={rental.inventory_count ?? 5}
          />
        </div>
      </div>
    </div>
  );
}

function RentalNotFoundScreen() {
  return (
    <div className="not-found-screen">
      <div className="not-found-icon" aria-hidden="true">🌊</div>
      <h1 className="not-found-title">Rental Item Not Found</h1>
      <p className="not-found-desc">
        The rental equipment listing you requested does not exist, has been paused, or an invalid ID was provided.
      </p>
      <Link href="/rentals" className="not-found-back-btn">
        &larr; Back to Equipment Rentals
      </Link>
    </div>
  );
}
