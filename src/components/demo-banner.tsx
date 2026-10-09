import { mockPaymentProvider } from "@/lib/payments/provider";
import { mockShippingProvider } from "@/lib/shipping/provider";

/** Ditampilkan selama adapter pembayaran/pengiriman masih simulasi (kredensial belum tersedia). */
export function DemoBanner() {
  if (!mockPaymentProvider.isSimulation && !mockShippingProvider.isSimulation) return null;
  return (
    <div role="note" className="bg-ink-900 px-4 py-2 text-center text-xs text-white">
      Mode simulasi: pembayaran dan pengiriman belum terhubung ke penyedia. Tidak ada transaksi atau resi nyata.
    </div>
  );
}
