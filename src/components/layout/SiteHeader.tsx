"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HeaderAuth from "./HeaderAuth";
import CartNavButton from "@/components/cart/CartNavButton";
import "./site-layout.css";

const NAV_LINKS = [
  { href: "/explore",  label: "Explore",    sub: "Ocean experiences", icon: "🤿" },
  { href: "/gear",     label: "Gear",       sub: "Equipment marketplace", icon: "🛒" },
  { href: "/rentals",  label: "Rentals",    sub: "Gear for your journey", icon: "⚓" },
  { href: "/bookings", label: "Bookings",   sub: "Your adventures", icon: "🧭" },
] as const;

export default function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle ESC key and lock body scroll when drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {/* Brand */}
        <Link
          href="/"
          className="site-logo"
          aria-label="BLUE home"
          onClick={() => setMobileMenuOpen(false)}
        >
          BL<span>U</span>E<span className="site-logo-dot">.</span>
        </Link>

        {/* Desktop nav */}
        <nav className="site-nav" aria-label="Main navigation">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="site-nav-link"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Header actions */}
        <div className="site-header-actions">
          <CartNavButton />
          <div className="desktop-header-auth">
            <HeaderAuth />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            className={`mobile-menu-toggle ${mobileMenuOpen ? "is-open" : ""}`}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span className="mobile-menu-bar" />
            <span className="mobile-menu-bar" />
            <span className="mobile-menu-bar" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <div
        id="mobile-nav-drawer"
        className={`mobile-nav-drawer ${mobileMenuOpen ? "is-open" : ""}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-kicker">Navigation</span>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="mobile-nav-list" aria-label="Mobile navigation">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="mobile-nav-item"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="mobile-nav-item-icon" aria-hidden="true">{l.icon}</span>
              <div className="mobile-nav-item-content">
                <span className="mobile-nav-item-label">{l.label}</span>
                <span className="mobile-nav-item-sub">{l.sub}</span>
              </div>
              <span className="mobile-nav-item-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-auth-container" onClick={() => setMobileMenuOpen(false)}>
            <HeaderAuth />
          </div>
        </div>
      </div>
    </header>
  );
}
