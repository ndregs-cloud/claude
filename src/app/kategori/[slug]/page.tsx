import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingView } from "@/components/listing-view";
import { parseListingParams, type SearchParams } from "@/lib/listing-params";
import { getCategory, searchProducts } from "@/lib/services/catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  return { title: category ? category.name : "Kategori" };
}

export default async function KategoriPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const parsed = parseListingParams(await searchParams, slug);
  const result = searchProducts(parsed.query);
  return (
    <ListingView
      basePath={`/kategori/${slug}`}
      title={category.name}
      description={category.description}
      crumbs={[{ label: "Beranda", href: "/" }, { label: "Kategori", href: "/belanja" }, { label: category.name }]}
      parsed={parsed}
      result={result}
      showCategoryFilter={false}
      forcedCategory={slug}
    />
  );
}
