import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, buttonClass } from "@/components/ui";
import { ListingView } from "@/components/listing-view";
import { CATEGORIES } from "@/lib/catalog/seed";
import { parseListingParams, type SearchParams } from "@/lib/listing-params";
import { searchProducts } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Cari" };

export default async function CariPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const parsed = parseListingParams(await searchParams);
  if (!parsed.raw.q) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold">Cari produk</h1>
        <EmptyState
          title="Masukkan kata kunci"
          description="Cari berdasarkan nama produk, brand, atau kategori. Anda juga dapat mulai dari kategori di bawah."
        />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href={`/kategori/${c.slug}`} className={buttonClass("secondary", "sm")}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }
  const result = searchProducts(parsed.query);
  return (
    <ListingView
      basePath="/cari"
      title={`Hasil pencarian: “${parsed.raw.q}”`}
      crumbs={[{ label: "Beranda", href: "/" }, { label: "Pencarian" }]}
      parsed={parsed}
      result={result}
      showCategoryFilter
      emptyTitle="Tidak ada hasil"
    />
  );
}
