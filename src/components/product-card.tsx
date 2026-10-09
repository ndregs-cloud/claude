import Link from "next/link";
import type { ProductSummary } from "@/lib/services/catalog";
import { getCategory } from "@/lib/services/catalog";
import { PriceBlock } from "./money";

const TONE_BG: Record<string, string> = {
  blue: "bg-brand-50",
  green: "bg-success-bg",
  amber: "bg-warning-bg",
  violet: "bg-[#f1ecff]",
  rose: "bg-danger-bg",
  slate: "bg-neutral-bg",
};

/** Placeholder visual: bukan foto produk. Foto nyata harus memakai alt text (design doc 3.4). */
export function ProductVisual({ tone, name, className = "" }: { tone: string; name: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg ${TONE_BG[tone] ?? "bg-neutral-bg"} ${className}`}
      role="img"
      aria-label={`Gambar placeholder untuk ${name}`}
    >
      <span className="text-3xl font-bold text-text-secondary/60" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    </div>
  );
}

export function ProductCard({ item }: { item: ProductSummary }) {
  const { product } = item;
  const category = getCategory(product.categorySlug);
  const hasRange = item.minPriceIdr !== item.maxPriceIdr;
  return (
    <article className="group flex min-w-0 flex-col rounded-xl border border-border-default bg-surface p-3 shadow-1 transition-shadow hover:shadow-2">
      <Link href={`/produk/${product.slug}`} className="flex flex-1 flex-col gap-3 rounded-lg focus-visible:outline-offset-4">
        <div className="relative">
          <ProductVisual tone={product.tone} name={product.name} className="aspect-[4/5] w-full" />
          {product.badge ? (
            <span className="absolute left-2 top-2 rounded-md bg-ink-900 px-2 py-0.5 text-xs font-semibold text-white">
              {product.badge}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs text-text-secondary">{category?.name}</p>
          <h3 className="line-clamp-2 font-semibold leading-snug">{product.name}</h3>
          {product.reviewCount > 0 ? (
            <p className="text-sm text-text-secondary">
              <span className="sr-only">Rating </span>
              {product.rating.toFixed(1)} ({product.reviewCount} ulasan)
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {hasRange ? <span className="text-xs text-text-secondary">Mulai dari</span> : null}
          <PriceBlock
            currentIdr={item.minPriceIdr}
            compareAtIdr={hasRange ? null : product.compareAtIdr}
          />
          {!item.inStock ? (
            <p className="text-sm font-medium text-danger">Stok habis</p>
          ) : item.lowStock ? (
            <p className="text-sm font-medium text-warning">Stok terbatas</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
