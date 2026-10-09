// Retur dan refund. Refund hanya dianggap berhasil setelah konfirmasi penyedia (webhook).
import { audit, getDb, newId, now } from "../db";
import { DomainError } from "../domain/errors";
import { refundableAmount } from "../domain/order-state";
import { requirePermission } from "../domain/permissions";
import type { Order, Refund, ReturnCase, ReturnItem, Viewer } from "../domain/types";
import { mockPaymentProvider, type PaymentProvider } from "../payments/provider";
import { getOrderForViewer, setOrderStatus } from "./orders";
import { recordDamagedReturn, restockReturn } from "./inventory";
import { MAX_QTY_PER_LINE } from "../domain/validation";

const COMMITTED_REFUND_STATUSES = ["requested", "approved", "submitted", "succeeded"] as const;

export function committedRefundIdr(orderNumber: string): number {
  return [...getDb().refunds.values()]
    .filter((refund) => refund.orderNumber === orderNumber && (COMMITTED_REFUND_STATUSES as readonly string[]).includes(refund.status))
    .reduce((sum, refund) => sum + refund.amountIdr, 0);
}

function openReturnFor(orderNumber: string): ReturnCase | undefined {
  return [...getDb().returns.values()].find(
    (item) => item.orderNumber === orderNumber && (item.status === "requested" || item.status === "approved"),
  );
}

function validateItems(order: Order, items: ReturnItem[]): ReturnItem[] {
  if (items.length === 0) throw new DomainError("ITEMS_REQUIRED", "Pilih minimal satu item untuk diretur.");
  const merged = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QTY_PER_LINE) {
      throw new DomainError("INVALID_QUANTITY", "Jumlah retur tidak valid.");
    }
    merged.set(item.sku, (merged.get(item.sku) ?? 0) + item.quantity);
  }
  return [...merged.entries()].map(([sku, quantity]) => {
    const line = order.lines.find((candidate) => candidate.sku === sku);
    if (!line) throw new DomainError("NOT_IN_ORDER", `SKU ${sku} tidak ada di pesanan ini.`);
    if (quantity > line.quantity - line.returnedQuantity) {
      throw new DomainError("RETURN_QTY_EXCEEDED", `Jumlah retur untuk ${line.productName} melebihi yang dibeli.`);
    }
    return { sku, quantity };
  });
}

export function requestReturn(
  viewer: Viewer,
  orderNumber: string,
  input: { items: ReturnItem[]; reason: string },
  guestOrderNumbers: readonly string[] = [],
): ReturnCase {
  const order = getOrderForViewer(orderNumber, viewer, guestOrderNumbers);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.status !== "delivered") {
    throw new DomainError("RETURN_NOT_ELIGIBLE", "Retur hanya dapat diajukan untuk pesanan yang sudah terkirim.");
  }
  if (openReturnFor(orderNumber)) throw new DomainError("RETURN_OPEN", "Masih ada permintaan retur yang berjalan untuk pesanan ini.");
  const reason = input.reason.trim();
  if (reason.length < 10) throw new DomainError("REASON_REQUIRED", "Jelaskan alasan retur (minimal 10 karakter).");

  const items = validateItems(order, input.items);
  const actorId = viewer?.id ?? null;
  setOrderStatus(order, "return_requested", actorId, `Retur diajukan: ${reason}`);
  const createdAt = now().toISOString();
  const item: ReturnCase = {
    id: newId(),
    orderNumber,
    items,
    reason,
    status: "requested",
    requestedBy: actorId ?? "guest",
    decidedBy: null,
    receivedItems: [],
    createdAt,
    updatedAt: createdAt,
  };
  getDb().returns.set(item.id, item);
  audit(actorId, "return.request", orderNumber, { returnId: item.id });
  return item;
}

export function decideReturn(viewer: Viewer, returnId: string, decision: "approve" | "reject", note: string): ReturnCase {
  requirePermission(viewer, "return.decide");
  const db = getDb();
  const item = db.returns.get(returnId);
  if (!item) throw new DomainError("NOT_FOUND", "Permintaan retur tidak ditemukan.");
  if (item.status !== "requested") throw new DomainError("RETURN_STATE", "Permintaan ini sudah diputuskan.");
  const order = db.orders.get(item.orderNumber);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");

  const explanation = note.trim() || (decision === "approve" ? "Retur disetujui." : "Retur ditolak.");
  if (decision === "approve") {
    setOrderStatus(order, "return_approved", viewer.id, explanation);
    item.status = "approved";
  } else {
    setOrderStatus(order, "delivered", viewer.id, explanation);
    item.status = "rejected";
  }
  item.decidedBy = viewer.id;
  item.updatedAt = now().toISOString();
  audit(viewer.id, `return.${decision}`, item.orderNumber, { returnId });
  return item;
}

