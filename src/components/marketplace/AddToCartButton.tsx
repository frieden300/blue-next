"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartContext";

interface AddToCartButtonProps {
  listingId: string;
  productTitle: string;
  price: number;
  imageUrl?: string;
  stockCount?: number;
}

export default function AddToCartButton({
  listingId,
  productTitle,
  price,
  imageUrl,
  stockCount,
}: AddToCartButtonProps) {
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = items.find((i) => i.listingId === listingId);
  const isSoldOut = stockCount !== undefined && stockCount <= 0;
  const maxAvailable = stockCount !== undefined ? Math.min(stockCount, 50) : 50;
  const isLowStock = stockCount !== undefined && stockCount > 0 && stockCount <= 3;

  const increment = () => setQuantity((q) => Math.min(maxAvailable, q + 1));
  const decrement = () => setQuantity((q) => Math.max(1, q - 1));

  const handleAddToCart = () => {
    if (isSoldOut) return;
    addItem({ listingId, title: productTitle, unitPrice: price, imageUrl, quantity });
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  if (isSoldOut) {
    return (
      <div className="product-purchase-box">
        <div
          className="stock-status-badge stock-sold-out"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.45rem 0.9rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            background: "rgba(239, 68, 68, 0.12)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            marginBottom: "1rem",
          }}
        >
          <span>✕</span> Sold Out — Currently out of stock
        </div>
        <button
          type="button"
          className="btn-add-to-cart"
          disabled
          style={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Sold Out
        </button>
      </div>
    );
  }

  return (
    <div className="product-purchase-box">
      {/* Live Stock Indicator */}
      {stockCount !== undefined && (
        <div style={{ marginBottom: "1rem" }}>
          {isLowStock ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                background: "rgba(245, 158, 11, 0.12)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              🔥 Only {stockCount} left in stock — order soon
            </span>
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                background: "rgba(16, 185, 129, 0.12)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.3)",
              }}
            >
              ✓ In Stock ({stockCount} available)
            </span>
          )}
        </div>
      )}

      <div className="quantity-control-row">
        <label className="quantity-label" htmlFor={`qty-${listingId}`}>Quantity</label>
        <div className="quantity-stepper" id={`qty-${listingId}`}>
          <button
            type="button"
            className="quantity-btn"
            onClick={decrement}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="quantity-value">{quantity}</span>
          <button
            type="button"
            className="quantity-btn"
            onClick={increment}
            disabled={quantity >= maxAvailable}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <div className="subtotal-calc">
          Subtotal: <strong>₹{(quantity * price).toLocaleString("en-IN")}</strong>
        </div>
      </div>

      {inCart && (
        <p className="in-cart-note">
          ✓ Already in cart ({inCart.quantity} unit{inCart.quantity !== 1 ? "s" : ""}) — adding more will increase quantity.
        </p>
      )}

      <div className="purchase-cta-actions">
        <button
          type="button"
          className={`btn-add-to-cart${added ? " btn-added" : ""}`}
          onClick={handleAddToCart}
        >
          {added ? "✓ Added to Cart!" : `Add to Cart — ₹${(quantity * price).toLocaleString("en-IN")}`}
        </button>
      </div>

      {added && (
        <div className="cart-feedback-toast" role="status" aria-live="polite">
          <span className="toast-icon">✓</span>
          <div className="toast-body">
            <p className="toast-title">
              Added {quantity}× &ldquo;{productTitle}&rdquo; to your cart.
            </p>
            <p className="toast-note">
              <a href="/checkout" className="toast-link">Review cart &amp; confirm order →</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
