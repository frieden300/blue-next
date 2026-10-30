import type { ListingImage as ListingImageType } from "@/types/marketplace";

export interface ListingImageProps {
  images?: ListingImageType[] | null;
  title: string;
  fallbackIcon: string;
  imgClassName?: string;
  placeholderClassName?: string;
}

export default function ListingImage({
  images,
  title,
  fallbackIcon,
  imgClassName = "card-img",
  placeholderClassName = "card-img-placeholder",
}: ListingImageProps) {
  const sorted = images?.slice().sort((a, b) => a.sort_order - b.sort_order);
  const mainImage = sorted?.[0];

  if (mainImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mainImage.url}
        alt={mainImage.alt_text || title}
        className={imgClassName}
        loading="lazy"
      />
    );
  }

  return (
    <div className={placeholderClassName} aria-hidden="true">
      {fallbackIcon}
    </div>
  );
}
