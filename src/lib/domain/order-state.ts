// State machine pesanan. Semua perubahan status harus lewat assertTransition.
import { DomainError } from "./errors";


export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "return_requested",
  "return_approved",
  "returned",
  "partially_refunded",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: ["completed", "return_requested"],
  completed: [],
  cancelled: [],
  return_requested: ["return_approved", "delivered"],
  return_approved: ["returned"],
  returned: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
};

export class InvalidTransitionError extends DomainError {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super("INVALID_TRANSITION", `Transisi status tidak diizinkan: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Menunggu pembayaran",
  paid: "Dibayar",
  processing: "Sedang diproses",
  shipped: "Dikirim",
  delivered: "Terkirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  return_requested: "Retur diajukan",
  return_approved: "Retur disetujui",
  returned: "Barang diretur",
  partially_refunded: "Refund sebagian",
  refunded: "Refund selesai",
};

export type StatusTone = "warning" | "info" | "success" | "danger" | "neutral";

export const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending_payment: "warning",
  paid: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  return_requested: "warning",
  return_approved: "warning",
  returned: "warning",
  partially_refunded: "info",
  refunded: "success",
};

/** Sisa nilai yang masih bisa di-refund. Refund yang gagal/ditolak tidak dihitung. */
export function refundableAmount(totalIdr: number, committedRefundIdr: number): number {
  return Math.max(0, totalIdr - committedRefundIdr);
}
