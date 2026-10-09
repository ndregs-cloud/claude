// Semua nominal disimpan sebagai bilangan bulat rupiah (IDR tidak memakai desimal).
// Jangan pernah memakai floating point sebagai sumber kebenaran moneter.

const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function assertRupiah(amount: number): void {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError(`Nominal harus bilangan bulat rupiah, diterima: ${amount}`);
  }
}

export function formatIDR(amount: number): string {
  assertRupiah(amount);
  return formatter.format(amount);
}

export function percentOf(amount: number, percent: number): number {
  assertRupiah(amount);
  return Math.floor((amount * percent) / 100);
}
