import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CancelBookingButton from "@/components/marketplace/CancelBookingButton";
import { formatDisplayDate } from "@/lib/utils/dates";
import { formatINR } from "@/lib/utils/pricing";
import type {
  Order,
  RentalBooking,
  ExperienceBooking,
} from "@/types/bookings";
import "./bookings.css";

export const metadata = {
  title: "My Bookings — BLUE",
  description: "View your confirmed gear orders, rental bookings, and experience reservations.",
};

export default function BookingsPage() {
  return (
    <>
      <SiteHeader />
      <main className="bookings-main">
        <Suspense fallback={<BookingsLoading />}>
          <BookingsContent />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

function BookingsLoading() {
  return (
    <div className="bookings-page">
      <div className="bookings-hero">
        <p className="bookings-kicker">MY ACCOUNT — BLUE</p>
        <h1 className="bookings-heading">My <em>Bookings</em></h1>
        <p className="bookings-sub" style={{ color: "var(--muted)" }}>Loading your orders and reservations…</p>
      </div>
    </div>
  );
}

/* ── Main content ───────────────────────────────────────────────── */
async function BookingsContent() {
  await connection();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="bookings-gateway">
        <div className="bookings-gateway-icon" aria-hidden="true">🎟️</div>
        <h1 className="bookings-heading">My <em>Bookings</em></h1>
        <p className="bookings-sub">
          Sign in to view your confirmed gear orders, rental reservations, and experience bookings.
        </p>
        <div className="bookings-auth-btns">
          <Link href="/account/login" className="bookings-btn-primary">Sign In →</Link>
          <Link href="/account/signup" className="bookings-btn-secondary">Create Account</Link>
        </div>
      </div>
    );
  }

  // Fetch orders, rental bookings, and experience bookings concurrently
  const [ordersRes, rentalsRes, experiencesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, status, total_amount, created_at,
        order_items ( id, title, unit_price, quantity, image_url )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("rental_bookings")
      .select(`
        id, listing_title, pickup_date, return_date,
        duration_days, daily_rate, rental_total, deposit_amount,
        quantity, status, created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("experience_bookings")
      .select(`
        id, listing_title, booking_date, guests,
        unit_price, total_amount, status, created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as Order[];
  const rentals = (rentalsRes.data ?? []) as unknown as RentalBooking[];
  const experiences = (experiencesRes.data ?? []) as unknown as ExperienceBooking[];
  const hasAny = orders.length > 0 || rentals.length > 0 || experiences.length > 0;

  return (
    <div className="bookings-page">
      {/* Hero */}
      <div className="bookings-hero">
        <p className="bookings-kicker">MY ACCOUNT — BLUE</p>
        <h1 className="bookings-heading">My <em>Bookings</em></h1>
        <p className="bookings-sub">
          Your confirmed orders and rental reservations.
        </p>
      </div>

      {!hasAny ? (
        <div className="bookings-empty">
          <div className="bookings-empty-icon" aria-hidden="true">🌊</div>
          <h2 className="bookings-empty-title">No bookings yet</h2>
          <p className="bookings-empty-sub">
            Book an ocean experience, add gear to your cart, or make a rental reservation to see your bookings here.
          </p>
          <div className="bookings-empty-links">
            <Link href="/explore" className="bookings-btn-primary">Explore Experiences →</Link>
            <Link href="/gear" className="bookings-btn-secondary">Browse Gear</Link>
            <Link href="/rentals" className="bookings-btn-secondary">View Rentals</Link>
          </div>
        </div>
      ) : (
        <div className="bookings-sections">
          {/* ── Experience Reservations ──────────────────────────── */}
          {experiences.length > 0 && (
            <section className="bookings-section" aria-labelledby="experiences-heading">
              <h2 id="experiences-heading" className="bookings-section-title">
                <span aria-hidden="true">🌊</span> Experience Reservations
              </h2>
              <div className="bookings-list">
                {experiences.map((exp) => (
                  <div key={exp.id} className="booking-card">
                    <div className="booking-card-header">
                      <div>
                        <p className="booking-card-label">Experience</p>
                        <p className="booking-card-ref rental-card-title">{exp.listing_title}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <span className={`booking-status-badge status-${exp.status}`}>
                          {exp.status}
                        </span>
                        <CancelBookingButton type="experience" id={exp.id} status={exp.status} />
                      </div>
                    </div>

                    <div className="rental-booking-details">
                      <div className="rental-detail-row">
                        <span>Date</span>
                        <span>{formatDisplayDate(exp.booking_date)}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Guests</span>
                        <span>{exp.guests} {exp.guests !== 1 ? "people" : "person"}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Rate</span>
                        <span>{formatINR(Number(exp.unit_price))} / person</span>
                      </div>
                      <div className="rental-detail-divider" />
                      <div className="rental-detail-row rental-detail-total">
                        <span>Total</span>
                        <strong>{formatINR(Number(exp.total_amount))}</strong>
                      </div>
                    </div>

                    <div className="booking-card-footer">
                      <span className="booking-date">
                        Reserved {formatDisplayDate(exp.created_at)}
                      </span>
                      <span className="booking-ref-small">ref: {exp.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Gear Orders ─────────────────────────────────────── */}
          {orders.length > 0 && (
            <section className="bookings-section" aria-labelledby="orders-heading">
              <h2 id="orders-heading" className="bookings-section-title">
                <span aria-hidden="true">🤿</span> Gear Orders
              </h2>
              <div className="bookings-list">
                {orders.map((order) => (
                  <div key={order.id} className="booking-card">
                    <div className="booking-card-header">
                      <div>
                        <p className="booking-card-label">Order</p>
                        <p className="booking-card-ref">{order.id.slice(0, 8)}…</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <span className={`booking-status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                        <CancelBookingButton type="order" id={order.id} status={order.status} />
                      </div>
                    </div>

                    <ul className="booking-items-list">
                      {order.order_items.map((item) => (
                        <li key={item.id} className="booking-item-row">
                          {item.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="booking-item-thumb"
                            />
                          )}
                          <div className="booking-item-info">
                            <p className="booking-item-title">{item.title}</p>
                            <p className="booking-item-meta">
                              {formatINR(Number(item.unit_price))} × {item.quantity}
                            </p>
                          </div>
                          <p className="booking-item-sub">
                            {formatINR(Number(item.unit_price) * item.quantity)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <div className="booking-card-footer">
                      <span className="booking-date">
                        {formatDisplayDate(order.created_at)}
                      </span>
                      <span className="booking-total">
                        Total: <strong>{formatINR(Number(order.total_amount))}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Rental Bookings ──────────────────────────────────── */}
          {rentals.length > 0 && (
            <section className="bookings-section" aria-labelledby="rentals-heading">
              <h2 id="rentals-heading" className="bookings-section-title">
                <span aria-hidden="true">⚓</span> Equipment Rentals
              </h2>
              <div className="bookings-list">
                {rentals.map((rental) => (
                  <div key={rental.id} className="booking-card">
                    <div className="booking-card-header">
                      <div>
                        <p className="booking-card-label">Rental</p>
                        <p className="booking-card-ref rental-card-title">{rental.listing_title}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                        <span className={`booking-status-badge status-${rental.status}`}>
                          {rental.status}
                        </span>
                        <CancelBookingButton type="rental" id={rental.id} status={rental.status} />
                      </div>
                    </div>

                    <div className="rental-booking-details">
                      <div className="rental-detail-row">
                        <span>Units</span>
                        <span>{rental.quantity ?? 1} unit{(rental.quantity ?? 1) !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Pickup</span>
                        <span>{formatDisplayDate(rental.pickup_date)}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Return</span>
                        <span>{formatDisplayDate(rental.return_date)}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Duration</span>
                        <span>{rental.duration_days} day{rental.duration_days !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Rental Cost</span>
                        <span>{formatINR(Number(rental.rental_total))}</span>
                      </div>
                      <div className="rental-detail-row">
                        <span>Deposit</span>
                        <span>{formatINR(Number(rental.deposit_amount))}</span>
                      </div>
                      <div className="rental-detail-divider" />
                      <div className="rental-detail-row rental-detail-total">
                        <span>Total</span>
                        <strong>{formatINR(Number(rental.rental_total) + Number(rental.deposit_amount))}</strong>
                      </div>
                    </div>

                    <div className="booking-card-footer">
                      <span className="booking-date">
                        Booked {formatDisplayDate(rental.created_at)}
                      </span>
                      <span className="booking-ref-small">ref: {rental.id.slice(0, 8)}…</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
