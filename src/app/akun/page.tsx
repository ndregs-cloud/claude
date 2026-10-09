import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Button, Card, LinkButton, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatIDR } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth-context";
import { ordersForUser } from "@/lib/services/orders";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/domain/order-state";

export const metadata: Metadata = { title: "Akun" };

export default async function AkunPage() {
  const viewer = await getCurrentUser();
  if (!viewer) return null;
  const recent = ordersForUser(viewer.id).slice(0, 3);
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Halo, {viewer.name}</h1>
          <p className="text-text-secondary">{viewer.email}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">Keluar</Button>
        </form>
      </header>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Pesanan terbaru</h2>
          <Link href="/akun/pesanan" className="text-sm font-semibold text-brand-600 hover:underline">Semua pesanan →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p className="text-text-secondary">Belum ada pesanan. Pesanan yang Anda buat akan tampil di sini.</p>
            <LinkButton href="/belanja" variant="secondary">Mulai belanja</LinkButton>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border-default">
            {recent.map((order) => (
              <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/pesanan/${order.orderNumber}`} className="font-mono font-semibold hover:underline">{order.orderNumber}</Link>
                  <p className="text-sm text-text-secondary">{formatDateTime(order.createdAt)} · {formatIDR(order.totalIdr)}</p>
                </div>
                <StatusBadge tone={STATUS_TONE[order.status]} label={STATUS_LABEL[order.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
