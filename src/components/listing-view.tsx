import Link from "next/link";
import { EmptyState, Alert, buttonClass } from "./ui";
import { ProductCard } from "./product-card";
import { Pagination } from "./pagination";
import { Breadcrumb } from "./breadcrumb";
import { CATEGORIES } from "@/lib/catalog/seed";
import { SORT_OPTIONS, type ListingResult } from "@/lib/services/catalog";
import { listingHref, type ParsedListing } from "@/lib/listing-params";
import { formatIDR } from "@/lib/money";

interface Props {
  basePath: string;
  title: string;
  description?: string;
  crumbs: { label: string; href?: string }[];
  parsed: ParsedListing;
  result: ListingResult;
  showCategoryFilter: boolean;
  forcedCategory?: string;
  emptyTitle?: string;
}

export function ListingView({ basePath, title, description, crumbs, parsed, result, showCategoryFilter, forcedCategory, emptyTitle }: Props) {
  const { raw } = parsed;
  const filters = {
    q: raw.q || undefined,
    kategori: showCategoryFilter ? raw.category || undefined : undefined,
    minHarga: raw.minPrice || undefined,
    maxHarga: raw.maxPrice || undefined,
    tersedia: raw.inStock,
    urut: raw.sort !== "relevance" && raw.sort !== "newest" ? raw.sort : undefined,
  };
  const chips: { label: string; href: string }[] = [];
  if (raw.q) chips.push({ label: `Kata kunci: ${raw.q}`, href: listingHref(basePath, { ...filters, q: undefined }) });
  if (showCategoryFilter && raw.category) {
    const name = CATEGORIES.find((c) => c.slug === raw.category)?.name ?? raw.category;
    chips.push({ label: `Kategori: ${name}`, href: listingHref(basePath, { ...filters, kategori: undefined }) });
  }
  if (raw.minPrice) chips.push({ label: `Min. ${formatIDR(Number(raw.minPrice))}`, href: listingHref(basePath, { ...filters, minHarga: undefined }) });
  if (raw.maxPrice) chips.push({ label: `Maks. ${formatIDR(Number(raw.maxPrice))}`, href: listingHref(basePath, { ...filters, maxHarga: undefined }) });
  if (raw.inStock) chips.push({ label: "Stok tersedia", href: listingHref(basePath, { ...filters, tersedia: false }) });

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <Breadcrumb items={crumbs} />
      <header className="mt-3 flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {description ? <p className="text-text-secondary">{description}</p> : null}
      </header>

      {parsed.errors.map((message) => (
        <div key={message} className="mt-4">
          <Alert tone="warning">{message}</Alert>
        </div>
      ))}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <form action={basePath} method="get" aria-labelledby="filter-title" className="h-fit rounded-xl border border-border-default bg-surface p-4 lg:sticky lg:top-24">
          <h2 id="filter-title" className="text-base font-bold">Filter &amp; urutkan</h2>
          {raw.q && !forcedCategory ? <input type="hidden" name="q" value={raw.q} /> : null}
          <div className="mt-4 flex flex-col gap-4 text-sm">
            {showCategoryFilter ? (
              <label className="flex flex-col gap-1.5 font-semibold">
                Kategori
                <select name="kategori" defaultValue={raw.category} className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
                  <option value="">Semua kategori</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 font-semibold">Rentang harga (IDR)</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-text-secondary">Minimum</span>
                  <input name="minHarga" inputMode="numeric" defaultValue={raw.minPrice} placeholder="0" className="h-11 rounded-md border border-border-default px-3" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-text-secondary">Maksimum</span>
                  <input name="maxHarga" inputMode="numeric" defaultValue={raw.maxPrice} placeholder="Tanpa batas" className="h-11 rounded-md border border-border-default px-3" />
                </label>
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="tersedia" value="1" defaultChecked={raw.inStock} className="size-5 accent-brand-600" />
              Hanya yang tersedia
            </label>
            <label className="flex flex-col gap-1.5 font-semibold">
              Urutkan
              <select name="urut" defaultValue={raw.sort} className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
                {SORT_OPTIONS.filter((o) => o.value !== "relevance" || raw.q).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2 pt-2">
              <button type="submit" className={buttonClass("primary", "md", true)}>Terapkan</button>
              <Link href={basePath} className={buttonClass("secondary", "md", true)}>Reset</Link>
            </div>
          </div>
        </form>

        <section aria-labelledby="hasil-title" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="hasil-title" className="text-base font-semibold" aria-live="polite">
              {result.total} produk ditemukan
            </h2>
          </div>
          {chips.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Filter aktif">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <Link href={chip.href} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-600/30 bg-brand-50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-600/10">
                    {chip.label}
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Hapus filter {chip.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {result.items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={emptyTitle ?? "Tidak ada produk yang cocok"}
                description={
                  raw.q
                    ? `Tidak ada hasil untuk “${raw.q}”. Coba kata kunci lain atau hapus sebagian filter.`
                    : "Belum ada produk yang cocok dengan filter ini. Hapus filter untuk melihat semua produk."
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    <Link href={basePath} className={buttonClass("secondary")}>Hapus semua filter</Link>
                    <Link href="/belanja" className={buttonClass("tertiary")}>Jelajahi semua kategori</Link>
                  </div>
                }
              />
            </div>
          ) : (
            <>
              <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
                {result.items.map((item) => (
                  <li key={item.product.id}>
                    <ProductCard item={item} />
                  </li>
                ))}
              </ul>
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                buildHref={(p) => listingHref(basePath, { ...filters, halaman: p > 1 ? p : undefined })}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
