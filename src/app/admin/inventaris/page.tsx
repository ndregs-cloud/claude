import type { Metadata } from "next";
import { AccessDenied, FieldLabelSelect, Section } from "@/components/admin-ui";
import { Alert, Button, StatusBadge, TextField } from "@/components/ui";
import { adjustStockAction } from "@/app/actions/admin";
import { getCurrentUser } from "@/lib/auth-context";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/domain/permissions";
import { ADJUSTMENT_REASONS, availableQuantity } from "@/lib/services/inventory";
import { LOW_STOCK_THRESHOLD } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Admin · Inventaris" };

export default async function InventarisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getCurrentUser();
  if (!can(viewer, "inventory.read")) return <AccessDenied permission="inventory.read" />;
  const db = getDb();
  const rows = db.products.flatMap((product) =>
    product.variants.map((variant) => ({
      sku: variant.sku,
      product: product.name,
      variant: variant.label,
      status: product.status,
      row: db.stock.get(variant.sku),
    })),
  );
  const movements = [...db.stockMovements].slice(-15).reverse();
  const canAdjust = can(viewer, "inventory.adjust");

  return (
    <>
      {sp.pesan ? <Alert tone="success">{sp.pesan}</Alert> : null}
      {sp.galat ? <Alert tone="danger">{sp.galat}</Alert> : null}
      <Section title="Stok per SKU">
        <p className="mb-3 text-sm text-text-secondary">Tersedia = fisik − reservasi − safety stock. Angka ini adalah sumber untuk tampilan toko.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Saldo stok per SKU</caption>
            <thead className="text-left text-text-secondary">
              <tr className="border-b border-border-default">
                <th scope="col" className="py-2 font-medium">SKU</th>
                <th scope="col" className="py-2 font-medium">Produk</th>
                <th scope="col" className="py-2 text-right font-medium">Fisik</th>
                <th scope="col" className="py-2 text-right font-medium">Reservasi</th>
                <th scope="col" className="py-2 text-right font-medium">Rusak</th>
                <th scope="col" className="py-2 text-right font-medium">Tersedia</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const available = availableQuantity(r.sku);
                const tone = available === 0 ? "danger" : available <= LOW_STOCK_THRESHOLD ? "warning" : "success";
                const label = available === 0 ? "Habis" : available <= LOW_STOCK_THRESHOLD ? "Menipis" : "Aman";
                return (
                  <tr key={r.sku} className="border-b border-border-default last:border-0">
                    <td className="py-2 font-mono">{r.sku}</td>
                    <td className="py-2">{r.product} · {r.variant}{r.status !== "active" ? <span className="ml-2 text-text-secondary">({r.status})</span> : null}</td>
                    <td className="py-2 text-right tabular-nums">{r.row?.onHand ?? 0}</td>
                    <td className="py-2 text-right tabular-nums">{r.row?.reserved ?? 0}</td>
                    <td className="py-2 text-right tabular-nums">{r.row?.damaged ?? 0}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{available}</td>
                    <td className="py-2"><StatusBadge tone={tone} label={label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {canAdjust ? (
        <Section title="Penyesuaian stok">
          <form action={adjustStockAction} className="grid gap-4 sm:grid-cols-2">
            <FieldLabelSelect>
              <label htmlFor="adj-sku">SKU</label>
              <select id="adj-sku" name="sku" required className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
                {rows.map((r) => <option key={r.sku} value={r.sku}>{r.sku} — {r.product} ({r.variant})</option>)}
              </select>
            </FieldLabelSelect>
            <TextField name="delta" label="Perubahan (bisa negatif)" type="number" required inputMode="numeric" help="Contoh: 5 atau -2. Tidak boleh 0." />
            <FieldLabelSelect>
              <label htmlFor="adj-reason">Alasan</label>
              <select id="adj-reason" name="reason" required className="h-11 rounded-md border border-border-default bg-surface px-3 font-normal">
                {ADJUSTMENT_REASONS.map((reason) => <option key={reason.code} value={reason.code}>{reason.label}</option>)}
              </select>
            </FieldLabelSelect>
            <TextField name="note" label="Catatan" required help="Jelaskan penyebab perubahan (minimal 5 karakter)." />
            <div className="sm:col-span-2"><Button type="submit">Simpan penyesuaian</Button></div>
          </form>
        </Section>
      ) : null}

      <Section title="Ledger terbaru">
        {movements.length === 0 ? <p className="text-sm text-text-secondary">Belum ada pergerakan stok.</p> : (
          <ul className="divide-y divide-border-default text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-mono">{m.sku}</span>
                <span>{m.type} · fisik {m.onHandDelta >= 0 ? "+" : ""}{m.onHandDelta} · reservasi {m.reservedDelta >= 0 ? "+" : ""}{m.reservedDelta}</span>
                <span className="text-text-secondary">{m.reason}</span>
                <span className="text-text-secondary">{formatDateTime(m.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
