// Pemrosesan event webhook penyedia: deduplikasi, verifikasi nominal, dan pengecualian rekonsiliasi.
import { audit, getDb, newId, now } from "../db";
import type { OrderStatus } from "../domain/order-state";
import type { PaymentException } from "../domain/types";
import type { ProviderEvent } from "../payments/provider";
import { setOrderStatus } from "./orders";

export type EventOutcome = "processed" | "duplicate" | "exception" | "ignored";

function raise(orderNumber: string | null, kind: PaymentException["kind"], detail: string): EventOutcome {
  getDb().paymentExceptions.push({
    id: newId(),
    kind,
    orderNumber,
    detail,
    resolved: false,
    createdAt: now().toISOString(),
  });
  return "exception";
}

export function processProviderEvent(event: ProviderEvent): EventOutcome {
  const db = getDb();
  const key = `${event.provider}:${event.eventId}`;
  // Event yang sama tidak boleh diproses dua kali (blueprint 6.3 dan AT-04).
  if (db.providerEvents.has(key)) return "duplicate";

  const outcome = event.type.startsWith("refund.") ? applyRefundEvent(event) : applyPaymentEvent(event);
  db.providerEvents.set(key, { key, type: event.type, receivedAt: now().toISOString(), outcome });
  audit(null, "payment.event", key, { type: event.type, outcome });
  return outcome;
}

function applyPaymentEvent(event: ProviderEvent): EventOutcome {
  const db = getDb();
  const attempt = [...db.paymentAttempts.values()].find((item) => item.providerRef === event.providerRef);
  if (!attempt) return raise(null, "payment_without_order", `Pembayaran ${event.providerRef} tidak punya attempt internal.`);
  const order = db.orders.get(attempt.orderNumber);
  if (!order) return raise(attempt.orderNumber, "payment_without_order", "Pesanan untuk attempt ini tidak ditemukan.");

  if (event.currency !== "IDR" || event.amountIdr !== order.totalIdr) {
    return raise(
      order.orderNumber,
      "amount_mismatch",
      `Nominal ${event.amountIdr} ${event.currency} tidak sama dengan total pesanan ${order.totalIdr} IDR.`,
    );
  }

  attempt.updatedAt = now().toISOString();

  if (event.type === "payment.failed") {
    if (attempt.status !== "succeeded") attempt.status = "failed";
    return "processed";
  }

  // payment.succeeded
  if (attempt.status === "succeeded") return "ignored";

  if (order.status === "pending_payment") {
    attempt.status = "succeeded";
    if (order.reservedUntil && Date.parse(order.reservedUntil) < now().getTime()) {
      return raise(
        order.orderNumber,
        "late_success_after_expiry",
        "Pembayaran diterima setelah reservasi berakhir. Perlu rekonsiliasi manual sebelum fulfilment.",
      );
    }
    order.paymentStatus = "paid";
    order.paidAt = now().toISOString();
    order.reservedUntil = null;
    setOrderStatus(order, "paid", null, "Pembayaran terkonfirmasi oleh penyedia.");
    return "processed";
  }

  if (order.status === "cancelled") {
    attempt.status = "succeeded";
    return raise(
      order.orderNumber,
      "late_success_after_cancel",
      "Pembayaran berhasil setelah pesanan dibatalkan. Perlu refund atau rekonsiliasi manual.",
    );
  }

  attempt.status = "succeeded";
  return "ignored";
}

function applyRefundEvent(event: ProviderEvent): EventOutcome {
  const db = getDb();
  const refund = [...db.refunds.values()].find((item) => item.providerRef === event.providerRef);
  if (!refund) return raise(null, "refund_without_record", `Refund ${event.providerRef} tidak ditemukan di sistem.`);
  if (event.amountIdr !== refund.amountIdr || event.currency !== "IDR") {
    return raise(refund.orderNumber, "amount_mismatch", "Nominal refund dari penyedia tidak sama dengan catatan.");
  }
  if (refund.status !== "submitted") return "ignored";

  refund.updatedAt = now().toISOString();
  if (event.type === "refund.failed") {
    refund.status = "failed";
    return "processed";
  }

  refund.status = "succeeded";
  const order = db.orders.get(refund.orderNumber);
  if (!order) return raise(refund.orderNumber, "refund_without_record", "Pesanan refund tidak ditemukan.");
  const refundedTotal = [...db.refunds.values()]
    .filter((item) => item.orderNumber === order.orderNumber && item.status === "succeeded")
    .reduce((sum, item) => sum + item.amountIdr, 0);
  const next: OrderStatus = refundedTotal >= order.totalIdr ? "refunded" : "partially_refunded";
  order.paymentStatus = next === "refunded" ? "refunded" : "partially_refunded";
  if (order.status !== next) setOrderStatus(order, next, null, "Refund dikonfirmasi penyedia pembayaran.");
  return "processed";
}
