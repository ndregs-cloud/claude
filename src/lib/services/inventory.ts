// Ledger stok. Setiap perubahan meninggalkan jejak di stockMovements.
// Ketersediaan jual = onHand - reserved - safetyStock (minimum 0).
import { audit, getDb, newId, now } from "../db";
import { DomainError } from "../domain/errors";
import { requirePermission } from "../domain/permissions";
import type { StockMovement, StockMovementType, Viewer } from "../domain/types";

export const ADJUSTMENT_REASONS = [
  { code: "stock_opname", label: "Hasil stock opname" },
  { code: "barang_rusak", label: "Barang rusak di gudang" },
  { code: "koreksi_input", label: "Koreksi kesalahan input" },
  { code: "penerimaan_barang", label: "Penerimaan barang" },
] as const;

export interface StockLine {
  sku: string;
  quantity: number;
}

export class StockError extends DomainError {
  constructor(
    public readonly sku: string,
    public readonly availableQuantity: number,
  ) {
    super("STOCK_INSUFFICIENT", `Jumlah yang diminta tidak tersedia (sisa ${availableQuantity}).`);
    this.name = "StockError";
  }
}

export function getStockRow(sku: string) {
  return getDb().stock.get(sku);
}

export function availableQuantity(sku: string): number {
  const row = getDb().stock.get(sku);
  if (!row) return 0;
  return Math.max(0, row.onHand - row.reserved - row.safetyStock);
}

function record(
  sku: string,
  type: StockMovementType,
  deltas: { onHand?: number; reserved?: number; damaged?: number },
  reason: string,
  orderNumber: string | null,
  actorId: string | null,
): void {
  const movement: StockMovement = {
    id: newId(),
    sku,
    type,
    onHandDelta: deltas.onHand ?? 0,
    reservedDelta: deltas.reserved ?? 0,
    damagedDelta: deltas.damaged ?? 0,
    reason,
    orderNumber,
    actorId,
    at: now().toISOString(),
  };
  getDb().stockMovements.push(movement);
}

function mergeLines(lines: readonly StockLine[]): StockLine[] {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.sku, (merged.get(line.sku) ?? 0) + line.quantity);
  return [...merged.entries()].map(([sku, quantity]) => ({ sku, quantity }));
}

/**
 * Reservasi atomik: semua SKU diperiksa dulu, baru reserved diperbarui.
 * Tidak ada await di dalam fungsi ini, sehingga tidak ada race di runtime Node tunggal.
 */
export function reserveStock(lines: readonly StockLine[], orderNumber: string, actorId: string | null): void {
  const db = getDb();
  const merged = mergeLines(lines);
  for (const line of merged) {
    if (!db.stock.has(line.sku)) throw new DomainError("UNKNOWN_SKU", `SKU tidak dikenal: ${line.sku}`);
    const available = availableQuantity(line.sku);
    if (line.quantity > available) throw new StockError(line.sku, available);
  }
  for (const line of merged) {
    const row = db.stock.get(line.sku)!;
    row.reserved += line.quantity;
    row.updatedAt = now().toISOString();
    record(line.sku, "reserve", { reserved: line.quantity }, "Reservasi checkout", orderNumber, actorId);
  }
}

export function releaseStock(lines: readonly StockLine[], orderNumber: string, actorId: string | null): void {
  const db = getDb();
  for (const line of mergeLines(lines)) {
    const row = db.stock.get(line.sku);
    if (!row) continue;
    const release = Math.min(line.quantity, row.reserved);
    row.reserved -= release;
    row.updatedAt = now().toISOString();
    record(line.sku, "release", { reserved: -release }, "Pelepasan reservasi", orderNumber, actorId);
  }
}

/** Saat barang dikirim: reservasi dikonsumsi dan on hand berkurang. */
export function commitShipment(lines: readonly StockLine[], orderNumber: string, actorId: string | null): void {
  const db = getDb();
  for (const line of mergeLines(lines)) {
    const row = db.stock.get(line.sku);
    if (!row) throw new DomainError("UNKNOWN_SKU", `SKU tidak dikenal: ${line.sku}`);
    if (row.reserved < line.quantity || row.onHand < line.quantity) {
      throw new DomainError("STOCK_INVARIANT", `Invarian stok dilanggar untuk ${line.sku}.`);
    }
    row.reserved -= line.quantity;
    row.onHand -= line.quantity;
    row.updatedAt = now().toISOString();
    record(line.sku, "ship", { onHand: -line.quantity, reserved: -line.quantity }, "Pengiriman", orderNumber, actorId);
  }
}

export function adjustStock(viewer: Viewer, sku: string, delta: number, reasonCode: string, note: string): void {
  requirePermission(viewer, "inventory.adjust");
  const reason = ADJUSTMENT_REASONS.find((item) => item.code === reasonCode);
  if (!reason) throw new DomainError("REASON_REQUIRED", "Pilih alasan penyesuaian stok yang valid.");
  if (note.trim().length < 5) throw new DomainError("NOTE_REQUIRED", "Tambahkan catatan singkat (minimal 5 karakter).");
  if (!Number.isSafeInteger(delta) || delta === 0) {
    throw new DomainError("INVALID_DELTA", "Jumlah penyesuaian harus bilangan bulat dan tidak nol.");
  }
  const row = getDb().stock.get(sku);
  if (!row) throw new DomainError("UNKNOWN_SKU", `SKU tidak dikenal: ${sku}`);
  const nextOnHand = row.onHand + delta;
  if (nextOnHand < 0) throw new DomainError("NEGATIVE_STOCK", "Penyesuaian tidak boleh membuat stok negatif.");
  if (nextOnHand < row.reserved) {
    throw new DomainError("BELOW_RESERVED", "Stok fisik tidak boleh lebih kecil dari jumlah yang sudah direservasi.");
  }
  row.onHand = nextOnHand;
  row.updatedAt = now().toISOString();
  record(sku, "adjust", { onHand: delta }, `${reason.label}: ${note.trim()}`, null, viewer.id);
  audit(viewer.id, "inventory.adjust", sku, { delta, reason: reasonCode });
}

/** Barang retur yang lolos inspeksi kembali ke stok jual. */
export function restockReturn(sku: string, quantity: number, orderNumber: string, actorId: string | null): void {
  const row = getDb().stock.get(sku);
  if (!row) throw new DomainError("UNKNOWN_SKU", `SKU tidak dikenal: ${sku}`);
  row.onHand += quantity;
  row.updatedAt = now().toISOString();
  record(sku, "return_to_stock", { onHand: quantity }, "Retur layak jual", orderNumber, actorId);
}

/** Barang retur rusak dicatat terpisah dan tidak masuk stok jual. */
export function recordDamagedReturn(sku: string, quantity: number, orderNumber: string, actorId: string | null): void {
  const row = getDb().stock.get(sku);
  if (!row) throw new DomainError("UNKNOWN_SKU", `SKU tidak dikenal: ${sku}`);
  row.damaged += quantity;
  row.updatedAt = now().toISOString();
  record(sku, "damage", { damaged: quantity }, "Retur rusak", orderNumber, actorId);
}
