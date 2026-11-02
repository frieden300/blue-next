import { Suspense } from "react";
import { connection } from "next/server";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CancelBookingButton from "@/components/marketplace/CancelBookingButton";
import {
  formatDisplayDate,
  formatDurationHours,
  formatTime12h,
  formatValidTime12h,
  getTodayISO,
  extractBookingDurationHours,
  getExperienceBookingStatus,
  getRentalBookingStatus,
} from "@/lib/utils/dates";
import { formatINR } from "@/lib/utils/pricing";
import { getBookingFirstImage } from "@/lib/utils/images";
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

/**
 * Safely resolves the true departure time for an experience booking.
 * Ensures that if a partner added a slot label (e.g. "Afternoon" or "Sunset"),
 * only the actual departure time (e.g. "02:00 PM") is displayed in My Bookings,
 * never the arbitrary slot label.
 */
function getExperienceBookingTime(exp: ExperienceBooking): string | null {
  // 1. Direct foreign key relation to experience_sessions
  const directSession = Array.isArray(exp.experience_sessions)
    ? exp.experience_sessions[0]
    : exp.experience_sessions;
  if (directSession?.departure_time) {
    const formatted = formatValidTime12h(directSession.departure_time);
    if (formatted) return formatted;
  }

  // 2. If exp.departure_time itself is already a valid time string
  const validExpTime = formatValidTime12h(exp.departure_time);
  if (validExpTime) {
    return validExpTime;
  }

  // 3. Fallback: match session on joined listing relation
  const listingObj = Array.isArray(exp.listings) ? exp.listings[0] : exp.listings;
  const listingSessions = listingObj?.experience_sessions;
  if (Array.isArray(listingSessions) && listingSessions.length > 0) {
    if (exp.session_id) {
      const matchById = listingSessions.find((s) => s.id === exp.session_id);
      if (matchById?.departure_time) {
        const formatted = formatValidTime12h(matchById.departure_time);
        if (formatted) return formatted;
      }
    }
    if (exp.departure_time) {
      const matchByLabel = listingSessions.find(
        (s) => s.label?.trim().toLowerCase() === exp.departure_time?.trim().toLowerCase()
      );
      if (matchByLabel?.departure_time) {
        const formatted = formatValidTime12h(matchByLabel.departure_time);
        if (formatted) return formatted;
      }
    }
  }

  // If nothing parses as a valid time, return null (never display text labels as Time)
  return null;
}

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
        id, listing_id, listing_title, pickup_date, return_date,
        duration_days, daily_rate, rental_total, deposit_amount,
        quantity, status, created_at,
        listings (
          listing_images ( url, sort_order )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("experience_bookings")
      .select(`
        id, listing_id, listing_title, booking_date, departure_time, session_id, guests,
        unit_price, total_amount, status, created_at,
        listings (
          duration_hours,
          listing_images ( url, sort_order ),
          experience_sessions ( id, departure_time, label )
        ),
        experience_sessions (
          id,
          departure_time,
          label
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const orders = (ordersRes.data ?? []) as unknown as Order[];
  const rentals = (rentalsRes.data ?? []) as unknown as RentalBooking[];
  const experiences = (experiencesRes.data ?? []) as unknown as ExperienceBooking[];
  const hasAny = orders.length > 0 || rentals.length > 0 || experiences.length > 0;
  const today = getTodayISO();
  const now = new Date();

  // Sort experiences: active in session first (0), upcoming confirmed (1), completed (2), cancelled (3)
  const sortedExperiences = [...experiences].sort((a, b) => {
    const durationA = extractBookingDurationHours(a.listings);
    const durationB = extractBookingDurationHours(b.listings);
    const timeA = getExperienceBookingTime(a);
    const timeB = getExperienceBookingTime(b);
    const statusA = getExperienceBookingStatus({ ...a, departure_time: timeA, duration_hours: durationA }, today, now);
    const statusB = getExperienceBookingStatus({ ...b, departure_time: timeB, duration_hours: durationB }, today, now);

    const rank = (status: typeof statusA.displayStatus) => {
      if (status === "active") return 0;
      if (status === "confirmed") return 1;
      if (status === "completed") return 2;
      return 3; // cancelled
    };

    const rankA = rank(statusA.displayStatus);
    const rankB = rank(statusB.displayStatus);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (rankA <= 1) {
      if (a.booking_date !== b.booking_date) {
        return a.booking_date.localeCompare(b.booking_date);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (a.booking_date !== b.booking_date) {
      return b.booking_date.localeCompare(a.booking_date);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Sort rentals: active in use first (0), upcoming confirmed (1), completed (2), cancelled (3)
  const sortedRentals = [...rentals].sort((a, b) => {
    const statusA = getRentalBookingStatus(a, today);
    const statusB = getRentalBookingStatus(b, today);

    const rank = (status: typeof statusA.displayStatus) => {
      if (status === "active") return 0;
      if (status === "confirmed") return 1;
      if (status === "completed") return 2;
      return 3; // cancelled
    };

    const rankA = rank(statusA.displayStatus);
    const rankB = rank(statusB.displayStatus);

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    if (rankA <= 1) {
      if (a.pickup_date !== b.pickup_date) {
        return a.pickup_date.localeCompare(b.pickup_date);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (a.return_date !== b.return_date) {
      return b.return_date.localeCompare(a.return_date);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Sort orders: confirmed first, then cancelled, newest created first
  const sortedOrders = [...orders].sort((a, b) => {
    const rankA = a.status === "confirmed" ? 0 : 1;
    const rankB = b.status === "confirmed" ? 0 : 1;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
          {sortedExperiences.length > 0 && (
            <section className="bookings-section" aria-labelledby="experiences-heading">
              <h2 id="experiences-heading" className="bookings-section-title">
                <span aria-hidden="true">🌊</span> Experience Reservations
              </h2>
              <div className="bookings-list">
                {sortedExperiences.map((exp) => {
                  const displayTime = getExperienceBookingTime(exp);
                  const firstImage = getBookingFirstImage(exp);
                  const durationHours = extractBookingDurationHours(exp.listings);
                  const lifecycle = getExperienceBookingStatus(
                    { ...exp, departure_time: displayTime, duration_hours: durationHours },
                    today,
                    now
                  );
                  const durationLabel = formatDurationHours(durationHours);

                  return (
                    <div key={exp.id} className="booking-card">
                      <div className="booking-card-header">
                        <div className="booking-card-title-group">
                          {firstImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={firstImage}
                              alt={exp.listing_title}
                              className="booking-item-thumb"
                            />
                          )}
                          <div>
                            <p className="booking-card-label">Experience</p>
                            <p className="booking-card-ref rental-card-title">{exp.listing_title}</p>
                          </div>
                        </div>
                        <div className="booking-card-actions">
                          <span className={`booking-status-badge ${lifecycle.badgeClass}`}>
                            {lifecycle.badgeLabel}
                          </span>
                          {lifecycle.canCancel && (
                            <CancelBookingButton type="experience" id={exp.id} status={exp.status} />
                          )}
                          {lifecycle.displayStatus === "completed" && (
                            <Link
                              href={exp.listing_id ? `/explore/${exp.listing_id}` : "/explore"}
                              className="booking-action-link"
                            >
                              Book Again ↗
                            </Link>
                          )}
                        </div>
                      </div>

                    <div className="rental-booking-details">
                      <div className="rental-detail-row">
                        <span>Date</span>
                        <span>{formatDisplayDate(exp.booking_date)}</span>
                      </div>
                      {displayTime && (
                        <div className="rental-detail-row">
                          <span>Time</span>
                          <span>{displayTime}</span>
                        </div>
                      )}
                      {durationLabel && (
                        <div className="rental-detail-row">
                          <span>Duration</span>
                          <span>{durationLabel}</span>
                        </div>
                      )}
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
                );
              })}
              </div>
            </section>
          )}

          {/* ── Gear Orders ─────────────────────────────────────── */}
          {sortedOrders.length > 0 && (
            <section className="bookings-section" aria-labelledby="orders-heading">
              <h2 id="orders-heading" className="bookings-section-title">
                <span aria-hidden="true">🤿</span> Gear Orders
              </h2>
              <div className="bookings-list">
                {sortedOrders.map((order) => (
                  <div key={order.id} className="booking-card">
                    <div className="booking-card-header">
                      <div>
                        <p className="booking-card-label">Order</p>
                        <p className="booking-card-ref">{order.id.slice(0, 8)}…</p>
                      </div>
                      <div className="booking-card-actions">
                        <span className={`booking-status-badge status-${order.status}`}>
                          {order.status}
                        </span>
                        {order.status === "confirmed" && (
                          <CancelBookingButton type="order" id={order.id} status={order.status} />
                        )}
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
          {sortedRentals.length > 0 && (
            <section className="bookings-section" aria-labelledby="rentals-heading">
              <h2 id="rentals-heading" className="bookings-section-title">
                <span aria-hidden="true">⚓</span> Equipment Rentals
              </h2>
              <div className="bookings-list">
                {sortedRentals.map((rental) => {
                  const firstImage = getBookingFirstImage(rental);
                  const lifecycle = getRentalBookingStatus(rental, today);

                  return (
                    <div key={rental.id} className="booking-card">
                      <div className="booking-card-header">
                        <div className="booking-card-title-group">
                          {firstImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={firstImage}
                              alt={rental.listing_title}
                              className="booking-item-thumb"
                            />
                          )}
                          <div>
                            <p className="booking-card-label">Rental</p>
                            <p className="booking-card-ref rental-card-title">{rental.listing_title}</p>
                          </div>
                        </div>
                        <div className="booking-card-actions">
                          <span className={`booking-status-badge ${lifecycle.badgeClass}`}>
                            {lifecycle.badgeLabel}
                          </span>
                          {lifecycle.canCancel && (
                            <CancelBookingButton type="rental" id={rental.id} status={rental.status} />
                          )}
                          {lifecycle.displayStatus === "completed" && (
                            <Link
                              href={rental.listing_id ? `/rentals/${rental.listing_id}` : "/rentals"}
                              className="booking-action-link"
                            >
                              Rent Again ↗
                            </Link>
                          )}
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
                );
              })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

