import { PAGE_SIZE, type ListingQuery, type SortKey } from "./services/catalog";

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ParsedListing {
  query: ListingQuery;
  raw: { q: string; category: string; minPrice: string; maxPrice: string; inStock: boolean; sort: SortKey; page: number };
  errors: string[];
}

const SORTS: readonly SortKey[] = ["relevance", "newest", "price_asc", "price_desc"];

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function toInt(value: string): number | undefined {
  if (!/^\d{1,12}$/.test(value)) return undefined;
  return Number(value);
}

export function parseListingParams(params: SearchParams, forcedCategory?: string): ParsedListing {
  const errors: string[] = [];
  const q = first(params.q).trim().slice(0, 80);
  const category = forcedCategory ?? first(params.kategori);
  const minRaw = first(params.minHarga).replace(/\D/g, "");
  const maxRaw = first(params.maxHarga).replace(/\D/g, "");
  let minPrice = toInt(minRaw);
  let maxPrice = toInt(maxRaw);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    errors.push("Harga minimum tidak boleh lebih besar dari harga maksimum. Filter harga diabaikan.");
    minPrice = undefined;
    maxPrice = undefined;
  }
  const sortRaw = first(params.urut) as SortKey;
  const sort = SORTS.includes(sortRaw) ? sortRaw : undefined;
  const page = Math.max(1, toInt(first(params.halaman)) ?? 1);
  const inStock = first(params.tersedia) === "1";

  return {
    query: { q, category: category || undefined, minPrice, maxPrice, inStockOnly: inStock, sort, page, pageSize: PAGE_SIZE },
    raw: {
      q,
      category,
      minPrice: minPrice !== undefined ? String(minPrice) : "",
      maxPrice: maxPrice !== undefined ? String(maxPrice) : "",
      inStock,
      sort: sort ?? (q ? "relevance" : "newest"),
      page,
    },
    errors,
  };
}

/** Membangun URL listing sambil mempertahankan filter lain. Nilai undefined/"" menghapus parameter. */
export function listingHref(base: string, current: Record<string, string | number | undefined | null | boolean>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    if (value === true) search.set(key, "1");
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `${base}?${text}` : base;
}
