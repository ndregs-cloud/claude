// Keranjang tamu/pengguna disimpan di cookie hanya sebagai daftar {sku, quantity}.
// Harga, stok, dan total SELALU dihitung ulang di server (blueprint 5.3).
import { MAX_LINES_PER_CART, MAX_QTY_PER_LINE } from "../domain/validation";
import { findSellableSku } from "./catalog";
import { availableQuantity } from "./inventory";

export const CART_COOKIE = "ng_cart";

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface CartLineView {
  sku: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  tone: string;
  unitPriceIdr: number;
  quantity: number;
  lineTotalIdr: number;
  available: number;
  issue: string | null;
}

export interface CartView {
  lines: CartLineView[];
  subtotalIdr: number;
  itemCount: number;
  hasBlockingIssue: boolean;
}

export function parseCart(raw: string | undefined | null): CartItem[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const items: CartItem[] = [];
    for (const entry of value.slice(0, MAX_LINES_PER_CART)) {
      if (typeof entry !== "object" || entry === null) continue;
      const { sku, quantity } = entry as Record<string, unknown>;
      if (typeof sku !== "string" || sku.length > 40) continue;
      if (typeof quantity !== "number" || !Number.isInteger(quantity)) continue;
      if (quantity < 1 || quantity > MAX_QTY_PER_LINE) continue;
      if (items.some((item) => item.sku === sku)) continue;
      items.push({ sku, quantity });
    }
    return items;
  } catch {
    return [];
  }
}

export function serializeCart(items: readonly CartItem[]): string {
  return JSON.stringify(items);
}

export function addCartItem(items: readonly CartItem[], sku: string, quantity: number): CartItem[] {
  const existing = items.find((item) => item.sku === sku);
  if (existing) {
    return items.map((item) =>
      item.sku === sku ? { sku, quantity: Math.min(MAX_QTY_PER_LINE, item.quantity + quantity) } : item,
    );
  }
  if (items.length >= MAX_LINES_PER_CART) return [...items];
  return [...items, { sku, quantity: Math.min(MAX_QTY_PER_LINE, quantity) }];
}

export function setCartItemQuantity(items: readonly CartItem[], sku: string, quantity: number): CartItem[] {
  if (quantity <= 0) return items.filter((item) => item.sku !== sku);
  return items.map((item) => (item.sku === sku ? { sku, quantity: Math.min(MAX_QTY_PER_LINE, quantity) } : item));
}

export function buildCartView(items: readonly CartItem[]): CartView {
  const lines: CartLineView[] = [];
  for (const item of items) {
    const ctx = findSellableSku(item.sku);
    if (!ctx) {
      lines.push({
        sku: item.sku,
        productName: "Produk tidak tersedia",
        productSlug: "",
        variantLabel: "",
        tone: "slate",
        unitPriceIdr: 0,
        quantity: item.quantity,
        lineTotalIdr: 0,
        available: 0,
        issue: "Produk ini tidak lagi tersedia. Hapus dari keranjang.",
      });
      continue;
    }
    const available = availableQuantity(item.sku);
    let issue: string | null = null;
    if (available === 0) issue = "Stok habis. Hapus atau pilih varian lain.";
    else if (item.quantity > available) issue = `Stok tersisa ${available}. Kurangi jumlah.`;
    lines.push({
      sku: item.sku,
      productName: ctx.product.name,
      productSlug: ctx.product.slug,
      variantLabel: ctx.variant.label,
      tone: ctx.product.tone,
      unitPriceIdr: ctx.unitPriceIdr,
      quantity: item.quantity,
      lineTotalIdr: ctx.unitPriceIdr * item.quantity,
      available,
      issue,
    });
  }
  return {
    lines,
    subtotalIdr: lines.reduce((sum, line) => sum + line.lineTotalIdr, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    hasBlockingIssue: lines.some((line) => line.issue !== null),
  };
}
