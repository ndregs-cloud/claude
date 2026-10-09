import { assertRupiah, percentOf } from "../money";
import type { Promotion } from "./promotions";
import { PROMOTIONS } from "./promotions";

export interface PriceLine {
  sku: string;
  unitPriceIdr: number;
  quantity: number;
}

export interface OrderTotals {
  lineSubtotalsIdr: number[];
  subtotalIdr: number;
  discountIdr: number;
  lineDiscountsIdr: number[];
  shippingIdr: number;
  /** PPN belum ditentukan (keputusan terbuka). Nilai 0 sampai kebijakan pajak final. */
  taxIdr: number;
  totalIdr: number;
}

export type PromoRejection =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "MIN_SPEND";

export type PromoResult =
  | { ok: true; promo: Promotion }
  | { ok: false; reason: PromoRejection; message: string };

export function findPromotion(code: string): Promotion | undefined {
  const normalized = code.trim().toUpperCase();
  return PROMOTIONS.find((promo) => promo.code === normalized);
}

/** Validasi promo di server. Minimal belanja dihitung dari subtotal sebelum diskon. */
export function validatePromotion(code: string, subtotalIdr: number, now: Date): PromoResult {
  const promo = findPromotion(code);
  if (!promo) return { ok: false, reason: "NOT_FOUND", message: "Kode promo tidak ditemukan." };
  if (!promo.active) return { ok: false, reason: "INACTIVE", message: "Kode promo tidak aktif." };
  if (now < new Date(promo.validFrom)) {
    return { ok: false, reason: "NOT_STARTED", message: "Promo belum berlaku." };
  }
  if (now > new Date(promo.validUntil)) {
    return { ok: false, reason: "EXPIRED", message: "Promo sudah berakhir." };
  }
  if (subtotalIdr < promo.minSpendIdr) {
    return {
      ok: false,
      reason: "MIN_SPEND",
      message: "Kode tidak berlaku: belum memenuhi minimal belanja. Periksa syarat promo.",
    };
  }
  return { ok: true, promo };
}

export function calculateDiscount(subtotalIdr: number, promo: Promotion | null): number {
  assertRupiah(subtotalIdr);
  if (!promo || subtotalIdr <= 0) return 0;
  const raw = promo.kind === "percent" ? percentOf(subtotalIdr, promo.value) : Math.min(promo.value, subtotalIdr);
  const capped = promo.maxDiscountIdr !== null ? Math.min(raw, promo.maxDiscountIdr) : raw;
  return Math.min(capped, subtotalIdr);
}

/**
 * Membagi diskon ke setiap baris secara proporsional. Sisa pembulatan diberikan
 * ke baris dengan subtotal terbesar, sehingga jumlah baris selalu sama dengan diskon.
 */
export function allocateDiscount(lineSubtotalsIdr: number[], discountIdr: number): number[] {
  const subtotal = lineSubtotalsIdr.reduce((sum, value) => sum + value, 0);
  if (discountIdr === 0 || subtotal === 0) return lineSubtotalsIdr.map(() => 0);

  const allocations = lineSubtotalsIdr.map((value) => Math.floor((discountIdr * value) / subtotal));
  const remainder = discountIdr - allocations.reduce((sum, value) => sum + value, 0);

  let largest = 0;
  lineSubtotalsIdr.forEach((value, index) => {
    if (value > lineSubtotalsIdr[largest]) largest = index;
  });
  allocations[largest] += remainder;
  return allocations;
}

export function computeOrderTotals(
  lines: readonly PriceLine[],
  promo: Promotion | null,
  shippingIdr: number,
): OrderTotals {
  assertRupiah(shippingIdr);
  const lineSubtotalsIdr = lines.map((line) => {
    assertRupiah(line.unitPriceIdr);
    return line.unitPriceIdr * line.quantity;
  });
  const subtotalIdr = lineSubtotalsIdr.reduce((sum, value) => sum + value, 0);
  const discountIdr = calculateDiscount(subtotalIdr, promo);
  const lineDiscountsIdr = allocateDiscount(lineSubtotalsIdr, discountIdr);
  const taxIdr = 0;
  const totalIdr = subtotalIdr - discountIdr + shippingIdr + taxIdr;

  return {
    lineSubtotalsIdr,
    subtotalIdr,
    discountIdr,
    lineDiscountsIdr,
    shippingIdr,
    taxIdr,
    totalIdr,
  };
}
