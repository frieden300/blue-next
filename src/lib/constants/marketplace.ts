export interface SubcategoryOption {
  value: string;
  label: string;
}

export const GEAR_SUBCATEGORIES: SubcategoryOption[] = [
  { value: "regulators", label: "Regulators & BCDs" },
  { value: "wetsuits", label: "Exposure Suits" },
  { value: "masks_fins", label: "Masks & Fins" },
  { value: "computers", label: "Dive Computers" },
  { value: "accessories", label: "Accessories" },
];

export const RENTAL_SUBCATEGORIES: SubcategoryOption[] = [
  { value: "kits", label: "Full Dive Kits" },
  { value: "tanks", label: "Cylinders & Tanks" },
  { value: "cameras", label: "Cameras & Drones" },
  { value: "scooters", label: "Scooters & DPV" },
  { value: "safety", label: "Safety & Lights" },
];

export const GEAR_PAGE_CATEGORIES = [
  { label: "All Gear", value: "all" },
  ...GEAR_SUBCATEGORIES,
];

export const RENTAL_PAGE_CATEGORIES = [
  { label: "All Rentals", value: "all" },
  ...RENTAL_SUBCATEGORIES,
];

export const SUBCAT_LABEL: Record<string, string> = {
  // Gear
  regulators: "Regulators & BCDs",
  regulator: "Regulators & BCDs",
  wetsuits: "Exposure Suits",
  wetsuit: "Exposure Suits",
  masks_fins: "Masks & Fins",
  masks: "Masks & Fins",
  fins: "Masks & Fins",
  computers: "Dive Computers",
  computer: "Dive Computers",
  accessories: "Accessories",
  accessory: "Accessories",

  // Rentals
  kits: "Full Dive Kits",
  kit: "Full Dive Kits",
  tanks: "Cylinders & Tanks",
  tank: "Cylinders & Tanks",
  cameras: "Cameras & Drones",
  camera: "Cameras & Drones",
  scooters: "Scooters & DPV",
  scooter: "Scooters & DPV",
  dpv: "Scooters & DPV",
  safety: "Safety & Lights",
  safety_lights: "Safety & Lights",
};

/**
 * Normalizes legacy, database, or alias subcategory strings to the canonical subcategory value.
 */
export function normalizeSubcategory(subcat: string | null | undefined): string {
  if (!subcat) return "";
  const s = subcat.toLowerCase().trim();
  if (["regulator", "regulators", "bcd"].includes(s)) return "regulators";
  if (["wetsuit", "wetsuits", "exposure", "thermal"].includes(s)) return "wetsuits";
  if (["mask", "masks", "fin", "fins", "masks_fins", "optics", "propulsion"].includes(s)) return "masks_fins";
  if (["computer", "computers"].includes(s)) return "computers";
  if (["accessory", "accessories"].includes(s)) return "accessories";

  if (["kit", "kits"].includes(s)) return "kits";
  if (["tank", "tanks", "cylinder", "cylinders"].includes(s)) return "tanks";
  if (["camera", "cameras", "drone", "drones"].includes(s)) return "cameras";
  if (["scooter", "scooters", "dpv"].includes(s)) return "scooters";
  if (["safety", "light", "lights", "safety_lights"].includes(s)) return "safety";

  return s;
}
