import type { Metadata } from "next";
import { ListingView } from "@/components/listing-view";
import { parseListingParams, type SearchParams } from "@/lib/listing-params";
import { searchProducts } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Belanja" };

export default async function BelanjaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const parsed = parseListingParams(await searchParams);
  const result = searchProducts(parsed.query);
  return (
    <ListingView
      basePath="/belanja"
      title="Semua produk"
      description="Telusuri semua kategori. Harga dan stok ditampilkan sesuai data terbaru."
      crumbs={[{ label: "Beranda", href: "/" }, { label: "Belanja" }]}
      parsed={parsed}
      result={result}
      showCategoryFilter
    />
  );
}
