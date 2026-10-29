"use client";

import Link from "next/link";
import { useCart } from "./CartContext";

export default function CartNavButton() {
  const { count } = useCart();

  return (
    <Link href="/checkout" className="cart-nav-btn" aria-label={`Cart, ${count} item${count !== 1 ? "s" : ""}`}>
      <span className="cart-nav-icon" aria-hidden="true">🛒</span>
      {count > 0 && (
        <span className="cart-nav-count" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
