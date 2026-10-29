import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import LoginForm from "@/components/account/LoginForm";
import Link from "next/link";
import "../account.css";

export const metadata = {
  title: "Sign In — BLUE",
  description: "Sign in to your Project Blue account to manage your bookings and expedition gear.",
};

export default function LoginPage() {
  return (
    <>
      <SiteHeader />

      <main className="account-main">
        <div className="auth-wrapper">
          <div className="auth-card">
            <LoginForm />

            <div className="auth-footer">
              <span>New to Blue?</span>
              <Link href="/account/signup">Create an account</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
