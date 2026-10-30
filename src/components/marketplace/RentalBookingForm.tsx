"use client";

import { useState, useTransition, useEffect } from "react";
import { confirmRentalBookingAction, checkRentalAvailabilityAction } from "@/app/rentals/actions";
import { todayStr, tomorrowStr, calculateRentalDays, formatDisplayDate } from "@/lib/utils/dates";
import { calculateRentalPricing, formatINR } from "@/lib/utils/pricing";

interface RentalBookingFormProps {
  listingId: string;
  rentalTitle: string;
  dailyRate: number;
  inventoryCount?: number;
}

export default function RentalBookingForm({
  listingId,
  rentalTitle,
  dailyRate,
  inventoryCount = 5,
}: RentalBookingFormProps) {
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(tomorrowStr);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [dateError, setDateError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    bookingId: string;
    rentalTotal: number;
    depositAmount: number;
    durationDays: number;
    quantity: number;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [availState, setAvailState] = useState<{
    checking: boolean;
    available?: boolean;
    remaining?: number;
    nextAvailableDate?: string | null;
  }>({ checking: false, available: true, remaining: inventoryCount });

  // Live calculation for display
  const diffDays = calculateRentalDays(startDate, endDate);
  const { rentalTotal, depositAmount, grandTotal } = calculateRentalPricing(
    dailyRate,
    diffDays,
    quantity
  );

  // Real-time server-side availability check
  useEffect(() => {
    if (endDate <= startDate) return;
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setAvailState((prev) => ({ ...prev, checking: true }));
      }
    });

    checkRentalAvailabilityAction(listingId, startDate, endDate, quantity).then((res) => {
      if (!active) return;
      setAvailState({
        checking: false,
        available: res.available,
        remaining: res.remaining,
        nextAvailableDate: res.nextAvailableDate,
      });
    });

    return () => {
      active = false;
    };
  }, [listingId, startDate, endDate, quantity]);

  const handleStartChange = (v: string) => {
    setStartDate(v);
    if (v >= endDate) setEndDate(v);
    setDateError(null);
    setServerError(null);
  };
  const handleEndChange = (v: string) => {
    setEndDate(v);
    setDateError(null);
    setServerError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);
    setServerError(null);

    if (endDate <= startDate) {
      setDateError("Return date must be after the pickup date.");
      return;
    }

    startTransition(async () => {
      const res = await confirmRentalBookingAction({
        listingId,
        pickupDate: startDate,
        returnDate: endDate,
        quantity,
      });

      if (res.error) {
        if (res.error.includes("signed in")) {
          setAuthRequired(true);
        } else {
          setServerError(res.error);
        }
        return;
      }

      if (res.success && res.bookingId) {
        setResult({
          bookingId: res.bookingId,
          rentalTotal: res.rentalTotal!,
          depositAmount: res.depositAmount!,
          durationDays: res.durationDays!,
          quantity: res.quantity ?? quantity,
        });
      }
    });
  };

  /* ── Confirmed state ─────────────────────────────────────────── */
  if (result) {
    return (
      <div className="rental-confirmed-card">
        <div className="rental-confirmed-icon" aria-hidden="true">✓</div>
        <p className="rental-confirmed-title">Rental Booking Confirmed!</p>
        <div className="rental-confirmed-details">
          <div className="rental-conf-row">
            <span>Units Reserved</span>
            <span>{result.quantity} unit{result.quantity !== 1 ? "s" : ""}</span>
          </div>
          <div className="rental-conf-row">
            <span>Duration</span>
            <span>{result.durationDays} day{result.durationDays !== 1 ? "s" : ""}</span>
          </div>
          <div className="rental-conf-row">
            <span>Rental Cost</span>
            <span>{formatINR(result.rentalTotal)}</span>
          </div>
          <div className="rental-conf-row">
            <span>Refundable Deposit</span>
            <span>{formatINR(result.depositAmount)}</span>
          </div>
          <div className="rental-conf-divider" />
          <div className="rental-conf-row rental-conf-total">
            <span>Total</span>
            <strong>{formatINR(result.rentalTotal + result.depositAmount)}</strong>
          </div>
        </div>
        <p className="rental-conf-ref">Booking ref: <code>{result.bookingId}</code></p>
        <a href="/bookings" className="rental-conf-link">View My Bookings →</a>
        <p className="demo-disclaimer-note">
          🔒 Demo only — no payment processed. Academic presentation booking.
        </p>
      </div>
    );
  }

  /* ── Auth required ───────────────────────────────────────────── */
  if (authRequired) {
    return (
      <div className="rental-reservation-card">
        <div className="rental-confirmed-icon" style={{ fontSize: "32px", marginBottom: "12px" }} aria-hidden="true">🔒</div>
        <p className="rental-confirmed-title" style={{ fontSize: "16px" }}>Sign In to Book</p>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6, marginBottom: "16px" }}>
          You need to be signed in to confirm a rental booking.
        </p>
        <a href="/account/login" className="btn-reserve-rental" style={{ textDecoration: "none", textAlign: "center", display: "block" }}>
          Sign In →
        </a>
        <button
          type="button"
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "12px", cursor: "pointer", marginTop: "10px" }}
          onClick={() => setAuthRequired(false)}
        >
          ← Back
        </button>
      </div>
    );
  }

  /* ── Booking form ────────────────────────────────────────────── */
  return (
    <div className="rental-reservation-card">
      <h3 className="reservation-title">Reserve Rental</h3>
      <p className="reservation-subtitle">
        {rentalTitle ? `${rentalTitle} — ` : ""}Select dates and units to calculate your rental rate
      </p>

      <form onSubmit={handleSubmit} className="reservation-form">
        <div className="date-inputs-grid">
          <div className="date-field">
            <label htmlFor={`rental-start-${listingId}`}>Pickup Date</label>
            <input
              id={`rental-start-${listingId}`}
              type="date"
              min={todayStr()}
              value={startDate}
              onChange={(e) => handleStartChange(e.target.value)}
              required
            />
          </div>
          <div className="date-field">
            <label htmlFor={`rental-end-${listingId}`}>Return Date</label>
            <input
              id={`rental-end-${listingId}`}
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => handleEndChange(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="date-field" style={{ marginTop: "12px" }}>
          <label htmlFor={`rental-qty-${listingId}`}>Number of Units</label>
          <input
            id={`rental-qty-${listingId}`}
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setQuantity(isNaN(val) || val < 1 ? 1 : Math.min(val, 20));
              setServerError(null);
            }}
            required
            style={{
              width: "100%",
              background: "rgba(10, 25, 47, 0.7)",
              border: "1px solid rgba(14, 165, 233, 0.2)",
              borderRadius: "8px",
              padding: "10px 14px",
              color: "#fff",
              fontSize: "14px",
            }}
          />
        </div>

        {dateError && (
          <p className="rental-date-error" role="alert">{dateError}</p>
        )}
        {serverError && (
          <p className="rental-date-error" role="alert">{serverError}</p>
        )}

        {/* Live Availability Indicator & Next Date Suggestion */}
        {diffDays > 0 && !dateError && (
          <div style={{ marginTop: "10px" }}>
            {availState.checking ? (
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0" }}>
                ⏳ Checking fleet availability…
              </p>
            ) : availState.available ? (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                color: "#4ade80",
              }}>
                <span>✓</span>
                <span>In Stock: {availState.remaining ?? inventoryCount} of {inventoryCount} units available for these dates</span>
              </div>
            ) : (
              <div style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "8px",
                padding: "10px 12px",
              }}>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#fca5a5", fontWeight: 600 }}>
                  ⚠️ Only {availState.remaining ?? 0} unit(s) available for the selected dates.
                </p>
                {availState.nextAvailableDate ? (
                  <div style={{ marginTop: "6px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--muted)" }}>
                      💡 Earliest pickup for {quantity} unit{quantity > 1 ? "s" : ""} ({diffDays} day{diffDays > 1 ? "s" : ""}):{" "}
                      <strong style={{ color: "var(--blue)" }}>
                        {formatDisplayDate(availState.nextAvailableDate)}
                      </strong>
                    </p>
                    <button
                      type="button"
                      style={{
                        background: "var(--blue)",
                        color: "#03111c",
                        border: "none",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        const nextStart = availState.nextAvailableDate!;
                        const nextEnd = new Date(new Date(nextStart + "T00:00:00").getTime() + diffDays * 86_400_000).toISOString().split("T")[0];
                        setStartDate(nextStart);
                        setEndDate(nextEnd);
                        setServerError(null);
                      }}
                    >
                      Select this date range →
                    </button>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                    No available date found within the next 60 days for this duration and quantity.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {diffDays > 0 && (
          <div className="rental-cost-breakdown">
            <div className="cost-row">
              <span>Daily Rate</span>
              <span>{formatINR(dailyRate)} / day</span>
            </div>
            <div className="cost-row">
              <span>Duration</span>
              <span>{diffDays} {diffDays === 1 ? "day" : "days"}</span>
            </div>
            <div className="cost-row">
              <span>Units</span>
              <span>{quantity} unit{quantity !== 1 ? "s" : ""}</span>
            </div>
            <div className="cost-row">
              <span>Rental Cost</span>
              <span>{formatINR(rentalTotal)}</span>
            </div>
            <div className="cost-row">
              <span>Refundable Deposit</span>
              <span>{formatINR(depositAmount)}</span>
            </div>
            <div className="cost-divider" />
            <div className="cost-row total-row">
              <span>Estimated Total</span>
              <strong className="total-highlight">{formatINR(grandTotal)}</strong>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn-reserve-rental"
          disabled={isPending || diffDays < 1 || availState.available === false}
        >
          {isPending
            ? "Confirming…"
            : diffDays < 1
            ? "Select valid dates"
            : availState.available === false
            ? "Insufficient units for selected dates"
            : `Confirm Rental Booking — ${formatINR(grandTotal)}`}
        </button>

        <p className="demo-disclaimer-note">
          🔒 Demo booking — no payment processed. Academic presentation only.
        </p>
      </form>
    </div>
  );
}
