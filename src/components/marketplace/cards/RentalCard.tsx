import Link from "next/link";
import type { RentalListing } from "@/types/marketplace";
import ListingImage from "@/components/marketplace/shared/ListingImage";
import PriceDisplay from "@/components/marketplace/shared/PriceDisplay";
import ListingBadge, { PartnerBadge } from "@/components/marketplace/shared/ListingBadge";

export interface RentalCardProps {
  item: RentalListing;
}

export default function RentalCard({ item }: RentalCardProps) {
  return (
    <article className="rental-card">
      <Link
        href={`/rentals/${item.id}`}
        className="rental-card-img-wrap"
        style={{ display: "block", cursor: "pointer" }}
        aria-label={`Reserve ${item.title}`}
      >
        <ListingImage
          images={item.listing_images}
          title={item.title}
          fallbackIcon="⚓"
          imgClassName="rental-card-img"
          placeholderClassName="rental-card-img-placeholder"
        />

        <ListingBadge className="rental-card-tag">Rental</ListingBadge>

        <PartnerBadge
          businessName={item.partner_profiles?.business_name}
          className="rental-card-partner-badge"
        />
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
          <PriceDisplay
            amount={item.price_from}
            label="Daily Rate"
            suffix="/ day"
            labelClassName="rental-card-rate-label"
            className="rental-card-rate"
          />

          <Link href={`/rentals/${item.id}`} className="rental-card-view-btn">
            Reserve &rarr;
          </Link>
        </div>
      </div>
    </article>
  );
}
