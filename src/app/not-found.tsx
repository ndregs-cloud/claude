import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start gap-4 px-4 py-16 md:px-8">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="text-text-secondary">Halaman yang Anda cari mungkin sudah dipindahkan atau tidak tersedia.</p>
      <Link href="/belanja" className={buttonClass("primary")}>Kembali belanja</Link>
    </div>
  );
}
