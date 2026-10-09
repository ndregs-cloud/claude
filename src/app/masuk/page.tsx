import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-[460px] space-y-6 px-4 py-10 md:px-8">
      <header>
        <h1 className="text-2xl font-bold">Masuk</h1>
        <p className="mt-1 text-text-secondary">Lihat riwayat pesanan dan lacak pengirimanmu.</p>
      </header>
      <LoginForm next={sp.lanjut ?? "/akun"} />
      <p className="text-sm text-text-secondary">
        Belum punya akun? <Link href="/daftar" className="font-semibold text-brand-600 underline">Daftar</Link>. Atau{" "}
        <Link href="/lacak-pesanan" className="font-semibold text-brand-600 underline">lacak pesanan sebagai tamu</Link>.
      </p>
    </div>
  );
}
