import type { Metadata } from "next";
import Link from "next/link";
import { mockShippingProvider } from "@/lib/shipping/provider";

export const metadata: Metadata = { title: "Bantuan" };

const faqs = [
  { q: "Kapan pesanan saya dianggap sudah dibayar?", a: "Pesanan baru dianggap dibayar setelah penyedia pembayaran mengonfirmasi transaksi. Halaman yang kembali dari pembayaran belum tentu berarti pembayaran berhasil." },
  { q: "Berapa lama saya punya waktu membayar?", a: "Stok yang dipesan ditahan selama 30 menit. Jika belum dibayar dalam waktu tersebut, pesanan dibatalkan otomatis dan stok dilepas." },
  { q: "Bagaimana cara melacak pesanan sebagai tamu?", a: "Gunakan halaman Lacak pesanan dengan nomor pesanan dan email yang dipakai saat checkout." },
];

export default function BantuanPage() {
  return (
    <div className="mx-auto max-w-[900px] space-y-10 px-4 py-8 md:px-8">
      <header>
        <h1 className="text-2xl font-bold md:text-3xl">Pusat bantuan</h1>
        <p className="mt-1 text-text-secondary">Jawaban singkat untuk pertanyaan yang paling sering diajukan.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-brand-600">
          <Link href="/lacak-pesanan" className="hover:underline">Lacak pesanan</Link>
          <a href="#pengiriman" className="hover:underline">Pengiriman</a>
          <a href="#retur" className="hover:underline">Retur</a>
        </div>
      </header>

      <section aria-labelledby="faq-title" className="space-y-3">
        <h2 id="faq-title" className="text-xl font-bold">Pertanyaan umum</h2>
        {faqs.map((item) => (
          <details key={item.q} className="rounded-lg border border-border-default bg-surface p-4 open:shadow-1">
            <summary className="cursor-pointer font-semibold">{item.q}</summary>
            <p className="mt-2 text-text-secondary">{item.a}</p>
          </details>
        ))}
      </section>

      <section id="pengiriman" aria-labelledby="kirim-title" className="space-y-3 scroll-mt-28">
        <h2 id="kirim-title" className="text-xl font-bold">Kebijakan pengiriman</h2>
        <p className="text-text-secondary">
          Pengiriman dilayani ke alamat di Indonesia. Ongkir dan estimasi dihitung saat checkout berdasarkan alamat dan layanan yang dipilih.
          {mockShippingProvider.isSimulation ? " Pada mode simulasi ini, tarif dan estimasi belum berasal dari kurir." : ""}
        </p>
        <p className="text-text-secondary">Nomor resi ditampilkan di detail pesanan setelah pesanan dikirim.</p>
      </section>

      <section id="retur" aria-labelledby="retur-title" className="space-y-3 scroll-mt-28">
        <h2 id="retur-title" className="text-xl font-bold">Kebijakan retur</h2>
        <p className="text-text-secondary">
          Pengajuan retur dibuka dari detail pesanan yang sudah terkirim. Tim kami meninjau alasan dan kondisi barang sebelum refund diproses.
          Ketentuan batas waktu dan kategori yang dikecualikan mengikuti kebijakan resmi yang disahkan pemilik usaha.
        </p>
        <p className="text-text-secondary">Refund dianggap selesai hanya setelah penyedia pembayaran mengonfirmasi.</p>
      </section>

      <section aria-labelledby="kontak-title" className="rounded-xl border border-border-default bg-surface p-5">
        <h2 id="kontak-title" className="text-xl font-bold">Hubungi kami</h2>
        <p className="mt-2 text-text-secondary">Kanal kontak dan jam layanan akan ditampilkan setelah data resmi bisnis diisi.</p>
      </section>
    </div>
  );
}
