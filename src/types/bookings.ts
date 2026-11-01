export interface OrderItem {
  id: string;
  title: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
}

export interface Order {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

export interface BookingListingImage {
  url: string;
  sort_order?: number | null;
}

export interface BookingListing {
  listing_images?: BookingListingImage[] | null;
}

export interface RentalBooking {
  id: string;
  listing_id?: string | null;
  listing_title: string;
  pickup_date: string;
  return_date: string;
  duration_days: number;
  daily_rate: number;
  rental_total: number;
  deposit_amount: number;
  quantity?: number;
  status: string;
  created_at: string;
  listings?: BookingListing | BookingListing[] | null;
}

export interface ExperienceBooking {
  id: string;
  listing_id?: string | null;
  listing_title: string;
  booking_date: string;
  guests: number;
  unit_price: number;
  total_amount: number;
  status: string;
  created_at: string;
  listings?: BookingListing | BookingListing[] | null;
}
