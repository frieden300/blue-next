/**
 * Returns a sorted copy of listing images in ascending order by sort_order.
 * Guarantees immutability by slicing before sorting.
 */
export function sortListingImages<T extends { sort_order?: number | null }>(
  images?: T[] | null
): T[] {
  if (!images || images.length === 0) return [];
  return images
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Returns the primary (first sorted) image from a collection of listing images.
 */
export function getMainListingImage<T extends { sort_order?: number | null }>(
  images?: T[] | null
): T | undefined {
  const sorted = sortListingImages(images);
  return sorted[0];
}
