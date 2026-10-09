import { CATEGORIES } from "../catalog/seed";
import { getDb } from "../db";
import type { Category, Product, Variant } from "../domain/types";
import { availableQuantity } from "./inventory";

export const LOW_STOCK_THRESHOLD = 5;
export const PAGE_SIZE = 12;

export type SortKey = "relevance" | "newest" | "price_asc" | "price_desc";
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevansi" },
  { value: "newest", label: "Terbaru" },
  { value: "price_asc", label: "Harga terendah" },
  { value: "price_desc", label: "Harga tertinggi" },
];

export interface ProductSummary {
  product: Product;
  minPriceIdr: number;
  maxPriceIdr: number;
  inStock: boolean;
  lowStock: boolean;
}

export function getCategories(): Category[] {
  return CATEGORIES;
}

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function variantPriceIdr(product: Product, variant: Variant): number {
  return product.basePriceIdr + variant.priceAdjustmentIdr;
}

export function publicProducts(): Product[] {
  return getDb().products.filter((product) => product.status === "active");
}

export function getPublicProductBySlug(slug: string): Product | undefined {
  return publicProducts().find((product) => product.slug === slug);
}

export function getProductBySlugForStaff(slug: string): Product | undefined {
  return getDb().products.find((product) => product.slug === slug);
}

/** Konteks SKU untuk keranjang/checkout. Hanya produk aktif yang bisa dibeli. */
export function findSellableSku(sku: string): { product: Product; variant: Variant; unitPriceIdr: number } | null {
  for (const product of publicProducts()) {
    const variant = product.variants.find((item) => item.sku === sku);
    if (variant) return { product, variant, unitPriceIdr: variantPriceIdr(product, variant) };
  }
  return null;
}

export function summarize(product: Product): ProductSummary {
  const prices = product.variants.map((variant) => variantPriceIdr(product, variant));
  const availability = product.variants.map((variant) => availableQuantity(variant.sku));
  const totalAvailable = availability.reduce((sum, value) => sum + value, 0);
  return {
    product,
    minPriceIdr: Math.min(...prices),
    maxPriceIdr: Math.max(...prices),
    inStock: availability.some((value) => value > 0),
    lowStock: totalAvailable > 0 && totalAvailable <= LOW_STOCK_THRESHOLD,
  };
}

export interface ListingQuery {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface ListingResult {
  items: ProductSummary[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  effectiveSort: SortKey;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** Skor relevansi sederhana: nama > brand/kategori > deskripsi. Semua token harus cocok. */
function relevanceScore(product: Product, tokens: string[]): number {
  const name = product.name.toLowerCase();
  const brand = product.brand.toLowerCase();
  const category = (getCategory(product.categorySlug)?.name ?? "").toLowerCase();
  const detail = `${product.description} ${product.highlights.join(" ")}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const hits =
      (name.includes(token) ? 3 : 0) +
      (brand.includes(token) || category.includes(token) ? 2 : 0) +
      (detail.includes(token) ? 1 : 0);
    if (hits === 0) return 0;
    score += hits;
  }
  return score;
}

export function searchProducts(query: ListingQuery): ListingResult {
  const tokens = tokenize(query.q ?? "");
  const pageSize = query.pageSize ?? PAGE_SIZE;
  let sort: SortKey = query.sort ?? (tokens.length > 0 ? "relevance" : "newest");

  let summaries = publicProducts()
    .filter((product) => !query.category || product.categorySlug === query.category)
    .map((product) => ({ summary: summarize(product), score: relevanceScore(product, tokens) }))
    .filter(({ score }) => tokens.length === 0 || score > 0);

  summaries = summaries.filter(({ summary }) => {
    if (query.minPrice !== undefined && summary.maxPriceIdr < query.minPrice) return false;
    if (query.maxPrice !== undefined && summary.minPriceIdr > query.maxPrice) return false;
    if (query.inStockOnly && !summary.inStock) return false;
    return true;
  });

  if (sort === "relevance" && tokens.length === 0) sort = "newest";
  summaries.sort((a, b) => {
    switch (sort) {
      case "relevance":
        return b.score - a.score || a.summary.product.name.localeCompare(b.summary.product.name, "id");
      case "price_asc":
        return a.summary.minPriceIdr - b.summary.minPriceIdr;
      case "price_desc":
        return b.summary.minPriceIdr - a.summary.minPriceIdr;
      case "newest":
      default:
        return b.summary.product.createdAt.localeCompare(a.summary.product.createdAt);
    }
  });

  const total = summaries.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
  const items = summaries.slice((page - 1) * pageSize, page * pageSize).map((entry) => entry.summary);

  return { items, total, page, pageCount, pageSize, effectiveSort: sort };
}
