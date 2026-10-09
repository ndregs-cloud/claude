import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkButton, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatIDR } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth-context";
import { ORDER_STATUSES, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/domain/order-state";
import { ordersForUser } from "@/lib/services/orders";

export const metadata: Metadata = { title: "Riwayat pesanan" };

export default async function RiwayatPesananPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  if (!viewer) return null;
  const status = ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined;
  const orders = ordersForUser(viewer.id).filter((order) => !status || order.status === status);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Riwayat pesanan</h1>
          <p className="text-text-secondary">Pesanan yang dibuat dengan akun ini.</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Status
            <select name="status" defaultValue={status ?? ""} className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
              <option value="">Semua status</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <button type="submit" className="h-11 rounded-md border border-border-default bg-surface px-4 text-sm font-semibold hover:bg-canvas">Terapkan</button>
        </form>
      </header>

      {orders.length === 0 ? (
        <EmptyState title={status ? "Tidak ada pesanan dengan status ini" : "Belum ada pesanan"} description="Pesanan yang Anda buat akan tercatat di sini beserta status terbarunya." action={<LinkButton href="/belanja">Belanja sekarang</LinkButton>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-default bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Daftar pesanan Anda</caption>
            <thead className="bg-canvas text-left text-text-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Nomor pesanan</th>
                <th scope="col" className="px-4 py-3 font-medium">Tanggal</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.orderNumber} className="border-t border-border-default">
                  <td className="px-4 py-3 font-mono">{order.orderNumber}</td>
                  <td className="px-4 py-3">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[order.status]} label={STATUS_LABEL[order.status]} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatIDR(order.totalIdr)}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/pesanan/${order.orderNumber}`} className="font-semibold text-brand-600 hover:underline">Detail</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
