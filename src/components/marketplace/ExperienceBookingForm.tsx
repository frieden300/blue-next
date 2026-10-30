"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  confirmExperienceBookingAction,
  getExperienceSessionsAvailabilityAction,
  type SessionAvailabilityItem,
} from "@/app/explore/actions";
import { todayStr, tomorrowStr, formatDisplayDate } from "@/lib/utils/dates";
import { calculateExperienceTotal, formatINR } from "@/lib/utils/pricing";
import type { ExperienceSession } from "@/types/marketplace";

interface ExperienceBookingFormProps {
  listingId: string;
  listingTitle: string;
  unitPrice: number;
  maxCapacity?: number;
  initialSessions?: ExperienceSession[];
}

export default function ExperienceBookingForm({
  listingId,
  listingTitle,
  unitPrice,
  maxCapacity = 12,
  initialSessions = [],
}: ExperienceBookingFormProps) {
  const hasConfiguredSessions = Boolean(initialSessions && initialSessions.length > 0);

  const [bookingDate, setBookingDate] = useState(tomorrowStr);
  const [guests, setGuests] = useState(2);
  const [isPending, startTransition] = useTransition();
  const [dateError, setDateError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const [sessions, setSessions] = useState<SessionAvailabilityItem[]>(() => {
    if (!initialSessions) return [];
    return initialSessions.map((s) => ({
      sessionId: s.id,
      departureTime: s.departure_time,
      label: s.label ?? null,
      maxCapacity: s.max_capacity,
      bookedGuests: 0,
      availableSpots: s.max_capacity,
      isAvailable: s.status === "active",
    }));
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    if (!initialSessions || initialSessions.length === 0) return null;
    const firstActive = initialSessions.find((s) => s.status === "active");
    return firstActive?.id ?? initialSessions[0]?.id ?? null;
  });

  const [loadingSessions, setLoadingSessions] = useState(false);

  const [result, setResult] = useState<{
    bookingId: string;
    totalAmount: number;
    unitPrice: number;
    guests: number;
    departureTime?: string;
  } | null>(null);

  const totalAmount = calculateExperienceTotal(unitPrice, guests);

  // Fetch live session availability whenever booking date changes
  useEffect(() => {
    if (!hasConfiguredSessions || !bookingDate) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) setLoadingSessions(true);
    });

    getExperienceSessionsAvailabilityAction(listingId, bookingDate).then((res) => {
      if (cancelled) return;
      setLoadingSessions(false);
      if (res.sessions && res.sessions.length > 0) {
        setSessions(res.sessions);
        setSelectedSessionId((current) => {
          // Keep current if still valid, active, and fits the selected guests
          if (
            current &&
            res.sessions?.some(
              (s) => s.sessionId === current && s.isAvailable && s.availableSpots >= guests
            )
          ) {
            return current;
          }
          // Otherwise auto-select the first slot with enough capacity
          const firstFitting = res.sessions?.find(
            (s) => s.isAvailable && s.availableSpots >= guests
          );
          if (firstFitting) return firstFitting.sessionId;

          // Or the first slot that has any remaining capacity
          const firstWithSpots = res.sessions?.find(
            (s) => s.isAvailable && s.availableSpots > 0
          );
          if (firstWithSpots) return firstWithSpots.sessionId;

          // Fallback to first active session, or first session
          const firstActive = res.sessions?.find((s) => s.isAvailable);
          return firstActive ? firstActive.sessionId : res.sessions![0].sessionId;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [listingId, bookingDate, guests, hasConfiguredSessions]);

  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);

  const isSelectedSessionBookable =
    !hasConfiguredSessions ||
    (Boolean(selectedSession) &&
      Boolean(selectedSession?.isAvailable) &&
      (selectedSession?.availableSpots ?? 0) >= guests);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    setServerError(null);

    if (!bookingDate || bookingDate < todayStr()) {
      setDateError("Please select a booking date starting from today onwards.");
      return;
    }

    if (hasConfiguredSessions) {
      if (!selectedSessionId) {
        setServerError("Please select a departure time slot.");
        return;
      }
      if (!selectedSession) {
        setServerError("Selected departure time slot not found. Please choose an available slot.");
        return;
      }
      if (!selectedSession.isAvailable) {
        setServerError("The selected departure time slot is no longer active. Please choose another slot.");
        return;
      }
      if (selectedSession.availableSpots <= 0) {
        setServerError("The selected departure time slot is sold out. Please choose another slot.");
        return;
      }
      if (selectedSession.availableSpots < guests) {
        setServerError(
          `Selected session only has ${selectedSession.availableSpots} spot(s) remaining for ${guests} guest(s).`
        );
        return;
      }
    }

    startTransition(async () => {
      const res = await confirmExperienceBookingAction({
        listingId,
        listingTitle,
        bookingDate,
        guests,
        sessionId: hasConfiguredSessions ? selectedSessionId || undefined : undefined,
      });

      if (res.error) {
        if (res.error.toLowerCase().includes("signed in")) {
          setAuthRequired(true);
        } else {
          setServerError(res.error);
        }
        return;
      }

      if (res.success && res.bookingId) {
        setResult({
          bookingId: res.bookingId,
          totalAmount: res.totalAmount!,
          unitPrice: res.unitPrice!,
          guests: res.guests!,
          departureTime: selectedSession?.departureTime,
        });
      }
    });
  };

  /* ── Confirmed Receipt State ────────────────────────────────── */
  if (result) {
    return (
      <div className="rental-confirmed-card" style={{ width: "100%", margin: "0 auto" }}>
        <div className="rental-confirmed-icon" aria-hidden="true">✓</div>
        <p className="rental-confirmed-title">Experience Booking Confirmed!</p>
        <div className="rental-confirmed-details">
          <div className="rental-conf-row">
            <span>Experience</span>
            <span style={{ fontWeight: 600 }}>{listingTitle}</span>
          </div>
          <div className="rental-conf-row">
            <span>Date</span>
            <span>{formatDisplayDate(bookingDate)}</span>
          </div>
          {result.departureTime && (
            <div className="rental-conf-row">
              <span>Departure</span>
              <span>{result.departureTime.slice(0, 5)}</span>
            </div>
          )}
          <div className="rental-conf-row">
            <span>Guests</span>
            <span>{result.guests} {result.guests === 1 ? "person" : "people"}</span>
          </div>
          <div className="rental-conf-row">
            <span>Rate</span>
            <span>{formatINR(result.unitPrice)} / person</span>
          </div>
          <div className="rental-conf-divider" />
          <div className="rental-conf-row rental-conf-total">
            <span>Total Confirmed</span>
            <strong>{formatINR(result.totalAmount)}</strong>
          </div>
        </div>
        <p className="rental-conf-ref">Booking ref: <code>{result.bookingId}</code></p>
        <Link href="/bookings" className="rental-conf-link">
          View in My Bookings →
        </Link>
        <p className="demo-disclaimer-note">
          🔒 Demo booking — no payment processed. Academic presentation.
        </p>
      </div>
    );
  }

  /* ── Auth Required State ─────────────────────────────────────── */
  if (authRequired) {
    return (
      <div className="exp-book-section" style={{ textAlign: "center", alignItems: "center" }}>
        <div className="rental-confirmed-icon" style={{ fontSize: "28px", width: "48px", height: "48px", marginBottom: "8px" }} aria-hidden="true">
          🔒
        </div>
        <h3 style={{ fontSize: "17px", color: "var(--white)", fontWeight: 600, marginBottom: "4px" }}>
          Sign In to Book Experience
        </h3>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, marginBottom: "16px" }}>
          You need an active Blue account to make reservations and view them in My Bookings.
        </p>
        <Link
          href="/account/login"
          className="btn-book-exp"
          style={{ textDecoration: "none", textAlign: "center", display: "inline-block" }}
        >
          Sign In to Continue →
        </Link>
        <button
          type="button"
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "12px", cursor: "pointer", marginTop: "10px" }}
          onClick={() => setAuthRequired(false)}
        >
          ← Back to selection
        </button>
      </div>
    );
  }

  /* ── Booking Form State ──────────────────────────────────────── */
  return (
    <div className="exp-book-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--white)" }}>Reserve Your Spot</h3>
        <span style={{ fontSize: "12px", color: "var(--blue)" }}>Instant Demo Confirmation</span>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor={`exp-date-${listingId}`} style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Date
            </label>
            <input
              id={`exp-date-${listingId}`}
              type="date"
              min={todayStr()}
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                setDateError(null);
                setServerError(null);
              }}
              required
              style={{
                width: "100%",
                background: "rgba(3, 17, 28, 0.7)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                color: "var(--white)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor={`exp-guests-${listingId}`} style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
              Guests
            </label>
            <select
              id={`exp-guests-${listingId}`}
              value={guests}
              onChange={(e) => {
                setGuests(parseInt(e.target.value, 10));
                setServerError(null);
              }}
              style={{
                width: "100%",
                background: "rgba(3, 17, 28, 0.7)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                color: "var(--white)",
                fontSize: "13px",
                outline: "none",
              }}
            >
              {Array.from(
                {
                  length: Math.max(
                    1,
                    hasConfiguredSessions
                      ? selectedSession
                        ? Math.min(selectedSession.maxCapacity, 20)
                        : 12
                      : Math.min(maxCapacity, 20)
                  ),
                },
                (_, i) => i + 1
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "Guest" : "Guests"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Departure Slot Selector */}
        {hasConfiguredSessions ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
                Departure Slot
              </label>
              {loadingSessions && (
                <span style={{ fontSize: "11px", color: "var(--blue)" }}>Checking spots…</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(135px, 1fr))", gap: "8px" }}>
              {sessions.map((s) => {
                const isFull = s.availableSpots <= 0 || !s.isAvailable;
                const cannotFit = s.availableSpots < guests;
                const disabled = isFull || cannotFit;
                const isSelected = selectedSessionId === s.sessionId;

                return (
                  <button
                    key={s.sessionId || s.departureTime}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelectedSessionId(s.sessionId);
                      setServerError(null);
                    }}
                    style={{
                      padding: "9px 11px",
                      borderRadius: "10px",
                      border: isSelected ? "1.5px solid var(--blue)" : "1px solid var(--border)",
                      background: isSelected ? "rgba(14, 165, 233, 0.16)" : "rgba(3, 17, 28, 0.6)",
                      opacity: disabled ? 0.45 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      color: "var(--white)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>
                      ⏱ {s.departureTime.slice(0, 5)} {s.label ? `• ${s.label}` : ""}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: isFull ? "#f87171" : cannotFit ? "#fbbf24" : "var(--muted)",
                        marginTop: "3px",
                      }}
                    >
                      {isFull
                        ? "Sold Out"
                        : cannotFit
                        ? `Only ${s.availableSpots} spots left`
                        : `${s.availableSpots} spots open`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "11px", color: "var(--muted)", margin: 0 }}>
            ℹ️ Date-only reservation &bull; Daily capacity: up to {maxCapacity} guests
          </p>
        )}

        {dateError && (
          <p className="rental-date-error" role="alert" style={{ margin: 0 }}>{dateError}</p>
        )}
        {serverError && (
          <p className="rental-date-error" role="alert" style={{ margin: 0 }}>{serverError}</p>
        )}

        <div style={{
          background: "rgba(130, 217, 237, 0.04)",
          border: "1px solid rgba(130, 217, 237, 0.15)",
          borderRadius: "12px",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
            <span>Rate</span>
            <span>{formatINR(unitPrice)} × {guests} {guests === 1 ? "guest" : "guests"}</span>
          </div>
          <div style={{ height: "1px", background: "rgba(130, 217, 237, 0.12)", margin: "2px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--white)", fontWeight: 500 }}>Total</span>
            <strong style={{ fontSize: "17px", color: "var(--blue)", letterSpacing: "-0.01em" }}>
              {formatINR(totalAmount)}
            </strong>
          </div>
        </div>

        <button
          type="submit"
          className="btn-book-exp"
          disabled={isPending || !isSelectedSessionBookable}
          style={{
            display: "block",
            textAlign: "center",
            opacity: isPending || !isSelectedSessionBookable ? 0.6 : 1,
            cursor: isPending || !isSelectedSessionBookable ? "not-allowed" : "pointer",
          }}
        >
          {isPending
            ? "Booking Experience…"
            : hasConfiguredSessions && selectedSession && !selectedSession.isAvailable
            ? "Selected Slot Inactive"
            : hasConfiguredSessions && selectedSession && selectedSession.availableSpots <= 0
            ? "Selected Slot Sold Out"
            : hasConfiguredSessions && selectedSession && selectedSession.availableSpots < guests
            ? `Only ${selectedSession.availableSpots} Spot(s) Available`
            : hasConfiguredSessions && !selectedSession
            ? "Please Select a Departure Slot"
            : `Book This Experience — ${formatINR(totalAmount)}`}
        </button>

        <p className="exp-book-note" style={{ margin: 0 }}>
          🔒 Academic demonstration — reservation will be recorded to your profile under My Bookings without payment processing.
        </p>
      </form>
    </div>
  );
}
