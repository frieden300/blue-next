"use client";

import { useState } from "react";

export interface GalleryImage {
  id?: string;
  url: string;
  alt_text?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

interface Props {
  images?: GalleryImage[] | null;
  fallbackUrl?: string;
  title: string;
  cardClassName?: string;
  imgClassName?: string;
  placeholderClassName?: string;
  placeholderIcon?: string;
  placeholderText?: string;
  badge?: React.ReactNode;
}

export default function ListingImageGallery({
  images,
  fallbackUrl,
  title,
  cardClassName = "exp-detail-img-card",
  imgClassName = "exp-detail-img",
  placeholderClassName = "exp-detail-img-placeholder",
  placeholderIcon = "🌊",
  placeholderText = "Demo Experience",
  badge,
}: Props) {
  // Sort images: sort_order ASC, then by created_at / index
  const sortedImages = (images || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [activeIndex, setActiveIndex] = useState(0);

  // If activeIndex is out of range due to prop changes, clamp it
  const currentIndex = sortedImages.length > 0 ? Math.min(activeIndex, sortedImages.length - 1) : 0;
  const currentImage = sortedImages[currentIndex];
  const hasMultiple = sortedImages.length > 1;

  function handlePrev() {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1));
  }

  function handleNext() {
    setActiveIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0));
  }

  return (
    <div className="listing-gallery-container" style={{ width: "100%" }}>
      {/* Main image hero card */}
      <div className={cardClassName} style={{ position: "relative" }}>
        {currentImage?.url || fallbackUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImage?.url || fallbackUrl}
            alt={currentImage?.alt_text || title}
            className={imgClassName}
          />
        ) : (
          <div className={placeholderClassName} aria-hidden="true">
            {placeholderIcon}
            <span>{placeholderText}</span>
          </div>
        )}

        {/* Optional overlay badge */}
        {badge}

        {/* Prev / Next controls */}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous photo"
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(2, 10, 17, 0.7)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                cursor: "pointer",
                zIndex: 2,
                transition: "background 0.2s, transform 0.2s",
              }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next photo"
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "rgba(2, 10, 17, 0.7)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                cursor: "pointer",
                zIndex: 2,
                transition: "background 0.2s, transform 0.2s",
              }}
            >
              ›
            </button>

            {/* Photo counter pill */}
            <div
              style={{
                position: "absolute",
                bottom: "12px",
                right: "12px",
                background: "rgba(2, 10, 17, 0.8)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(130, 217, 237, 0.3)",
                color: "var(--blue, #82d9ed)",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "4px 10px",
                borderRadius: "999px",
                zIndex: 2,
              }}
            >
              {currentIndex + 1} / {sortedImages.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div
          className="listing-gallery-thumbs"
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "12px",
            overflowX: "auto",
            paddingBottom: "4px",
            scrollbarWidth: "thin",
          }}
        >
          {sortedImages.map((img, idx) => {
            const isActive = idx === currentIndex;
            return (
              <button
                key={img.id || `${img.url}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`View photo ${idx + 1}`}
                style={{
                  position: "relative",
                  width: "72px",
                  height: "54px",
                  flexShrink: 0,
                  borderRadius: "10px",
                  overflow: "hidden",
                  padding: 0,
                  border: isActive
                    ? "2px solid var(--blue, #38bdf8)"
                    : "2px solid rgba(255, 255, 255, 0.12)",
                  background: "#020a11",
                  opacity: isActive ? 1 : 0.6,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt_text || `Thumbnail ${idx + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
