// Pesanan: pembuatan dengan idempotensi, reservasi stok, transisi status, pembatalan, dan pelacakan.
import { audit, generateOrderNumber, getDb, newId, now } from "../db";
import { DomainError } from "../domain/errors";
import { assertTransition, STATUS_LABEL, type OrderStatus } from "../domain/order-state";
import { can, requirePermission } from "../domain/permissions";
import { computeOrderTotals, validatePromotion } from "../domain/pricing";
import type { AddressInput, ContactInput, Order, Viewer } from "../domain/types";
import {
  MAX_LINES_PER_CART,
  MAX_QTY_PER_LINE,
  normalizeEmail,
  parseQuantity,
  validateAddress,
  validateContact,
  type FieldErrors,
} from "../domain/validation";
import { mockPaymentProvider, type PaymentProvider } from "../payments/provider";
import { mockShippingProvider, type ShippingProvider } from "../shipping/provider";
import { findSellableSku } from "./catalog";
import { commitShipment, releaseStock, reserveStock, StockError } from "./inventory";

export const PAYMENT_WINDOW_MINUTES = 30;

const FULFILL_TARGETS: readonly OrderStatus[] = ["processing", "shipped", "delivered", "completed"];

export interface CreateOrderInput {
  idempotencyKey: string;
  items: { sku: string; quantity: unknown }[];
  contact: ContactInput;
  address: AddressInput;
  shippingServiceId: string;
  promoCode: string;
  termsAccepted: boolean;
}

export interface OrderDeps {
  payments?: PaymentProvider;
  shipping?: ShippingProvider;
}

export type CreateOrderResult =
  | { ok: true; order: Order; replayed: boolean }
  | { ok: false; errors: FieldErrors; formError: string | null };

function failure(errors: FieldErrors, formError: string | null = null): CreateOrderResult {
  return { ok: false, errors, formError };
}

function prefixErrors(prefix: string, errors: FieldErrors, target: FieldErrors): void {
  for (const [key, message] of Object.entries(errors)) target[`${prefix}.${key}`] = message;
}

export function setOrderStatus(
  order: Order,
  to: OrderStatus,
  actorId: string | null,
  reason: string,
  visibility: "customer" | "internal" = "customer",
): void {
  const from = order.status;
  assertTransition(from, to);
  const at = now().toISOString();
  order.status = to;
  order.updatedAt = at;
  order.history.push({ at, from, to, actorId, reason, visibility });
}

export function orderLinesAsStock(order: Order) {
  return order.lines.map((line) => ({ sku: line.sku, quantity: line.quantity }));
}

/**
 * Membatalkan pesanan yang belum dibayar dan melepas reservasi stoknya.
 * Attempt pembayaran yang masih terbuka ditandai expired.
 */
export function cancelPendingOrder(order: Order, actorId: string | null, reason: string): void {
  const db = getDb();
  assertTransition(order.status, "cancelled");
  releaseStock(orderLinesAsStock(order), order.orderNumber, actorId);
  setOrderStatus(order, "cancelled", actorId, reason);
  order.paymentStatus = "unpaid";
  order.reservedUntil = null;
  for (const attempt of db.paymentAttempts.values()) {
    if (attempt.orderNumber === order.orderNumber && ["created", "pending", "requires_action"].includes(attempt.status)) {
      attempt.status = "expired";
      attempt.updatedAt = now().toISOString();
    }
  }
  audit(actorId, "order.cancel", order.orderNumber, { reason });
}

