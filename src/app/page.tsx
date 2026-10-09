import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { LinkButton } from "@/components/ui";
import { CATEGORIES } from "@/lib/catalog/seed";
import { getCategory, publicProducts, summarize } from "@/lib/services/catalog";

export default function HomePage() {
  const featured = publicProducts()
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 4)
    .map(summarize);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-6 md:px-8 md:py-10">
      <section aria-labelledby="hero-title" className="grid items-center gap-6 rounded-xl bg-surface p-6 shadow-1 md:grid-cols-2 md:p-10">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Koleksi baru</p>
          <h1 id="hero-title" className="text-3xl font-extrabold leading-tight md:text-[44px] md:leading-[52px]">
            Temukan produk yang cocok untukmu.
          </h1>
          <p className="text-lg text-text-secondary">
            Pilihan harian, desain fungsional, dan kualitas yang dibuat untuk menemani aktivitasmu. Harga selalu dalam Rupiah dan ringkasan biaya terlihat sebelum bayar.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <LinkButton href="/belanja" size="lg">Belanja sekarang</LinkButton>
            <Link href="/bantuan" className="inline-flex h-[52px] items-center px-4 font-semibold text-brand-600 underline-offset-4 hover:underline">
              Pusat bantuan
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3" aria-hidden="true">
          {CATEGORIES.slice(0, 4).map((category) => (
            <div key={category.slug} className="flex aspect-[4/3] items-end rounded-lg bg-brand-50 p-4 font-semibold text-brand-700">
              {category.name}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="kategori-title" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="kategori-title" className="text-xl font-bold md:text-2xl">Jelajahi kategori</h2>
          <Link href="/belanja" className="text-sm font-semibold text-brand-600 hover:underline">Lihat semua →</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link href={`/kategori/${category.slug}`} className="flex h-full min-h-14 flex-col gap-1 rounded-lg border border-border-default bg-surface p-4 hover:border-brand-600 hover:shadow-1">
                <span className="font-semibold">{getCategory(category.slug)?.name}</span>
                <span className="text-xs text-text-secondary">{category.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="unggulan-title" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="unggulan-title" className="text-xl font-bold md:text-2xl">Pilihan untukmu</h2>
            <p className="text-sm text-text-secondary">Produk populer dari koleksi terbaru.</p>
          </div>
          <Link href="/belanja" className="text-sm font-semibold text-brand-600 hover:underline">Lihat semua →</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {featured.map((item) => (
            <li key={item.product.id}>
              <ProductCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="percaya-title" className="grid gap-4 rounded-xl border border-border-default bg-surface p-6 md:grid-cols-3">
        <h2 id="percaya-title" className="sr-only">Hal yang perlu diketahui sebelum belanja</h2>
        <div><p className="font-semibold">Biaya transparan</p><p className="text-sm text-text-secondary">Subtotal, diskon, ongkir, dan total ditampilkan sebelum pembayaran.</p></div>
        <div><p className="font-semibold">Pengiriman dihitung dari alamat</p><p className="text-sm text-text-secondary">Estimasi ongkir mengikuti alamat tujuan dan layanan yang dipilih.</p></div>
        <div><p className="font-semibold">Kebijakan jelas</p><p className="text-sm text-text-secondary">Ketentuan retur dan pengiriman tersedia di <Link href="/bantuan" className="text-brand-600 underline">pusat bantuan</Link>.</p></div>
      </section>
    </div>
  );
}
