"use client";

import { useActionState, useState, useEffect } from "react";
import Link from "next/link";
import {
  loginAction,
  requestPasswordResetAction,
  resendPasswordResetOtpAction,
  type ActionState,
} from "@/app/account/actions";

const initialLoginState: ActionState = {};
const initialResetState: ActionState = {};

export default function LoginForm() {
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, initialLoginState);
  const [resetState, resetFormAction, isResetPending] = useActionState(requestPasswordResetAction, initialResetState);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    const cleanEmail = resetEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return;
    }
    setIsResending(true);
    setResendStatus(null);
    try {
      const res = await resendPasswordResetOtpAction(cleanEmail);
      if (res.error) {
        setResendStatus(res.error);
      } else {
        setResendStatus("A fresh 8-digit verification code has been sent!");
        setResendCooldown(60);
      }
    } catch {
      setResendStatus("Unable to resend code. Please try again shortly.");
    } finally {
      setIsResending(false);
    }
  };

  // Dynamic header details based on view state
  const headerContent = !isForgotMode ? (
    <div className="auth-header">
      <span className="auth-brand-badge">Project Blue</span>
      <h1 className="auth-title">Welcome Back</h1>
      <p className="auth-subtitle">
        Sign in to access your marine adventures and saved expedition gear.
      </p>
    </div>
  ) : resetState.success ? (
    <div className="auth-header">
      <span className="auth-brand-badge">Security Verification</span>
      <h1 className="auth-title">8-Digit Code Sent</h1>
      <p className="auth-subtitle">
        We sent an 8-digit verification code to your registered email address.
      </p>
    </div>
  ) : (
    <div className="auth-header">
      <span className="auth-brand-badge">Account Recovery</span>
      <h1 className="auth-title">Reset Password</h1>
      <p className="auth-subtitle">
        Enter your email to receive an 8-digit verification code.
      </p>
    </div>
  );

  if (isForgotMode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {headerContent}

        <div className="auth-form">
          {resetState.error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>⚠️</span>
              <span>{resetState.error}</span>
            </div>
          )}

          {resendStatus && (
            <div className="auth-alert auth-alert-info" role="status">
              <span>ℹ️</span>
              <span>{resendStatus}</span>
            </div>
          )}

          {resetState.success ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="auth-recovery-card">
                <div className="auth-recovery-icon-circle" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <h3 className="auth-recovery-title">Check Your Inbox</h3>
                  <p className="auth-recovery-body">
                    If an account exists, an 8-digit verification code has been sent. You can read the code on your phone or computer, then enter it on the reset page.
                  </p>
                </div>

                <Link
                  href={`/account/reset-password?email=${encodeURIComponent(resetEmail)}`}
                  className="auth-btn-submit"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    whiteSpace: "nowrap",
                    width: "100%",
                    height: "46px",
                    borderRadius: "12px",
                    textDecoration: "none",
                    marginTop: "4px",
                    padding: "0 20px",
                  }}
                >
                  Enter 8-Digit Code &rarr;
                </Link>

                <div className="otp-resend-row" style={{ justifyContent: "center", gap: "8px" }}>
                  <span>Didn&apos;t receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending || resendCooldown > 0}
                    className="otp-resend-btn"
                  >
                    {isResending
                      ? "Sending..."
                      : resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend Code"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsForgotMode(false)}
                className="auth-btn-secondary"
              >
                &larr; Return to Sign In
              </button>
            </div>
          ) : (
            <form action={resetFormAction} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="diver@projectblue.org"
                  className="form-input"
                  disabled={isResetPending}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoFocus
                />
                <span className="form-hint">
                  We&apos;ll send an 8-digit verification code to this email.
                </span>
              </div>

              <button
                type="submit"
                className="auth-btn-submit"
                style={{
                  height: "46px",
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                }}
                disabled={isResetPending}
              >
                {isResetPending ? "Sending Code..." : "Send 8-Digit Code →"}
              </button>

              <button
                type="button"
                onClick={() => setIsForgotMode(false)}
                className="auth-btn-secondary"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  height: "36px",
                }}
              >
                &larr; Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {headerContent}

      <form action={loginFormAction} className="auth-form">
        {loginState.error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <span>⚠️</span>
            <span>{loginState.error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="diver@projectblue.org"
            className="form-input"
            disabled={isLoginPending}
          />
        </div>

        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              onClick={() => setIsForgotMode(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--blue)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                padding: 0,
                transition: "opacity 0.2s",
              }}
            >
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="form-input"
            disabled={isLoginPending}
          />
        </div>

        <button
          type="submit"
          className="auth-btn-submit"
          style={{
            height: "46px",
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
          disabled={isLoginPending}
        >
          {isLoginPending ? "Signing in..." : "Sign In →"}
        </button>
      </form>
    </div>
  );
}