export async function createOrder(input: CreateOrderInput, viewer: Viewer, deps: OrderDeps = {}): Promise<CreateOrderResult> {
  const db = getDb();
  const payments = deps.payments ?? mockPaymentProvider;
  const shipping = deps.shipping ?? mockShippingProvider;
  const errors: FieldErrors = {};

  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    return failure({}, "Sesi checkout tidak valid. Muat ulang halaman checkout.");
  }

  // Idempotensi: kirim ulang dengan kunci yang sama mengembalikan pesanan yang sudah ada.
  const scope = `${viewer ? viewer.id : "guest"}:${input.idempotencyKey}`;
  const existingNumber = db.idempotency.get(scope);
  if (existingNumber) {
    const existing = db.orders.get(existingNumber);
    if (existing) return { ok: true, order: existing, replayed: true };
  }

  if (!input.termsAccepted) errors.termsAccepted = "Setujui syarat dan ketentuan untuk melanjutkan.";

  const contact = validateContact(input.contact);
  if (!contact.ok) prefixErrors("contact", contact.errors, errors);
  const address = validateAddress(input.address);
  if (!address.ok) prefixErrors("address", address.errors, errors);

  if (input.items.length === 0) return failure({}, "Keranjang kosong.");
  if (input.items.length > MAX_LINES_PER_CART) return failure({}, "Keranjang terlalu banyak item.");

  const requested = new Map<string, number>();
  for (const item of input.items) {
    const quantity = parseQuantity(item.quantity);
    if (quantity === null) return failure({}, `Jumlah tidak valid untuk ${item.sku} (1–${MAX_QTY_PER_LINE}).`);
    requested.set(item.sku, (requested.get(item.sku) ?? 0) + quantity);
  }

  const sellable: { sku: string; quantity: number; productId: string; productName: string; variantLabel: string; unitPriceIdr: number }[] = [];
  for (const [sku, quantity] of requested) {
    if (quantity > MAX_QTY_PER_LINE) return failure({}, `Jumlah untuk ${sku} melebihi batas ${MAX_QTY_PER_LINE}.`);
    const ctx = findSellableSku(sku);
    if (!ctx) return failure({}, "Ada produk di keranjang yang tidak lagi tersedia. Periksa keranjang Anda.");
    sellable.push({
      sku,
      quantity,
      productId: ctx.product.id,
      productName: ctx.product.name,
      variantLabel: ctx.variant.label,
      unitPriceIdr: ctx.unitPriceIdr,
    });
  }

  if (Object.keys(errors).length > 0 || !contact.ok || !address.ok) return failure(errors);

  const shippingAddress = address.value;
  const contactValue = contact.value;

  const quotes = await shipping.quote({
    province: shippingAddress.province,
    city: shippingAddress.city,
    postalCode: shippingAddress.postalCode,
  });
  const quote = quotes.find((item) => item.serviceId === input.shippingServiceId);
  if (!quote) return failure({ shippingServiceId: "Pilih layanan pengiriman yang tersedia." });

  const subtotalIdr = sellable.reduce((sum, line) => sum + line.unitPriceIdr * line.quantity, 0);
  let promoCode: string | null = null;
  let promo = null;
  const rawPromo = input.promoCode.trim();
  if (rawPromo) {
    const result = validatePromotion(rawPromo, subtotalIdr, now());
    if (!result.ok) return failure({ promoCode: result.message });
    promo = result.promo;
    promoCode = promo.code;
  }

  const totals = computeOrderTotals(
    sellable.map((line) => ({ sku: line.sku, unitPriceIdr: line.unitPriceIdr, quantity: line.quantity })),
    promo,
    quote.costIdr,
  );

  // ---- Blok sinkron: cek stok, reservasi, dan simpan pesanan tanpa await di tengah. ----
  const orderNumber = generateOrderNumber(db);
  const actorId = viewer?.id ?? null;
  try {
    reserveStock(sellable, orderNumber, actorId);
  } catch (error) {
    if (error instanceof StockError) {
      return failure({}, `${error.message} Ubah jumlah atau pilih varian lain.`);
    }
    throw error;
  }

  const createdAt = now();
  const createdIso = createdAt.toISOString();
  const order: Order = {
    id: newId(),
    orderNumber,
    userId: actorId,
    contact: contactValue,
    shippingAddress,
    shippingServiceId: quote.serviceId,
    shippingServiceName: quote.serviceName,
    shippingEstimate: quote.estimate,
    lines: sellable.map((line, index) => ({
      sku: line.sku,
      productId: line.productId,
      productName: line.productName,
      variantLabel: line.variantLabel,
      unitPriceIdr: line.unitPriceIdr,
      quantity: line.quantity,
      discountIdr: totals.lineDiscountsIdr[index],
      lineTotalIdr: totals.lineSubtotalsIdr[index] - totals.lineDiscountsIdr[index],
      returnedQuantity: 0,
    })),
    subtotalIdr: totals.subtotalIdr,
    discountIdr: totals.discountIdr,
    shippingIdr: totals.shippingIdr,
    taxIdr: totals.taxIdr,
    totalIdr: totals.totalIdr,
    promoCode,
    status: "pending_payment",
    paymentStatus: "unpaid",
    reservedUntil: new Date(createdAt.getTime() + PAYMENT_WINDOW_MINUTES * 60_000).toISOString(),
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    carrier: null,
    trackingNumber: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: createdIso,
    updatedAt: createdIso,
    history: [
      {
        at: createdIso,
        from: null,
        to: "pending_payment",
        actorId,
        reason: "Pesanan dibuat. Menunggu konfirmasi pembayaran dari penyedia.",
        visibility: "customer",
      },
    ],
  };
  db.orders.set(orderNumber, order);
  db.idempotency.set(scope, orderNumber);
  audit(actorId, "order.create", orderNumber, { totalIdr: order.totalIdr, lines: order.lines.length });

  // ---- Panggilan provider (async). Jika gagal, reservasi dilepas dan kunci idempotensi dibebaskan. ----
  const attemptId = newId();
  try {
    const result = await payments.createPayment({
      attemptId,
      orderNumber,
      amountIdr: order.totalIdr,
      currency: "IDR",
      idempotencyKey: input.idempotencyKey,
    });
    db.paymentAttempts.set(attemptId, {
      id: attemptId,
      orderNumber,
      amountIdr: order.totalIdr,
      currency: "IDR",
      status: result.status,
      providerRef: result.providerRef,
      createdAt: createdIso,
      updatedAt: createdIso,
    });
    order.paymentStatus = "pending";
    return { ok: true, order, replayed: false };
  } catch {
    cancelPendingOrder(order, actorId, "Gagal memulai pembayaran. Reservasi stok dilepas.");
    db.idempotency.delete(scope);
    return failure({}, "Pembayaran belum dapat dimulai. Coba lagi beberapa saat lagi.");
  }
}

