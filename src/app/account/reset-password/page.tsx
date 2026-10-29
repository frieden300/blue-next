import { Suspense } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import ResetPasswordForm from "@/components/account/ResetPasswordForm";
import Link from "next/link";
import "../account.css";

export const metadata = {
  title: "Reset Password — BLUE",
  description: "Set a new password for your Project Blue expedition account.",
};

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />

      <main className="account-main">
        <div className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <span className="auth-brand-badge">Project Blue</span>
              <h1 className="auth-title">Set New Password</h1>
              <p className="auth-subtitle">
                Enter your account email, the 8-digit verification code, and your new password.
              </p>
            </div>

            <Suspense fallback={<ResetPasswordFallback />}>
              <ResetPasswordForm />
            </Suspense>

            <div className="auth-footer">
              <span>Need help?</span>
              <Link href="/account/login">Back to Sign In</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function ResetPasswordFallback() {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--muted)", fontSize: "14px" }}>
      Loading reset form...
    </div>
  );
}
