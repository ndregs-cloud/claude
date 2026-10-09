// Adapter pengiriman. Tarif di bawah adalah SIMULASI untuk pengembangan, bukan tarif kurir.
// Tarif sebenarnya harus dihitung dari penyedia pengiriman (lihat blueprint section 11.4).

export interface ShippingQuoteRequest {
  province: string;
  city: string;
  postalCode: string;
}

export interface ShippingQuote {
  serviceId: string;
  serviceName: string;
  costIdr: number;
  estimate: string;
}

export interface ShippingProvider {
  readonly name: string;
  readonly isSimulation: boolean;
  quote(request: ShippingQuoteRequest): Promise<ShippingQuote[]>;
}

export const PROVINCES = [
  "DKI Jakarta",
  "Jawa Barat",
  "Banten",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Bali",
  "Riau",
  "Sumatera Utara",
] as const;

const JABODETABEK = new Set(["DKI Jakarta", "Jawa Barat", "Banten"]);

export const mockShippingProvider: ShippingProvider = {
  name: "mock",
  isSimulation: true,
  async quote(request) {
    const nearby = JABODETABEK.has(request.province);
    return [
      {
        serviceId: "reguler",
        serviceName: "Reguler (simulasi)",
        costIdr: nearby ? 15_000 : 28_000,
        estimate: nearby ? "1–2 hari (simulasi)" : "3–5 hari (simulasi)",
      },
      {
        serviceId: "ekspres",
        serviceName: "Ekspres (simulasi)",
        costIdr: nearby ? 30_000 : 52_000,
        estimate: nearby ? "Hari ini–1 hari (simulasi)" : "1–2 hari (simulasi)",
      },
    ];
  },
};
