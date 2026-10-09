import type { Metadata } from "next";
import { TrackForm } from "@/components/track-form";

export const metadata: Metadata = { title: "Lacak pesanan" };

export default function LacakPesananPage() {
  return (
    <div className="mx-auto max-w-[640px] space-y-6 px-4 py-8 md:px-8">
      <header>
        <h1 className="text-2xl font-bold">Lacak pesanan</h1>
        <p className="mt-1 text-text-secondary">Masukkan nomor pesanan dan email yang digunakan saat checkout.</p>
      </header>
      <TrackForm />
    </div>
  );
}
