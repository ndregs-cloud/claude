"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentUser, getGuestOrderNumbers } from "@/lib/auth-context";
import { getDb, now } from "@/lib/db";
import { withMessage } from "@/lib/safe-redirect";
import { mockPaymentProvider } from "@/lib/payments/provider";
import { getOrderForViewer } from "@/lib/services/orders";
import { processProviderEvent } from "@/lib/services/payment-events";

/**
 * Simulasi pembayaran untuk pengembangan saja. Mengirim event "berhasil" lewat jalur yang sama
 * dengan webhook (deduplikasi dan verifikasi nominal tetap berlaku). Tidak tersedia di production.
 */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const path = `/pesanan/${orderNumber}`;
  if (process.env.NODE_ENV === "production" || !mockPaymentProvider.isSimulation) {
    redirect(withMessage(path, "galat", "Simulasi pembayaran tidak tersedia."));
  }
  const viewer = await getCurrentUser();
  const guests = await getGuestOrderNumbers();
  const order = getOrderForViewer(orderNumber, viewer, guests);
  if (!order) redirect(withMessage("/", "galat", "Pesanan tidak ditemukan."));

  const attempt = [...getDb().paymentAttempts.values()].find(
    (item) => item.orderNumber === orderNumber && item.status !== "succeeded" && item.status !== "expired",
  );
  if (!attempt) redirect(withMessage(path, "galat", "Tidak ada pembayaran yang menunggu."));

  const outcome = processProviderEvent({
    provider: mockPaymentProvider.name,
    eventId: `sim_${randomUUID()}`,
    type: "payment.succeeded",
    providerRef: attempt.providerRef,
    amountIdr: attempt.amountIdr,
    currency: "IDR",
    occurredAt: now().toISOString(),
  });
  if (outcome !== "processed") {
    redirect(withMessage(path, "galat", "Pembayaran tidak dapat dikonfirmasi. Periksa rekonsiliasi."));
  }
  redirect(withMessage(path, "pesan", "Pembayaran (simulasi) terkonfirmasi."));
}

export async function simulateRefundAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const path = `/admin/pesanan/${orderNumber}`;
  if (process.env.NODE_ENV === "production" || !mockPaymentProvider.isSimulation) {
    redirect(withMessage(path, "galat", "Simulasi refund tidak tersedia."));
  }
  const refund = [...getDb().refunds.values()].find((item) => item.orderNumber === orderNumber && item.status === "submitted");
  if (!refund || !refund.providerRef) redirect(withMessage(path, "galat", "Tidak ada refund yang sedang dikirim."));

  const outcome = processProviderEvent({
    provider: mockPaymentProvider.name,
    eventId: `sim_${randomUUID()}`,
    type: "refund.succeeded",
    providerRef: refund.providerRef,
    amountIdr: refund.amountIdr,
    currency: "IDR",
    occurredAt: now().toISOString(),
  });
  if (outcome !== "processed") {
    redirect(withMessage(path, "galat", "Refund tidak dapat dikonfirmasi. Periksa rekonsiliasi."));
  }
  redirect(withMessage(path, "pesan", "Refund (simulasi) dikonfirmasi penyedia."));
}