/** Penerimaan barang di gudang. Jumlah harus sama persis dengan yang disetujui. */
export function receiveReturn(
  viewer: Viewer,
  returnId: string,
  received: { sku: string; quantity: number; condition: "sellable" | "damaged" }[],
): ReturnCase {
  requirePermission(viewer, "return.receive");
  const db = getDb();
  const item = db.returns.get(returnId);
  if (!item) throw new DomainError("NOT_FOUND", "Permintaan retur tidak ditemukan.");
  if (item.status !== "approved") throw new DomainError("RETURN_STATE", "Retur harus disetujui sebelum barang diterima.");
  const order = db.orders.get(item.orderNumber);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");

  const expected = new Map(item.items.map((line) => [line.sku, line.quantity]));
  const actual = new Map<string, number>();
  for (const line of received) actual.set(line.sku, (actual.get(line.sku) ?? 0) + line.quantity);
  const matches =
    expected.size === actual.size && [...expected.entries()].every(([sku, quantity]) => actual.get(sku) === quantity);
  if (!matches) throw new DomainError("RECEIPT_MISMATCH", "Jumlah barang diterima harus sama dengan jumlah yang disetujui.");

  for (const line of received) {
    if (line.condition === "sellable") restockReturn(line.sku, line.quantity, order.orderNumber, viewer.id);
    else recordDamagedReturn(line.sku, line.quantity, order.orderNumber, viewer.id);
    const orderLine = order.lines.find((candidate) => candidate.sku === line.sku);
    if (orderLine) orderLine.returnedQuantity += line.quantity;
  }

  item.receivedItems = received.map((line) => ({ ...line }));
  item.status = "received";
  item.updatedAt = now().toISOString();
  setOrderStatus(order, "returned", viewer.id, "Barang retur diterima dan diperiksa.");
  audit(viewer.id, "return.receive", order.orderNumber, { returnId });
  return item;
}

export function requestRefund(viewer: Viewer, orderNumber: string, amountIdr: number, reason: string): Refund {
  requirePermission(viewer, "refund.request");
  const order = getDb().orders.get(orderNumber);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.status !== "returned" && order.status !== "partially_refunded") {
    throw new DomainError("REFUND_NOT_ELIGIBLE", "Refund hanya dapat diajukan setelah barang retur diterima.");
  }
  if (!Number.isSafeInteger(amountIdr) || amountIdr <= 0) {
    throw new DomainError("INVALID_AMOUNT", "Nominal refund harus bilangan bulat rupiah yang lebih dari nol.");
  }
  const available = refundableAmount(order.totalIdr, committedRefundIdr(orderNumber));
  if (amountIdr > available) {
    throw new DomainError("REFUND_EXCEEDS", "Nominal refund melebihi sisa nilai yang dapat di-refund.");
  }
  const createdAt = now().toISOString();
  const refund: Refund = {
    id: newId(),
    orderNumber,
    amountIdr,
    reason: reason.trim() || "Refund retur",
    status: "requested",
    requestedBy: viewer.id,
    approvedBy: null,
    providerRef: null,
    createdAt,
    updatedAt: createdAt,
  };
  getDb().refunds.set(refund.id, refund);
  audit(viewer.id, "refund.request", orderNumber, { refundId: refund.id, amountIdr });
  return refund;
}

/**
 * Persetujuan refund (maker-checker): pengaju tidak boleh menyetujui refund sendiri.
 * Setelah disetujui, refund dikirim ke penyedia. Status "berhasil" hanya dari webhook.
 */
export async function approveRefund(viewer: Viewer, refundId: string, provider: PaymentProvider = mockPaymentProvider): Promise<Refund> {
  requirePermission(viewer, "refund.approve");
  const db = getDb();
  const refund = db.refunds.get(refundId);
  if (!refund) throw new DomainError("NOT_FOUND", "Refund tidak ditemukan.");
  if (refund.status !== "requested") throw new DomainError("REFUND_STATE", "Refund ini sudah diproses.");
  if (refund.requestedBy === viewer?.id) {
    throw new DomainError("MAKER_CHECKER", "Persetujuan refund harus dilakukan oleh orang yang berbeda dari pengaju.");
  }
  const order = db.orders.get(refund.orderNumber);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");
  const paymentAttempt = [...db.paymentAttempts.values()].find(
    (attempt) => attempt.orderNumber === order.orderNumber && attempt.status === "succeeded",
  );
  if (!paymentAttempt) throw new DomainError("NO_PAYMENT", "Tidak ada pembayaran terkonfirmasi untuk pesanan ini.");

  // Tandai sebelum await agar tidak terkirim dua kali.
  refund.status = "submitted";
  refund.approvedBy = viewer.id;
  refund.updatedAt = now().toISOString();
  try {
    const result = await provider.submitRefund({
      refundId: refund.id,
      providerRef: paymentAttempt.providerRef,
      amountIdr: refund.amountIdr,
    });
    refund.providerRef = result.providerRef;
  } catch {
    refund.status = "approved";
    throw new DomainError("REFUND_SUBMIT_FAILED", "Refund belum dapat dikirim ke penyedia. Coba lagi nanti.");
  }
  audit(viewer.id, "refund.approve", order.orderNumber, { refundId, amountIdr: refund.amountIdr });
  return refund;
}
