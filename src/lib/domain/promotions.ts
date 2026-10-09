// Kode promo CONTOH untuk pengembangan. Ganti dengan data promo bisnis yang disahkan pemilik usaha.

export interface Promotion {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSpendIdr: number;
  maxDiscountIdr: number | null;
  validFrom: string;
  validUntil: string;
  active: boolean;
  terms: string;
}

export const PROMOTIONS: readonly Promotion[] = [
  {
    code: "SELAMATBELANJA10",
    kind: "percent",
    value: 10,
    minSpendIdr: 200_000,
    maxDiscountIdr: 100_000,
    validFrom: "2026-01-01T00:00:00+07:00",
    validUntil: "2027-12-31T23:59:59+07:00",
    active: true,
    terms: "Diskon 10% dengan minimal belanja Rp200.000 sebelum diskon. Maksimal diskon Rp100.000. Ongkir tidak termasuk.",
  },
  {
    code: "HEMAT50",
    kind: "fixed",
    value: 50_000,
    minSpendIdr: 300_000,
    maxDiscountIdr: null,
    validFrom: "2026-01-01T00:00:00+07:00",
    validUntil: "2027-12-31T23:59:59+07:00",
    active: true,
    terms: "Potongan Rp50.000 dengan minimal belanja Rp300.000 sebelum diskon. Ongkir tidak termasuk.",
  },
  {
    code: "KADALUARSA20",
    kind: "percent",
    value: 20,
    minSpendIdr: 0,
    maxDiscountIdr: null,
    validFrom: "2025-01-01T00:00:00+07:00",
    validUntil: "2025-12-31T23:59:59+07:00",
    active: true,
    terms: "Contoh promo yang sudah berakhir untuk menguji pesan kode kedaluwarsa.",
  },
];
