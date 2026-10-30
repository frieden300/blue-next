import Link from "next/link";
import type { Experience } from "@/types/marketplace";
import ListingImage from "@/components/marketplace/shared/ListingImage";
import PriceDisplay from "@/components/marketplace/shared/PriceDisplay";
import ListingBadge from "@/components/marketplace/shared/ListingBadge";
import { EXPERIENCE_CATEGORY_LABELS } from "@/lib/constants/marketplace";
import { formatDurationHours } from "@/lib/utils/dates";

export interface ExperienceCardProps {
  exp: Experience;
}

export default function ExperienceCard({ exp }: ExperienceCardProps) {
  const durationLabel = formatDurationHours(exp.duration_hours);

  const catLabel = EXPERIENCE_CATEGORY_LABELS[exp.category] ?? exp.category;

  return (
    <article className="exp-card">
      {/* Image */}
      <Link
        href={`/explore/${exp.id}`}
        className="exp-card-img-wrap"
        style={{ display: "block", cursor: "pointer" }}
        aria-label={`View details for ${exp.title}`}
      >
        <ListingImage
          images={exp.listing_images}
          title={exp.title}
          fallbackIcon="🌊"
          imgClassName="exp-card-img"
          placeholderClassName="exp-card-img-placeholder"
        />

        {exp.difficulty && (
          <ListingBadge className={`difficulty-badge difficulty-${exp.difficulty}`}>
            {exp.difficulty.charAt(0).toUpperCase() + exp.difficulty.slice(1)}
          </ListingBadge>
        )}
        <ListingBadge className="exp-cat-pill">{catLabel}</ListingBadge>
      </Link>

      {/* Body */}
      <div className="exp-card-body">
        <h2 className="exp-card-title">{exp.title}</h2>

        {exp.location && (
          <p className="exp-card-location">
            <span aria-hidden="true">📍</span> {exp.location}
          </p>
        )}

        {exp.description && (
          <p className="exp-card-desc">{exp.description}</p>
        )}

        <div className="exp-card-meta">
          {durationLabel && <span>⏱ {durationLabel}</span>}
        </div>

        <div className="exp-card-footer">
          <PriceDisplay
            amount={exp.price_from}
            prefix="From "
            className="exp-card-price"
            prefixClassName="price-from"
          />
          <Link href={`/explore/${exp.id}`} className="exp-card-cta">
            View Experience →
          </Link>
        </div>
      </div>
    </article>
  );
}
