import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCartItems, getCurrentUser } from "@/lib/auth-context";
import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "NOVA STORE", template: "%s | NOVA STORE" },
  description: "Belanja produk pilihan dengan harga dalam Rupiah. NOVA STORE adalah nama brand sementara.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#315cff",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [viewer, items] = await Promise.all([getCurrentUser(), getCartItems()]);
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <html lang="id-ID" className="h-full">
      <body className="flex min-h-full flex-col">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
        >
          Lewati ke konten utama
        </a>
        <DemoBanner />
        <SiteHeader viewer={viewer} cartCount={cartCount} />
        <main id="konten" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
