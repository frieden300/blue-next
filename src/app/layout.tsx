import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { CartProvider } from "@/components/cart/CartContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BLUE — Ocean Exploration & Marine Tourism",
  description:
    "Discover cinematic ocean experiences, book marine adventures, and find premium diving gear on BLUE.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
