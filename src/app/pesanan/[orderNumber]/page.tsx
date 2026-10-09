import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOrderAction } from "@/app/actions/account";
import { simulatePaymentAction } from "@/app/actions/simulation";
import { Alert, Button, Card, LinkButton } from "@/components/ui";
import { AddressBlock, OrderLinesTable, OrderStatusBadge, OrderTimeline, OrderTotals } from "@/components/order-views";
import { ReturnForm } from "@/components/return-form";
import { formatDateTime } from "@/lib/format";
import { getCurrentUser, getGuestOrderNumbers } from "@/lib/auth-context";
import { getOrderForViewer } from "@/lib/services/orders";
import { mockPaymentProvider } from "@/lib/payments/provider";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Detail pesanan" };

type Params = Promise<{ orderNumber: string }>;
type Search = Promise<Record<string, string | undefined>>;

export default async function PesananPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  const guests = await getGuestOrderNumbers();
  const order = getOrderForViewer(orderNumber.toUpperCase(), viewer, guests);
  if (!order) notFound();

  const isOwnerOrGuest = (viewer && viewer.id === order.userId) || (order.userId === null && guests.includes(order.orderNumber));
  const canSimulate = process.env.NODE_ENV !== "production" && mockPaymentProvider.isSimulation && order.status === "pending_payment";
  const hasOpenRefund = [...getDb().refunds.values()].some((r) => r.orderNumber === order.orderNumber);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-text-secondary">Nomor pesanan</p>
          <h1 className="font-mono text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-text-secondary">Dibuat {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {sp.baru ? <Alert tone="success" title="Pesanan dibuat">Pesanan Anda tersimpan. Selesaikan pembayaran agar pesanan dapat diproses.</Alert> : null}
      {sp.pesan ? <Alert tone="success">{sp.pesan}</Alert> : null}
      {sp.galat ? <Alert tone="danger">{sp.galat}</Alert> : null}

      <Card>
        <h2 className="text-lg font-bold">Status pesanan</h2>
        <div className="mt-2 text-sm leading-relaxed">
          {order.status === "pending_payment" ? (
            <>
              <p>Pembayaran sedang menunggu konfirmasi dari penyedia. Status akan diperbarui setelah penyedia mengonfirmasi.</p>
              {order.reservedUntil ? <p className="mt-1 text-text-secondary">Selesaikan sebelum {formatDateTime(order.reservedUntil)}, setelah itu stok yang direservasi dilepas.</p> : null}
            </>
          ) : null}
          {order.status === "paid" || order.status === "processing" ? <p>Pembayaran terkonfirmasi. Pesanan sedang disiapkan oleh gudang.</p> : null}
          {order.status === "shipped" ? <p>Pesanan dikirim melalui {order.carrier} dengan nomor resi <span className="font-mono font-semibold">{order.trackingNumber}</span>.</p> : null}
          {order.status === "delivered" || order.status === "completed" ? <p>Pesanan sudah terkirim{order.deliveredAt ? ` pada ${formatDateTime(order.deliveredAt)}` : ""}.</p> : null}
          {order.status === "cancelled" ? <p>Pesanan dibatalkan. Stok yang direservasi sudah dilepas.</p> : null}
          {order.status === "return_requested" ? <p>Permintaan retur Anda sedang ditinjau.</p> : null}
          {order.status === "return_approved" ? <p>Retur disetujui. Silakan kirim barang sesuai instruksi dari tim kami.</p> : null}
          {order.status === "returned" ? <p>Barang retur sudah diterima dan diperiksa. Proses refund mengikuti konfirmasi penyedia.</p> : null}
          {order.status === "partially_refunded" ? <p>Refund sebagian sudah dikonfirmasi penyedia pembayaran.</p> : null}
          {order.status === "refunded" ? <p>Refund sudah dikonfirmasi penyedia pembayaran.</p> : null}
          {hasOpenRefund && order.status === "returned" ? <p className="mt-1 text-text-secondary">Refund yang sedang diproses menunggu konfirmasi penyedia.</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {canSimulate && isOwnerOrGuest ? (
            <form action={simulatePaymentAction}>
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <Button type="submit" variant="secondary">Simulasikan pembayaran berhasil (dev)</Button>
            </form>
          ) : null}
          {order.status === "pending_payment" && isOwnerOrGuest ? (
            <form action={cancelOrderAction}>
              <input type="hidden" name="orderNumber" value={order.orderNumber} />
              <Button type="submit" variant="tertiary" className="text-danger">Batalkan pesanan</Button>
            </form>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-bold">Item</h2>
            <div className="mt-3"><OrderLinesTable order={order} /></div>
          </Card>
          {isOwnerOrGuest && order.status === "delivered" ? <ReturnForm order={order} /> : null}
        </div>
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-bold">Ringkasan biaya</h2>
            <div className="mt-3"><OrderTotals order={order} /></div>
            <p className="mt-3 text-xs text-text-secondary">Status pembayaran: {order.paymentStatus === "paid" ? "Dibayar (terkonfirmasi)" : order.paymentStatus === "pending" ? "Menunggu" : order.paymentStatus === "unpaid" ? "Belum dibayar" : order.paymentStatus}</p>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Alamat pengiriman</h2>
            <div className="mt-3"><AddressBlock order={order} /></div>
            <p className="mt-3 text-sm text-text-secondary">Layanan: {order.shippingServiceName} · Estimasi {order.shippingEstimate}</p>
          </Card>
          <Card>
            <h2 className="text-lg font-bold">Riwayat</h2>
            <div className="mt-4"><OrderTimeline order={order} /></div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <LinkButton href="/belanja" variant="secondary">Lanjut belanja</LinkButton>
        <Link href="/bantuan" className="inline-flex h-11 items-center px-4 font-semibold text-brand-600 hover:underline">Butuh bantuan?</Link>
      </div>
    </div>
  );
}
