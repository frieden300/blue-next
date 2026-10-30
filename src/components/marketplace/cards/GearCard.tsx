import Link from "next/link";
import type { GearListing } from "@/types/marketplace";
import ListingImage from "@/components/marketplace/shared/ListingImage";
import PriceDisplay from "@/components/marketplace/shared/PriceDisplay";
import ListingBadge, { PartnerBadge } from "@/components/marketplace/shared/ListingBadge";

export interface GearCardProps {
  item: GearListing;
}

export default function GearCard({ item }: GearCardProps) {
  const stock = item.stock_count ?? 10;
  const isSoldOut = stock <= 0;
  const isLowStock = stock > 0 && stock <= 3;

  return (
    <article className="gear-card" style={isSoldOut ? { opacity: 0.85 } : undefined}>
      <Link
        href={`/gear/${item.id}`}
        className="gear-card-img-wrap"
        style={{ display: "block", cursor: "pointer" }}
        aria-label={`View details for ${item.title}`}
      >
        <ListingImage
          images={item.listing_images}
          title={item.title}
          fallbackIcon="🤿"
          imgClassName="gear-card-img"
          placeholderClassName="gear-card-img-placeholder"
        />

        {isSoldOut ? (
          <ListingBadge
            className="gear-card-tag"
            style={{ background: "rgba(220, 38, 38, 0.9)", color: "#fff" }}
          >
            Sold Out
          </ListingBadge>
        ) : isLowStock ? (
          <ListingBadge
            className="gear-card-tag"
            style={{ background: "rgba(217, 119, 6, 0.9)", color: "#fff" }}
          >
            Only {stock} Left
          </ListingBadge>
        ) : (
          <ListingBadge className="gear-card-tag">In Stock</ListingBadge>
        )}

        <PartnerBadge
          businessName={item.partner_profiles?.business_name}
          className="gear-card-partner-badge"
        />
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
          <PriceDisplay
            amount={item.price_from}
            label="Price"
            labelClassName="gear-card-price-label"
            className="gear-card-price"
          />

          <Link href={`/gear/${item.id}`} className="gear-card-view-btn">
            {isSoldOut ? "Details →" : "Buy Now →"}
          </Link>
        </div>
      </div>
    </article>
  );
}
