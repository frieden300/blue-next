"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import "./scrollytelling.css";

export default function Scrollytelling() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);
  useEffect(() => {
    // If scrollytelling was previously loaded and destroyed, re-initialize
    if (typeof (window as unknown as { __blueScrollyInit?: () => void }).__blueScrollyInit === "function") {
      (window as unknown as { __blueScrollyInit: () => void }).__blueScrollyInit();
    }

    const cta = document.getElementById("journeyCta");
    if (!cta) return;

    let targetShiftX = 0;
    let targetShiftY = 0;
    let currentShiftX = 0;
    let currentShiftY = 0;

    let targetRx = 2.5;
    let targetRy = -4.0;
    let targetRz = 4.0;
    let currentRx = 2.5;
    let currentRy = -4.0;
    let currentRz = 4.0;

    let animId: number | null = null;
    let isRunning = false;

    const loop = () => {
      currentShiftX += (targetShiftX - currentShiftX) * 0.12;
      currentShiftY += (targetShiftY - currentShiftY) * 0.12;
      currentRx += (targetRx - currentRx) * 0.12;
      currentRy += (targetRy - currentRy) * 0.12;
      currentRz += (targetRz - currentRz) * 0.12;

      cta.style.setProperty("--shift-x", `${currentShiftX.toFixed(2)}px`);
      cta.style.setProperty("--shift-y", `${currentShiftY.toFixed(2)}px`);
      cta.style.setProperty("--tilt-rx", `${currentRx.toFixed(2)}deg`);
      cta.style.setProperty("--tilt-ry", `${currentRy.toFixed(2)}deg`);
      cta.style.setProperty("--tilt-rz", `${currentRz.toFixed(2)}deg`);

      // Check convergence to stop idle RAF loop
      const diff =
        Math.abs(targetShiftX - currentShiftX) +
        Math.abs(targetShiftY - currentShiftY) +
        Math.abs(targetRx - currentRx) +
        Math.abs(targetRy - currentRy) +
        Math.abs(targetRz - currentRz);

      if (diff < 0.001) {
        currentShiftX = targetShiftX;
        currentShiftY = targetShiftY;
        currentRx = targetRx;
        currentRy = targetRy;
        currentRz = targetRz;
        isRunning = false;
        animId = null;
        return;
      }

      animId = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        animId = requestAnimationFrame(loop);
      }
    };

    const onPointerMove = (e: MouseEvent | PointerEvent) => {
      const rect = cta.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const relX = (e.clientX - cx) / (window.innerWidth * 0.5);
      const relY = (e.clientY - cy) / (window.innerHeight * 0.5);

      const clampedX = Math.max(-1, Math.min(1, relX));
      const clampedY = Math.max(-1, Math.min(1, relY));

      targetShiftX = clampedX * 36;
      targetShiftY = clampedY * 26;

      targetRx = 2.5 - clampedY * 15;
      targetRy = -4.0 + clampedX * 18;
      targetRz = 4.0 + clampedX * 2.5;

      const flareX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const flareY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      cta.style.setProperty("--flare-x", `${flareX.toFixed(1)}%`);
      cta.style.setProperty("--flare-y", `${flareY.toFixed(1)}%`);

      startLoop();
    };

    const onPointerLeave = () => {
      targetShiftX = 0;
      targetShiftY = 0;
      targetRx = 2.5;
      targetRy = -4.0;
      targetRz = 4.0;
      startLoop();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      if (animId !== null) cancelAnimationFrame(animId);

      // Clean up background video decoding and audio context when leaving home
      if (typeof (window as unknown as { __blueScrollyDestroy?: () => void }).__blueScrollyDestroy === "function") {
        (window as unknown as { __blueScrollyDestroy: () => void }).__blueScrollyDestroy();
      }
    };
  }, []);

  return (
    <>
      <div className="scroll-space" aria-hidden="true" />
      <main className="experience" onContextMenu={(e) => e.preventDefault()}>
        <div className="video-stage">
          <video
            id="videoA"
            className="cinema-video visible is-active"
            muted
            playsInline
            preload="auto"
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            aria-hidden="true"
          />
          <video
            id="videoB"
            className="cinema-video"
            muted
            playsInline
            preload="auto"
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="shade" />
          <div className="grain" />
          <div className="glow" />
          <div className="particles" id="particles" />
        </div>

        <header className="scrolly-header">
          <div className="brand-cluster">
            <div ref={menuRef} className={`site-menu ${menuOpen ? "is-open" : ""}`}>
              <button
                className="site-menu-trigger"
                type="button"
                aria-label="Toggle Blue navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <span className="menu-lines" aria-hidden="true"><i /><i /></span>
                <span>EXPLORE</span>
              </button>
              <div className="site-menu-panel">
                <p className="site-menu-kicker">DISCOVER BLUE</p>
                <Link href="/explore" onClick={() => setMenuOpen(false)}><span>01</span><strong>Explore</strong><small>Ocean experiences</small></Link>
                <Link href="/gear" onClick={() => setMenuOpen(false)}><span>02</span><strong>Gear</strong><small>Equipment marketplace</small></Link>
                <Link href="/rentals" onClick={() => setMenuOpen(false)}><span>03</span><strong>Rentals</strong><small>Gear for your journey</small></Link>
                <Link href="/bookings" onClick={() => setMenuOpen(false)}><span>04</span><strong>My bookings</strong><small>Your planned adventures</small></Link>
              </div>
            </div>
            <Link className="logo" href="/" aria-label="Blue home">BL<span>U</span>E<span className="dot">.</span></Link>
          </div>
          <div className="topnote">A JOURNEY INTO THE OCEAN</div>
          <div className="edition">BLUE JOURNEY / 01—07<i /></div>
        </header>

        <Link className="journey-cta is-visible" id="journeyCta" href="/explore" aria-label="Explore the BLUE">
          <div className="journey-cta-bob">
            <div className="journey-cta-card">
              <span className="cta-glass-sheen" aria-hidden="true" />
              <span className="journey-cta-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9.5" strokeOpacity="0.4" />
                  <polygon points="12 4.5 14.5 9.5 20 12 14.5 14.5 12 19.5 9.5 14.5 4 12 9.5 9.5 12 4.5" fill="currentColor" fillOpacity="0.28" />
                </svg>
              </span>
              <div className="journey-cta-text">
                <span className="journey-cta-label">CONTINUE YOUR JOURNEY</span>
                <span className="journey-cta-title">Explore the BLUE</span>
              </div>
              <span className="journey-cta-arrow" aria-hidden="true">↗</span>
            </div>
          </div>
        </Link>

        <section className="copy" aria-live="polite">
          <p id="eyebrow">01 / THE BEGINNING</p>
          <h1 id="heading">One planet.<br /><em>One blue world.</em></h1>
          <p id="description">A journey from the edge of our atmosphere into the quiet depths of the ocean.</p>
        </section>

        <footer className="scrolly-footer">
          <div className="scroll-prompt" id="scrollPrompt" role="region" aria-label="Scroll to descend prompt">
            <div className="scroll-prompt-cue" aria-hidden="true">
              <div className="scroll-mouse">
                <span className="scroll-wheel" />
              </div>
              <div className="scroll-chevrons">
                <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                  <path d="M1 1.5L5 5L9 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="chevron-1" />
                  <path d="M1 5.5L5 9L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="chevron-2" />
                </svg>
              </div>
            </div>
            <span className="scroll-prompt-label">SCROLL TO DESCEND</span>
          </div>
          <div className="caption"><span id="stageName">BLUE PLANET</span><b>/</b><span id="modeLabel">LOOP</span></div>
          <div className="count"><strong id="progressNumber">01</strong> / 07</div>
        </footer>

        <nav className="journey-nav" aria-label="Journey stages">
          <div className="track" />
          <button className="active" data-stage="0" aria-label="Blue Planet"><span>01</span></button>
          <button data-stage="1" aria-label="Island to Beach"><span>02</span></button>
          <button data-stage="2" aria-label="Blue Horizon"><span>03</span></button>
          <button data-stage="3" aria-label="Entering the Ocean"><span>04</span></button>
          <button data-stage="4" aria-label="Dive Boat"><span>05</span></button>
          <button data-stage="5" aria-label="Coral Descent"><span>06</span></button>
          <button data-stage="6" aria-label="Blue Abyss"><span>07</span></button>
        </nav>

        <div className="loading" id="loading"><b>B.</b><span>PREPARING YOUR DESCENT</span></div>
        <div className="side-note">AMBIENT SOUND · TOGGLE ANYTIME</div>
      </main>
      <Script
        src="/assets/scrollytelling.js?v=20261031a"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof (window as unknown as { __blueScrollyInit?: () => void }).__blueScrollyInit === "function") {
            (window as unknown as { __blueScrollyInit: () => void }).__blueScrollyInit();
          }
        }}
      />
    </>
  );
}
