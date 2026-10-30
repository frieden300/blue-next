export interface ListingImage {
  id?: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
}

export interface PartnerProfile {
  id?: string;
  business_name: string;
  location: string | null;
  verified: boolean;
  description?: string | null;
  service_types?: string[];
}

export interface ExperienceSession {
  id: string;
  departure_time: string;
  max_capacity: number;
  label?: string | null;
  status: "active" | "inactive";
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
  max_capacity?: number;
  listing_images?: ListingImage[];
}

export interface ExperienceDetail extends Experience {
  max_capacity: number;
  partner_profiles?: PartnerProfile | null;
  experience_sessions?: ExperienceSession[];
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

export interface GearDetail extends GearListing {
  difficulty?: string | null;
  duration_hours?: number | null;
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

export interface RentalDetail extends RentalListing {
  difficulty?: string | null;
}
