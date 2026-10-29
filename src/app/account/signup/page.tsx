import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import SignupForm from "@/components/account/SignupForm";
import Link from "next/link";
import "../account.css";

export const metadata = {
  title: "Create Account — BLUE",
  description: "Join Project Blue to book marine experiences and rent expedition gear.",
};

export default function SignupPage() {
  return (
    <>
      <SiteHeader />

      <main className="account-main">
        <div className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <span className="auth-brand-badge">Project Blue</span>
              <h1 className="auth-title">Begin Your Descent</h1>
              <p className="auth-subtitle">
                Create an account to book diving experiences, rent expedition kits, and manage adventures.
              </p>
            </div>

            <SignupForm />

            <div className="auth-footer">
              <span>Already have an account?</span>
              <Link href="/account/login">Sign in</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
