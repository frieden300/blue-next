import Link from "next/link";
import "./site-layout.css";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/" className="site-logo site-footer-logo" aria-label="BLUE home">
          BL<span>U</span>E<span className="site-logo-dot">.</span>
        </Link>

        <p className="site-footer-tagline">A journey into the ocean.</p>

        <nav className="site-footer-nav" aria-label="Footer navigation">
          <Link href="/explore">Explore</Link>
          <Link href="/gear">Gear</Link>
          <Link href="/rentals">Rentals</Link>
          <Link href="/bookings">Bookings</Link>
          <Link href="/partner/apply">Become a Partner</Link>
        </nav>

        <p className="site-footer-copy">
          &copy; 2026 PROJECT BLUE &mdash; BTech Academic Project
        </p>
      </div>
    </footer>
  );
}
