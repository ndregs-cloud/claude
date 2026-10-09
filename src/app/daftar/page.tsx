import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Daftar" };

export default function DaftarPage() {
  return (
    <div className="mx-auto max-w-[460px] space-y-6 px-4 py-10 md:px-8">
      <header>
        <h1 className="text-2xl font-bold">Buat akun</h1>
        <p className="mt-1 text-text-secondary">Riwayat pesanan dan alamat tersimpan di satu tempat. Belanja sebagai tamu tetap tersedia.</p>
      </header>
      <RegisterForm />
      <p className="text-sm text-text-secondary">Sudah punya akun? <Link href="/masuk" className="font-semibold text-brand-600 underline">Masuk</Link></p>
    </div>
  );
}
