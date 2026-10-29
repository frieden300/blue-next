import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import CheckoutClient from "./CheckoutClient";
import "./checkout.css";

export const metadata = {
  title: "Cart & Checkout — BLUE",
  description: "Review your gear cart and confirm your demo order.",
};

export default function CheckoutPage() {
  return (
    <>
      <SiteHeader />
      <main className="checkout-main">
        <CheckoutClient />
      </main>
      <SiteFooter />
    </>
  );
}
