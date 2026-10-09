import { describe, expect, it } from "vitest";
import { allocateDiscount, calculateDiscount, computeOrderTotals, validatePromotion } from "@/lib/domain/pricing";
import { findPromotion } from "@/lib/domain/pricing";
import { PROMOTIONS } from "@/lib/domain/promotions";
import { formatIDR } from "@/lib/money";
import { normalizePhone, parseQuantity, validateAddress } from "@/lib/domain/validation";
import { ADDRESS } from "./helpers";

const NOW = new Date("2026-10-10T03:00:00Z");

describe("format IDR", () => {
  it("memakai format rupiah id-ID tanpa desimal", () => {
    const text = formatIDR(899_000);
    expect(text).toContain("899.000");
    expect(text).toMatch(/Rp/);
    expect(text).not.toMatch(/USD|\$/);
  });

  it("menolak nominal non-integer", () => {
    expect(() => formatIDR(10.5)).toThrow(TypeError);
  });
});

describe("kalkulasi diskon", () => {
  it("persen dengan batas maksimum", () => {
    const promo = findPromotion("SELAMATBELANJA10")!;
    expect(calculateDiscount(500_000, promo)).toBe(50_000);
    expect(calculateDiscount(2_000_000, promo)).toBe(100_000); // dibatasi maxDiscount
  });

  it("nominal tetap tidak melebihi subtotal", () => {
    const promo = findPromotion("HEMAT50")!;
    expect(calculateDiscount(300_000, promo)).toBe(50_000);
  });

  it("alokasi diskon per baris selalu sama dengan total diskon", () => {
    const lines = [333_333, 333_333, 333_334];
    const allocated = allocateDiscount(lines, 100_001);
    expect(allocated.reduce((a, b) => a + b, 0)).toBe(100_001);
    expect(allocated.every((value) => Number.isInteger(value))).toBe(true);
  });

  it("total pesanan = subtotal - diskon + ongkir + pajak (0)", () => {
    const totals = computeOrderTotals(
      [
        { sku: "A", unitPriceIdr: 899_000, quantity: 2 },
        { sku: "B", unitPriceIdr: 249_000, quantity: 1 },
      ],
      findPromotion("SELAMATBELANJA10")!,
      15_000,
    );
    expect(totals.subtotalIdr).toBe(2_047_000);
    expect(totals.discountIdr).toBe(100_000);
    expect(totals.totalIdr).toBe(totals.subtotalIdr - totals.discountIdr + 15_000 + totals.taxIdr);
    expect(totals.lineDiscountsIdr.reduce((a, b) => a + b, 0)).toBe(totals.discountIdr);
  });
});

describe("validasi promo", () => {
  it("menolak kode tidak ditemukan", () => {
    const result = validatePromotion("TIDAKADA", 500_000, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("NOT_FOUND");
  });

  it("menolak promo kedaluwarsa dengan alasan yang jelas", () => {
    const result = validatePromotion("KADALUARSA20", 500_000, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("EXPIRED");
  });

  it("minimal belanja dihitung dari subtotal sebelum diskon", () => {
    const result = validatePromotion("HEMAT50", 299_999, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("MIN_SPEND");
  });

  it("kode dinormalisasi (huruf kecil dan spasi)", () => {
    const result = validatePromotion("  hemat50 ", 400_000, NOW);
    expect(result.ok).toBe(true);
  });

  it("semua promo contoh memiliki syarat tertulis", () => {
    expect(PROMOTIONS.every((promo) => promo.terms.length > 10)).toBe(true);
  });
});

describe("validasi input", () => {
  it("nomor ponsel Indonesia dinormalisasi ke +62", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("+6281234567890");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("08abc")).toBeNull();
  });

  it("jumlah hanya bilangan bulat 1–10", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("11")).toBeNull();
    expect(parseQuantity("2.5")).toBeNull();
  });

  it("alamat wajib lengkap dengan kode pos 5 digit", () => {
    const bad = validateAddress({ ...ADDRESS, postalCode: "123" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.postalCode).toBeDefined();
    expect(validateAddress(ADDRESS).ok).toBe(true);
  });
});
