import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied, Section } from "@/components/admin-ui";
import { Alert, Button, StatusBadge, TextField } from "@/components/ui";
import { AddressBlock, OrderLinesTable, OrderStatusBadge, OrderTimeline, OrderTotals } from "@/components/order-views";
import {
  approveRefundAction,
  decideReturnAction,
  receiveReturnAction,
  requestRefundAction,
  transitionOrderAction,
} from "@/app/actions/admin";
import { simulateRefundAction } from "@/app/actions/simulation";
import { getCurrentUser } from "@/lib/auth-context";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { formatIDR } from "@/lib/money";
import { can } from "@/lib/domain/permissions";
import { maskEmail, maskPhone } from "@/lib/domain/validation";
import { refundableAmount } from "@/lib/domain/order-state";
import { committedRefundIdr } from "@/lib/services/returns";
import { mockPaymentProvider } from "@/lib/payments/provider";
import type { OrderStatus } from "@/lib/domain/order-state";

export const metadata: Metadata = { title: "Admin · Detail pesanan" };

const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string; permission: "order.fulfill" | "order.cancel" }>> = {
  paid: { to: "processing", label: "Tandai sedang diproses", permission: "order.fulfill" },
  delivered: { to: "completed", label: "Tandai selesai", permission: "order.fulfill" },
};

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orderNumber } = await params;
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  if (!can(viewer, "order.read")) return <AccessDenied permission="order.read" />;
  const db = getDb();
  const order = db.orders.get(orderNumber);
  if (!order) notFound();
  const showFull = can(viewer, "customer.read");
  const refunds = [...db.refunds.values()].filter((r) => r.orderNumber === order.orderNumber);
  const returns = [...db.returns.values()].filter((r) => r.orderNumber === order.orderNumber);
  const openReturn = returns.find((r) => r.status === "requested" || r.status === "approved");
  const exceptions = db.paymentExceptions.filter((e) => e.orderNumber === order.orderNumber && !e.resolved);
  const committed = committedRefundIdr(order.orderNumber);
  const refundable = refundableAmount(order.totalIdr, committed);
  const canSimulateRefund = process.env.NODE_ENV !== "production" && mockPaymentProvider.isSimulation;
  const next = NEXT_STEP[order.status];
  const auditTrail = can(viewer, "audit.read")
    ? db.auditLog.filter((entry) => entry.target === order.orderNumber).slice(-20).reverse()
    : [];

  return (
    <>
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-text-secondary"><Link href="/admin/pesanan" className="hover:underline">Pesanan</Link> / detail</p>
          <h1 className="font-mono text-2xl font-bold">{order.orderNumber}</h1>
          <p className="text-sm text-text-secondary">Dibuat {formatDateTime(order.createdAt)} · Pembayaran: {order.paymentStatus}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {sp.pesan ? <Alert tone="success">{sp.pesan}</Alert> : null}
      {sp.galat ? <Alert tone="danger" title="Tindakan tidak berhasil">{sp.galat}</Alert> : null}
      {exceptions.length > 0 ? (
        <Alert tone="warning" title="Pengecualian rekonsiliasi">
          <ul className="list-disc pl-5">{exceptions.map((e) => <li key={e.id}>{e.kind}: {e.detail}</li>)}</ul>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section title="Item">
            <OrderLinesTable order={order} />
            <div className="mt-4 max-w-sm"><OrderTotals order={order} /></div>
          </Section>

          <Section title="Operasi status">
            {order.status === "pending_payment" ? (
              can(viewer, "order.cancel") ? (
                <form action={transitionOrderAction} className="flex flex-col gap-3">
                  <input type="hidden" name="orderNumber" value={order.orderNumber} />
                  <input type="hidden" name="to" value="cancelled" />
                  <TextField name="reason" label="Alasan pembatalan" required help="Stok yang direservasi akan dilepas." />
                  <Button type="submit" variant="danger" className="self-start">Batalkan pesanan</Button>
                </form>
              ) : <p className="text-sm text-text-secondary">Menunggu pembayaran dari penyedia. Tidak ada tindakan manual.</p>
            ) : null}

            {order.status === "processing" && can(viewer, "order.fulfill") ? (
              <form action={transitionOrderAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <input type="hidden" name="to" value="shipped" />
                <TextField name="carrier" label="Kurir" required placeholder="Contoh: JNE" />
                <TextField name="trackingNumber" label="Nomor resi" required placeholder="Dari kurir" />
                <div className="sm:col-span-2"><Button type="submit">Tandai dikirim</Button></div>
              </form>
            ) : null}

            {next && can(viewer, next.permission) ? (
              <form action={transitionOrderAction}>
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <input type="hidden" name="to" value={next.to} />
                <Button type="submit" variant="secondary">{next.label}</Button>
              </form>
            ) : null}
            {order.status === "shipped" && can(viewer, "order.fulfill") ? (
              <form action={transitionOrderAction}>
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <input type="hidden" name="to" value="delivered" />
                <Button type="submit" variant="secondary">Tandai terkirim</Button>
              </form>
            ) : null}
            {order.status === "paid" && !can(viewer, "order.fulfill") ? <p className="text-sm text-text-secondary">Menunggu operator gudang memproses.</p> : null}
            {order.trackingNumber ? <p className="mt-3 text-sm">Kurir {order.carrier} · Resi <span className="font-mono">{order.trackingNumber}</span></p> : null}
          </Section>

          <Section title="Retur">
            {!openReturn ? (
              <p className="text-sm text-text-secondary">Tidak ada retur terbuka. {returns.length > 0 ? `Riwayat: ${returns.length} permintaan.` : ""}</p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm">Status: <StatusBadge tone="warning" label={openReturn.status === "requested" ? "Diajukan" : "Disetujui"} /></p>
                <ul className="list-disc pl-5 text-sm">
                  {openReturn.items.map((item) => {
                    const line = order.lines.find((l) => l.sku === item.sku);
                    return <li key={item.sku}>{line?.productName ?? item.sku} ({line?.variantLabel}) × {item.quantity}</li>;
                  })}
                </ul>
                <p className="text-sm"><span className="font-semibold">Alasan:</span> {openReturn.reason}</p>
                {openReturn.status === "requested" && can(viewer, "return.decide") ? (
                  <div className="flex flex-wrap gap-3">
                    <form action={decideReturnAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="orderNumber" value={order.orderNumber} />
                      <input type="hidden" name="returnId" value={openReturn.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <input name="note" aria-label="Catatan keputusan" placeholder="Catatan (opsional)" className="h-11 rounded-md border border-border-default px-3" />
                      <Button type="submit">Setujui retur</Button>
                    </form>
                    <form action={decideReturnAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="orderNumber" value={order.orderNumber} />
                      <input type="hidden" name="returnId" value={openReturn.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input name="note" aria-label="Alasan penolakan" required placeholder="Alasan penolakan" className="h-11 rounded-md border border-border-default px-3" />
                      <Button type="submit" variant="secondary">Tolak</Button>
                    </form>
                  </div>
                ) : null}
                {openReturn.status === "approved" && can(viewer, "return.receive") ? (
                  <form action={receiveReturnAction} className="space-y-3">
                    <input type="hidden" name="orderNumber" value={order.orderNumber} />
                    <input type="hidden" name="returnId" value={openReturn.id} />
                    <p className="text-sm text-text-secondary">Isi jumlah yang benar-benar diterima. Jumlah harus sama dengan yang disetujui.</p>
                    {openReturn.items.map((item) => (
                      <div key={item.sku} className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-sm">Diterima ({item.sku})
                          <input name={`recv_${item.sku}`} type="number" min={0} defaultValue={item.quantity} className="h-11 w-24 rounded-md border border-border-default px-3" />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">Kondisi
                          <select name={`cond_${item.sku}`} defaultValue="sellable" className="h-11 rounded-md border border-border-default px-3">
                            <option value="sellable">Layak jual</option>
                            <option value="damaged">Rusak</option>
                          </select>
                        </label>
                      </div>
                    ))}
                    <Button type="submit">Catat penerimaan barang</Button>
                  </form>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Refund">
            <p className="mb-3 text-sm text-text-secondary">
              Total pesanan {formatIDR(order.totalIdr)} · Sudah diajukan/dikirim {formatIDR(committed)} · Sisa dapat di-refund {formatIDR(refundable)}
            </p>
            {refunds.length > 0 ? (
              <ul className="mb-4 divide-y divide-border-default text-sm">
                {refunds.map((refund) => (
                  <li key={refund.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold tabular-nums">{formatIDR(refund.amountIdr)}</p>
                      <p className="text-text-secondary">{refund.reason} · {formatDateTime(refund.createdAt)}</p>
                      <p className="text-text-secondary">Pengaju: {refund.requestedBy === viewer?.id ? "Anda" : "Staf lain"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "info"}
                        label={({ requested: "Menunggu persetujuan", approved: "Disetujui", submitted: "Dikirim ke penyedia", succeeded: "Berhasil (dikonfirmasi penyedia)", failed: "Gagal", rejected: "Ditolak" } as const)[refund.status]}
                      />
                      {refund.status === "requested" && can(viewer, "refund.approve") ? (
                        refund.requestedBy === viewer?.id ? (
                          <span className="text-text-secondary">Persetujuan harus dari staf lain</span>
                        ) : (
                          <form action={approveRefundAction}>
                            <input type="hidden" name="orderNumber" value={order.orderNumber} />
                            <input type="hidden" name="refundId" value={refund.id} />
                            <Button type="submit" size="sm">Setujui &amp; kirim</Button>
                          </form>
                        )
                      ) : null}
                      {refund.status === "submitted" && canSimulateRefund ? (
                        <form action={simulateRefundAction}>
                          <input type="hidden" name="orderNumber" value={order.orderNumber} />
                          <Button type="submit" size="sm" variant="secondary">Simulasikan konfirmasi (dev)</Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            {(order.status === "returned" || order.status === "partially_refunded") && can(viewer, "refund.request") && refundable > 0 ? (
              <form action={requestRefundAction} className="grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr_auto] sm:items-end">
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <label className="flex flex-col gap-1 text-sm font-semibold">Nominal (IDR)
                  <input name="amountIdr" type="number" inputMode="numeric" min={1} max={refundable} defaultValue={refundable} className="h-11 rounded-md border border-border-default px-3 font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">Alasan
                  <input name="reason" required placeholder="Contoh: retur barang rusak" className="h-11 rounded-md border border-border-default px-3 font-normal" />
                </label>
                <Button type="submit" variant="secondary">Ajukan refund</Button>
              </form>
            ) : null}
            {order.status !== "returned" && order.status !== "partially_refunded" && refunds.length === 0 ? (
              <p className="text-sm text-text-secondary">Refund hanya dapat diajukan setelah barang retur diterima.</p>
            ) : null}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Pemesan">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-text-secondary">Nama</dt><dd>{order.contact.name}</dd></div>
              <div><dt className="text-text-secondary">Email</dt><dd>{showFull ? order.contact.email : maskEmail(order.contact.email)}</dd></div>
              <div><dt className="text-text-secondary">Ponsel</dt><dd>{showFull ? order.contact.phone : maskPhone(order.contact.phone)}</dd></div>
            </dl>
            {!showFull ? <p className="mt-3 text-xs text-text-secondary">Data pribadi disamarkan. Akses penuh memerlukan izin customer.read.</p> : null}
          </Section>
          <Section title="Alamat">
            <AddressBlock order={order} />
          </Section>
          <Section title="Riwayat (termasuk internal)">
            <OrderTimeline order={order} includeInternal={can(viewer, "audit.read")} />
          </Section>
          {can(viewer, "audit.read") ? (
            <Section title="Audit">
              {auditTrail.length === 0 ? <p className="text-sm text-text-secondary">Belum ada entri audit.</p> : (
                <ul className="space-y-2 text-xs">
                  {auditTrail.map((entry) => (
                    <li key={entry.id}><span className="font-mono">{entry.action}</span> · {formatDateTime(entry.at)}</li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
