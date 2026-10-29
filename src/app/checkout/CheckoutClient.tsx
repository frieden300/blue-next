"use client";

import { useState, useTransition } from "react";
import { useCart } from "@/components/cart/CartContext";
import { confirmOrderAction } from "./actions";
import Link from "next/link";
import "./checkout.css";

export default function CheckoutClient() {
  const { items, total, removeItem, setQty, clear } = useCart();
  const [isPending, startTransition] = useTransition();
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmOrderAction(
        items.map((i) => ({
          listingId: i.listingId,
          title: i.title,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
        }))
      );

      if (result.error) {
        if (result.error.includes("signed in")) {
          setAuthRequired(true);
        } else {
          setError(result.error);
        }
        return;
      }

      if (result.success && result.orderId) {
        clear();
        setConfirmedOrderId(result.orderId);
      }
    });
  };

  /* ── Order confirmed screen ──────────────────────────────────── */
  if (confirmedOrderId) {
    return (
      <div className="checkout-confirmed">
        <div className="confirmed-icon" aria-hidden="true">✓</div>
        <h1 className="confirmed-title">Demo Order Confirmed!</h1>
        <p className="confirmed-sub">
          Your demonstration order has been recorded. No payment was processed — this is an academic presentation.
        </p>
        <p className="confirmed-ref">
          Order ref: <code>{confirmedOrderId}</code>
        </p>
        <div className="confirmed-actions">
          <Link href="/bookings" className="confirmed-btn-primary">
            View My Bookings →
          </Link>
          <Link href="/gear" className="confirmed-btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  /* ── Empty cart ───────────────────────────────────────────────── */
  if (items.length === 0) {
    return (
      <div className="cart-empty-state">
        <div className="cart-empty-icon" aria-hidden="true">🛒</div>
        <h1 className="cart-empty-title">Your Cart is Empty</h1>
        <p className="cart-empty-sub">
          Browse the gear marketplace and add items to your cart to continue.
        </p>
        <Link href="/gear" className="cart-empty-cta">
          Browse Gear →
        </Link>
      </div>
    );
  }

  /* ── Auth required ───────────────────────────────────────────── */
  if (authRequired) {
    return (
      <div className="cart-empty-state">
        <div className="cart-empty-icon" aria-hidden="true">🔒</div>
        <h1 className="cart-empty-title">Sign In Required</h1>
        <p className="cart-empty-sub">
          You need to be signed in to confirm a demo order. Your cart items are saved.
        </p>
        <div className="confirmed-actions">
          <Link href="/account/login" className="confirmed-btn-primary">
            Sign In →
          </Link>
          <button
            type="button"
            className="confirmed-btn-secondary"
            onClick={() => setAuthRequired(false)}
          >
            ← Back to Cart
          </button>
        </div>
      </div>
    );
  }

  /* ── Cart review ─────────────────────────────────────────────── */
  return (
    <div className="checkout-layout">
      {/* Left: Item list */}
      <div className="checkout-items-col">
        <div className="checkout-section-header">
          <h1 className="checkout-title">Your Cart</h1>
          <span className="checkout-item-count">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>

        <ul className="cart-item-list">
          {items.map((item) => (
            <li key={item.listingId} className="cart-item">
              {/* Image */}
              <div className="cart-item-img-wrap">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="cart-item-img"
                  />
                ) : (
                  <div className="cart-item-img-placeholder" aria-hidden="true">🤿</div>
                )}
              </div>

              {/* Info */}
              <div className="cart-item-info">
                <p className="cart-item-title">{item.title}</p>
                <p className="cart-item-unit-price">
                  ₹{item.unitPrice.toLocaleString("en-IN")} / unit
                </p>

                {/* Qty stepper */}
                <div className="cart-item-qty-row">
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setQty(item.listingId, item.quantity - 1)}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="qty-val">{item.quantity}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    onClick={() => setQty(item.listingId, item.quantity + 1)}
                    disabled={item.quantity >= 50}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => removeItem(item.listingId)}
                    aria-label={`Remove ${item.title} from cart`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Subtotal */}
              <div className="cart-item-subtotal">
                ₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: Order summary */}
      <div className="checkout-summary-col">
        <div className="checkout-summary-card">
          <h2 className="summary-title">Order Summary</h2>

          <div className="summary-line-items">
            {items.map((item) => (
              <div key={item.listingId} className="summary-line">
                <span>{item.title} ×{item.quantity}</span>
                <span>₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>

          <div className="summary-divider" />

          <div className="summary-total-row">
            <span>Total</span>
            <strong>₹{total.toLocaleString("en-IN")}</strong>
          </div>

          {error && (
            <p className="checkout-error" role="alert">{error}</p>
          )}

          <div className="demo-badge-bar" style={{ marginBottom: "12px" }}>
            <span className="demo-dot" aria-hidden="true" />
            <span>No payment will be charged — demo only</span>
          </div>

          <button
            type="button"
            className="btn-confirm-order"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Confirming…" : "Confirm Demo Order →"}
          </button>

          <p className="summary-disclaimer">
            Academic demonstration. Orders are saved to your account for presentation purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}
