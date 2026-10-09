import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog/seed";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border-default bg-surface">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 md:px-8">
        <div>
          <p className="font-bold">Belanja</p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link href={`/kategori/${category.slug}`} className="hover:text-brand-600 hover:underline">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-bold">Bantuan</p>
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            <li><Link href="/bantuan" className="hover:text-brand-600 hover:underline">Pusat bantuan</Link></li>
            <li><Link href="/lacak-pesanan" className="hover:text-brand-600 hover:underline">Lacak pesanan</Link></li>
            <li><Link href="/bantuan#retur" className="hover:text-brand-600 hover:underline">Kebijakan retur</Link></li>
            <li><Link href="/bantuan#pengiriman" className="hover:text-brand-600 hover:underline">Kebijakan pengiriman</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold">Perusahaan</p>
          <p className="mt-3 text-sm text-text-secondary">
            Identitas badan usaha, alamat, dan kontak resmi diisi dari data bisnis yang sah sebelum peluncuran.
          </p>
        </div>
        <div>
          <p className="font-bold">Pembayaran &amp; pengiriman</p>
          <p className="mt-3 text-sm text-text-secondary">
            Metode pembayaran dan kurir ditampilkan hanya setelah integrasi penyedia terverifikasi.
          </p>
        </div>
      </div>
      <p className="border-t border-border-default px-4 py-4 text-center text-xs text-text-secondary">
        NOVA STORE adalah nama brand sementara. © {new Date().getFullYear()} · Data katalog adalah contoh.
      </p>
    </footer>
  );
}
