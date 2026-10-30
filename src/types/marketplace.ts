export interface ListingImage {
  url: string;
  alt_text: string | null;
  sort_order: number;
}

export interface PartnerProfile {
  business_name: string;
  location: string | null;
  verified: boolean;
}

export interface Experience {
  id: string;
  title: string;
  category: string;
  subcategory?: string | null;
  description: string | null;
  location: string | null;
  price_from: number;
  duration_hours: number | null;
  difficulty: string | null;
  status: string;
  listing_images?: ListingImage[];
}

export interface GearListing {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  status: string;
  stock_count?: number;
  created_at: string;
  partner_profiles?: PartnerProfile | null;
  listing_images?: ListingImage[];
}

export interface RentalListing {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  price_from: number;
  duration_hours: number | null;
  status: string;
  inventory_count?: number;
  created_at: string;
  partner_profiles?: PartnerProfile | null;
  listing_images?: ListingImage[];
}
