import { requestReturnAction } from "@/app/actions/account";
import type { Order } from "@/lib/domain/types";
import { Button, TextField } from "./ui";

/** Form retur untuk pelanggan. Jumlah dibatasi sisa barang yang belum diretur. */
export function ReturnForm({ order }: { order: Order }) {
  const returnable = order.lines.filter((line) => line.quantity - line.returnedQuantity > 0);
  if (returnable.length === 0) return null;
  return (
    <form action={requestReturnAction} className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5" aria-labelledby="retur-title">
      <input type="hidden" name="orderNumber" value={order.orderNumber} />
      <h2 id="retur-title" className="text-lg font-bold">Ajukan retur</h2>
      <p className="text-sm text-text-secondary">Pilih item dan jumlah yang ingin diretur. Pengajuan ditinjau oleh tim kami sesuai kebijakan retur.</p>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Item yang diretur</legend>
        {returnable.map((line) => {
          const max = line.quantity - line.returnedQuantity;
          const id = `qty-${line.sku}`;
          return (
            <div key={line.sku} className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor={id} className="text-sm">
                <span className="font-medium">{line.productName}</span>
                <span className="block text-text-secondary">{line.variantLabel}</span>
              </label>
              <select id={id} name={`qty_${line.sku}`} defaultValue="0" className="h-11 rounded-md border border-border-default px-3">
                <option value="0">Tidak diretur</option>
                {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          );
        })}
      </fieldset>
      <TextField name="reason" label="Alasan retur" required placeholder="Contoh: ukuran tidak sesuai, barang rusak saat diterima" help="Minimal 10 karakter." />
      <div>
        <Button type="submit" variant="secondary">Kirim permintaan retur</Button>
      </div>
    </form>
  );
}
