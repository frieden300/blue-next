"use client";

import { useState, useTransition } from "react";
import { cancelBookingAction } from "@/app/bookings/actions";

interface CancelBookingButtonProps {
  type: "order" | "rental" | "experience";
  id: string;
  status: string;
}

export default function CancelBookingButton({
  type,
  id,
  status: initialStatus,
}: CancelBookingButtonProps) {
  const [status, setStatus] = useState(initialStatus);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (status === "cancelled") {
    return (
      <span
        style={{
          fontSize: "11px",
          color: "rgba(239, 68, 68, 0.8)",
          fontStyle: "italic",
        }}
      >
        Cancelled
      </span>
    );
  }

  if (status !== "confirmed") {
    return null;
  }

  const label = type === "order" ? "Cancel Order" : "Cancel Booking";

  const handleConfirmCancel = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await cancelBookingAction(type, id);
      if (res.error) {
        setErrorMsg(res.error);
        setConfirming(false);
      } else {
        setStatus("cancelled");
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            background: "none",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            color: "#fca5a5",
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "999px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.35)";
          }}
        >
          {label}
        </button>
        {errorMsg && (
          <span style={{ fontSize: "10px", color: "#fca5a5", marginTop: "4px" }}>
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", color: "#fca5a5" }}>Confirm Cancel?</span>
      <button
        type="button"
        disabled={isPending}
        onClick={handleConfirmCancel}
        style={{
          background: "rgba(239, 68, 68, 0.2)",
          border: "1px solid rgba(239, 68, 68, 0.6)",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: "999px",
          cursor: "pointer",
        }}
      >
        {isPending ? "Cancelling…" : "Yes, Cancel"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontSize: "11px",
          padding: "3px 8px",
          borderRadius: "999px",
          cursor: "pointer",
        }}
      >
        Keep
      </button>
      {errorMsg && (
        <span style={{ fontSize: "10px", color: "#fca5a5", width: "100%", textAlign: "right" }}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
