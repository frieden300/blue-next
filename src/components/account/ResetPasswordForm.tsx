"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  verifyOtpAndResetPasswordAction,
  resendPasswordResetOtpAction,
  type ActionState,
} from "@/app/account/actions";

const initialState: ActionState = {};

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || searchParams.get("user") || "";

  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isResending, setIsResending] = useState<boolean>(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [state, formAction, isPending] = useActionState(
    verifyOtpAndResetPasswordAction,
    initialState
  );

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, val: string) => {
    setClientError(null);
    const cleaned = val.replace(/\D/g, "");

    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    // If multi-digit typed or pasted into single box
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 8).split("");
      const next = [...digits];
      chars.forEach((c, idx) => {
        if (idx < 8) next[idx] = c;
      });
      setDigits(next);
      const nextFocus = Math.min(chars.length, 7);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned[0];
    setDigits(next);

    // Auto-focus next box
    if (index < 7 && cleaned[0]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 7) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 8; i++) {
      next[i] = pasted[i] || "";
    }
    setDigits(next);

    const focusTarget = Math.min(pasted.length, 7);
    inputRefs.current[focusTarget]?.focus();
  };

  const handleResend = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setClientError("Please enter a valid email address first to resend the code.");
      return;
    }

    setIsResending(true);
    setClientError(null);
    setResendStatus(null);

    try {
      const res = await resendPasswordResetOtpAction(cleanEmail);
      if (res.error) {
        setClientError(res.error);
      } else {
        setResendStatus("A fresh 8-digit verification code has been sent!");
        setResendCooldown(60);
      }
    } catch {
      setClientError("Unable to resend verification code. Please wait a moment and try again.");
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError(null);
    const token = digits.join("");
    if (token.length !== 8) {
      e.preventDefault();
      setClientError("Please enter the complete 8-digit verification code.");
      const firstEmpty = digits.findIndex((d) => !d);
      inputRefs.current[firstEmpty >= 0 ? firstEmpty : 0]?.focus();
      return;
    }

    const form = e.currentTarget;
    const pwd = (form.elements.namedItem("password") as HTMLInputElement)?.value;
    const confirm = (form.elements.namedItem("confirmPassword") as HTMLInputElement)?.value;

    if (!pwd || pwd.length < 6) {
      e.preventDefault();
      setClientError("Password must be at least 6 characters long.");
      return;
    }

    if (pwd !== confirm) {
      e.preventDefault();
      setClientError("Passwords do not match. Please verify both fields.");
      return;
    }
  };

  const displayError = clientError || state.error;

  if (state.success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="auth-recovery-card">
          <div
            className="auth-recovery-icon-circle"
            aria-hidden="true"
            style={{
              background: "rgba(34, 197, 94, 0.12)",
              borderColor: "rgba(34, 197, 94, 0.35)",
              color: "#86efac",
              boxShadow: "0 0 16px rgba(34, 197, 94, 0.25)",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <h3 className="auth-recovery-title">Password Reset Complete</h3>
            <p className="auth-recovery-body">
              Your password has been successfully updated. You can now sign in with your new credentials.
            </p>
          </div>

          <Link
            href="/account/login"
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
            Sign In with New Password &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="auth-form">
      {displayError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>⚠️</span>
          <span>{displayError}</span>
        </div>
      )}

      {resendStatus && (
        <div className="auth-alert auth-alert-success" role="status">
          <span>✓</span>
          <span>{resendStatus}</span>
        </div>
      )}

      <div className="auth-helper-notice">
        <span className="auth-helper-notice-icon">📱</span>
        <div>
          <strong>Cross-Device Friendly:</strong> You can request this recovery on your desktop, check your email on your phone, and enter the 8-digit verification code here.
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="reset-email">
          Expedition Email Address
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="diver@projectblue.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="form-input"
          disabled={isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          8-Digit Verification Code
        </label>
        <div className="otp-container">
          <div className="otp-grid" role="group" aria-label="Eight digit verification code">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                autoComplete={idx === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${idx + 1}`}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                disabled={isPending}
                className={`otp-digit-box ${digit ? "filled" : ""}`}
              />
            ))}
          </div>

          <input type="hidden" name="token" value={digits.join("")} />

          <div className="otp-resend-row">
            <span>Didn&apos;t receive a code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isPending || isResending || resendCooldown > 0}
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
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="password">
          New Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          className="form-input"
          disabled={isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="confirmPassword">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          className="form-input"
          disabled={isPending}
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
          marginTop: "6px",
        }}
        disabled={isPending}
      >
        {isPending ? "Verifying & Updating..." : "Verify Code & Reset Password →"}
      </button>

      <div style={{ textAlign: "center", marginTop: "2px" }}>
        <Link
          href="/account/login"
          style={{
            color: "var(--blue)",
            fontSize: "13px",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          &larr; Return to Sign In
        </Link>
      </div>
    </form>
  );
}
