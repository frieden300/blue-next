"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function HeaderAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Check active session on mount
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    // Subscribe to auth state transitions (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <Link href="/account" className="site-account-btn" aria-label="Account">
        Account
      </Link>
    );
  }

  if (user) {
    return (
      <Link
        href="/account"
        className="site-account-btn is-authenticated"
        aria-label="Account dashboard"
      >
        <span className="account-indicator-dot" aria-hidden="true" />
        Account
      </Link>
    );
  }

  return (
    <div className="site-auth-buttons">
      <Link href="/account/login" className="site-login-link">
        Sign In
      </Link>
      <Link href="/account/signup" className="site-signup-btn">
        Sign Up
      </Link>
    </div>
  );
}
