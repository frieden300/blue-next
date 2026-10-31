"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type ActionState } from "@/app/account/actions";

interface ChangePasswordCardProps {
  email: string;
}

const initialState: ActionState = {};

export default function ChangePasswordCard({ email }: ChangePasswordCardProps) {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <section className="account-section-card" aria-labelledby="security-heading">
      <div>
        <h2 id="security-heading" className="section-card-title">
          Security &amp; Password
        </h2>
        <p className="section-card-sub">
          Manage your credentials or request an 8-digit verification code to update your password.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {state.error && (
          <div className="auth-alert auth-alert-error" role="alert">
            <span>⚠️</span>
            <span>{state.error}</span>
          </div>
        )}

        {state.success ? (
          <div className="auth-recovery-card" style={{ padding: "20px" }}>
            <div className="auth-recovery-icon-circle" aria-hidden="true" style={{ width: "40px", height: "40px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <h4 className="auth-recovery-title" style={{ fontSize: "0.95rem" }}>8-Digit Code Dispatched</h4>
              <p className="auth-recovery-body" style={{ fontSize: "0.84rem" }}>
                An 8-digit verification code has been sent to your email. Check your inbox on your phone or computer, then enter the code to reset your password.
              </p>
            </div>
            <Link
              href={`/account/reset-password?email=${encodeURIComponent(email)}`}
              className="auth-btn-submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                width: "100%",
                height: "44px",
                borderRadius: "12px",
                textDecoration: "none",
                fontSize: "0.88rem",
              }}
            >
              Enter 8-Digit Code &rarr;
            </Link>
          </div>
        ) : (
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input type="hidden" name="email" value={email} />

            <button
              type="submit"
              className="auth-btn-submit"
              disabled={isPending}
              style={{
                height: "44px",
                borderRadius: "12px",
                fontSize: "0.88rem",
                marginTop: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                width: "100%",
              }}
            >
              {isPending ? "Sending Code..." : "Change Password →"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
