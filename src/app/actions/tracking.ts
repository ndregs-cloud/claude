"use server";

import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus, type StatusTone } from "@/lib/domain/order-state";
import { trackOrder } from "@/lib/services/orders";

export interface TrackingState {
  error: string | null;
  result: {
    orderNumber: string;
    statusLabel: string;
    tone: StatusTone;
    carrier: string | null;
    trackingNumber: string | null;
    updatedAt: string;
    timeline: { at: string; label: string; reason: string }[];
  } | null;
}

/** Pesan galat dibuat seragam agar tidak membocorkan apakah nomor pesanan ada. */
export async function trackOrderAction(_prev: TrackingState, formData: FormData): Promise<TrackingState> {
  const orderNumber = String(formData.get("orderNumber") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!orderNumber || !email) return { error: "Isi nomor pesanan dan email.", result: null };
  const order = trackOrder(orderNumber, email);
  if (!order) return { error: "Nomor pesanan atau email tidak sesuai.", result: null };
  const status: OrderStatus = order.status;
  return {
    error: null,
    result: {
      orderNumber: order.orderNumber,
      statusLabel: STATUS_LABEL[status],
      tone: STATUS_TONE[status],
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      updatedAt: formatDateTime(order.updatedAt),
      timeline: order.history
        .filter((event) => event.visibility === "customer")
        .map((event) => ({ at: formatDateTime(event.at), label: STATUS_LABEL[event.to], reason: event.reason })),
    },
  };
}
