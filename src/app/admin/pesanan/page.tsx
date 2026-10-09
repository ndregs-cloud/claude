import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, FieldLabelSelect, Section } from "@/components/admin-ui";
import { StatusBadge, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatIDR } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth-context";
import { can } from "@/lib/domain/permissions";
import { maskEmail } from "@/lib/domain/validation";
import { ORDER_STATUSES, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/domain/order-state";
import { listOrders } from "@/lib/services/orders";

export const metadata: Metadata = { title: "Admin · Pesanan" };

export default async function AdminPesananPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  if (!can(viewer, "order.read")) return <AccessDenied permission="order.read" />;
  const status = ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined;
  const q = (sp.q ?? "").trim().toUpperCase();
  const canCustomer = can(viewer, "customer.read");
  const orders = listOrders()
    .filter((o) => !status || o.status === status)
    .filter((o) => !q || o.orderNumber.includes(q) || o.contact.email.toUpperCase().includes(q));

  return (
    <Section title={`Pesanan (${orders.length})`}>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Cari nomor pesanan atau email
          <input name="q" defaultValue={sp.q ?? ""} className="h-11 w-64 rounded-md border border-border-default px-3 font-normal" />
        </label>
        <FieldLabelSelect>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
            <option value="">Semua</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </FieldLabelSelect>
        <button type="submit" className={buttonClass("secondary")}>Terapkan</button>
      </form>
      {orders.length === 0 ? (
        <p className="text-text-secondary">Tidak ada pesanan yang cocok dengan filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Daftar pesanan</caption>
            <thead className="text-left text-text-secondary">
              <tr className="border-b border-border-default">
                <th scope="col" className="py-2 font-medium">Nomor</th>
                <th scope="col" className="py-2 font-medium">Dibuat</th>
                <th scope="col" className="py-2 font-medium">Pemesan</th>
                <th scope="col" className="py-2 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium">Pembayaran</th>
                <th scope="col" className="py-2 text-right font-medium">Total</th>
                <th scope="col" className="py-2"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderNumber} className="border-b border-border-default last:border-0">
                  <td className="py-3 font-mono">{o.orderNumber}</td>
                  <td className="py-3">{formatDateTime(o.createdAt)}</td>
                  <td className="py-3">{canCustomer ? o.contact.email : maskEmail(o.contact.email)}</td>
                  <td className="py-3"><StatusBadge tone={STATUS_TONE[o.status]} label={STATUS_LABEL[o.status]} /></td>
                  <td className="py-3">{o.paymentStatus}</td>
                  <td className="py-3 text-right tabular-nums">{formatIDR(o.totalIdr)}</td>
                  <td className="py-3 text-right"><Link href={`/admin/pesanan/${o.orderNumber}`} className="font-semibold text-brand-600 hover:underline">Buka</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
