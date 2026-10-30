import { describe, it, expect } from "vitest";
import { sortListingImages, getMainListingImage } from "../images";

describe("image utils", () => {
  describe("sortListingImages", () => {
    it("sorts images in ascending order by sort_order", () => {
      const images = [
        { url: "img3.jpg", sort_order: 3 },
        { url: "img1.jpg", sort_order: 1 },
        { url: "img2.jpg", sort_order: 2 },
      ];

      const sorted = sortListingImages(images);

      expect(sorted.map((img) => img.url)).toEqual(["img1.jpg", "img2.jpg", "img3.jpg"]);
    });

    it("guarantees that the original array remains unchanged (non-mutating)", () => {
      const original = [
        { url: "b.jpg", sort_order: 2 },
        { url: "a.jpg", sort_order: 1 },
      ];
      const copy = [...original];

      const sorted = sortListingImages(original);

      // Returned array is a new reference
      expect(sorted).not.toBe(original);
      // Original array maintains its original order
      expect(original[0].url).toBe(copy[0].url);
      expect(original[1].url).toBe(copy[1].url);
    });

    it("handles empty arrays", () => {
      expect(sortListingImages([])).toEqual([]);
    });

    it("handles null or undefined input safely", () => {
      expect(sortListingImages(null)).toEqual([]);
      expect(sortListingImages(undefined)).toEqual([]);
    });

    it("handles missing or null sort_order values according to current implementation", () => {
      // (a.sort_order ?? 0) - (b.sort_order ?? 0)
      const images = [
        { url: "with-2.jpg", sort_order: 2 },
        { url: "missing.jpg" },
        { url: "with-1.jpg", sort_order: 1 },
        { url: "null-order.jpg", sort_order: null },
      ];

      const sorted = sortListingImages(images);

      // Items with missing or null sort_order evaluate to 0 and precede items with positive sort_order
      expect(sorted[sorted.length - 1].url).toBe("with-2.jpg");
      expect(sorted[sorted.length - 2].url).toBe("with-1.jpg");
    });
  });

  describe("getMainListingImage", () => {
    it("returns the first image after ascending sort", () => {
      const images = [
        { url: "thumb3.jpg", sort_order: 3 },
        { url: "thumb1.jpg", sort_order: 0 },
        { url: "thumb2.jpg", sort_order: 1 },
      ];

      const main = getMainListingImage(images);
      expect(main?.url).toBe("thumb1.jpg");
    });

    it("returns undefined for empty, null, or undefined collections", () => {
      expect(getMainListingImage([])).toBeUndefined();
      expect(getMainListingImage(null)).toBeUndefined();
      expect(getMainListingImage(undefined)).toBeUndefined();
    });
  });
});