/** Pesanan terlihat oleh pemiliknya, staf yang berhak, atau tamu di browser yang sama. */
export function getOrderForViewer(orderNumber: string, viewer: Viewer, guestOrderNumbers: readonly string[] = []): Order | null {
  const order = getDb().orders.get(orderNumber);
  if (!order) return null;
  if (viewer && (viewer.id === order.userId || can(viewer, "order.read"))) return order;
  if (order.userId === null && guestOrderNumbers.includes(orderNumber)) return order;
  return null;
}

/** Pelacakan tamu: nomor pesanan + email harus cocok. Respons gagal dibuat seragam. */
export function trackOrder(orderNumber: string, email: string): Order | null {
  const order = getDb().orders.get(orderNumber.trim().toUpperCase());
  if (!order) return null;
  return normalizeEmail(order.contact.email) === normalizeEmail(email) ? order : null;
}

export function cancelOwnOrder(viewer: Viewer, orderNumber: string, guestOrderNumbers: readonly string[] = []): Order {
  const order = getOrderForViewer(orderNumber, viewer, guestOrderNumbers);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.status !== "pending_payment") {
    throw new DomainError("CANCEL_NOT_ALLOWED", "Pesanan hanya dapat dibatalkan sebelum pembayaran dikonfirmasi.");
  }
  cancelPendingOrder(order, viewer?.id ?? null, "Dibatalkan oleh pelanggan.");
  return order;
}

export interface TransitionInput {
  to: OrderStatus;
  reason?: string;
  carrier?: string;
  trackingNumber?: string;
}

/** Transisi status oleh staf. Pembayaran, retur, dan refund memakai alur khususnya sendiri. */
export function transitionOrder(viewer: Viewer, orderNumber: string, input: TransitionInput): Order {
  const db = getDb();
  const order = db.orders.get(orderNumber);
  if (!order) throw new DomainError("NOT_FOUND", "Pesanan tidak ditemukan.");

  if (input.to === "cancelled") requirePermission(viewer, "order.cancel");
  else if (FULFILL_TARGETS.includes(input.to)) requirePermission(viewer, "order.fulfill");
  else throw new DomainError("SPECIAL_FLOW", `Perubahan ke status "${STATUS_LABEL[input.to]}" memakai alur khusus.`);

  assertTransition(order.status, input.to);
  const actorId = viewer?.id ?? null;
  const reason = input.reason?.trim() || STATUS_LABEL[input.to];

  if (input.to === "cancelled") {
    cancelPendingOrder(order, actorId, reason);
    return order;
  }

  if (input.to === "shipped") {
    const carrier = input.carrier?.trim() ?? "";
    const trackingNumber = input.trackingNumber?.trim().toUpperCase() ?? "";
    if (carrier.length < 2 || trackingNumber.length < 5) {
      throw new DomainError("TRACKING_REQUIRED", "Isi nama kurir dan nomor resi sebelum menandai pesanan dikirim.");
    }
    commitShipment(orderLinesAsStock(order), order.orderNumber, actorId);
    order.carrier = carrier;
    order.trackingNumber = trackingNumber;
    order.shippedAt = now().toISOString();
  }
  if (input.to === "delivered") order.deliveredAt = now().toISOString();

  setOrderStatus(order, input.to, actorId, reason);
  audit(actorId, "order.transition", orderNumber, { to: input.to });
  return order;
}

/** Pesanan yang melewati batas waktu pembayaran dibatalkan dan reservasinya dilepas. */
export function expirePendingOrders(at: Date): number {
  let count = 0;
  for (const order of getDb().orders.values()) {
    if (order.status !== "pending_payment" || !order.reservedUntil) continue;
    if (Date.parse(order.reservedUntil) < at.getTime()) {
      cancelPendingOrder(order, null, "Batas waktu pembayaran habis. Reservasi stok dilepas.");
      count += 1;
    }
  }
  return count;
}

export function listOrders(): Order[] {
  return [...getDb().orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ordersForUser(userId: string): Order[] {
  return listOrders().filter((order) => order.userId === userId);
}

export function formatOrderStatus(status: OrderStatus): string {
  return STATUS_LABEL[status];
}
