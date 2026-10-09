import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, GUEST, orderInput, startAt, staff, asViewer } from "./helpers";
import { getDb } from "@/lib/db";
import { createOrder, expirePendingOrders, getOrderForViewer, transitionOrder, cancelOwnOrder, trackOrder, PAYMENT_WINDOW_MINUTES } from "@/lib/services/orders";
import { processProviderEvent } from "@/lib/services/payment-events";
import { mockPaymentProvider, type ProviderEvent, type PaymentProvider } from "@/lib/payments/provider";
import { mockShippingProvider } from "@/lib/shipping/provider";
import { availableQuantity } from "@/lib/services/inventory";

const AT = "2026-10-10T03:00:00Z";
const deps = { payments: mockPaymentProvider, shipping: mockShippingProvider };

function successEvent(providerRef: string, amountIdr: number, eventId = "evt-1"): ProviderEvent {
  return { provider: "mock", eventId, type: "payment.succeeded", providerRef, amountIdr, currency: "IDR", occurredAt: AT };
}

function attemptRef(orderNumber: string): string {
  return [...getDb().paymentAttempts.values()].find((a) => a.orderNumber === orderNumber)!.providerRef;
}

describe("checkout dan pesanan", () => {
  beforeEach(() => {
    freshDb();
    startAt(AT);
  });

  it("guest checkout membuat pesanan pending_payment dengan total dihitung server", async () => {
    const result = await createOrder(orderInput({ items: [{ sku: "UR02-BLK-42", quantity: 2 }] }), GUEST, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("pending_payment");
    expect(result.order.paymentStatus).toBe("pending");
    expect(result.order.subtotalIdr).toBe(899_000 * 2);
    expect(result.order.totalIdr).toBe(899_000 * 2 + 15_000); // ongkir reguler Jabodetabek
    expect(availableQuantity("UR02-BLK-42")).toBe(20 - 2);
  });

  it("harga yang dikirim klien diabaikan: harga hanya berasal dari katalog", async () => {
    // Input tidak punya field harga; memastikan produk tidak aktif tidak bisa dibeli.
    const result = await createOrder(orderInput({ items: [{ sku: "BTL-BRU", quantity: 1 }] }), GUEST, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.formError).toMatch(/tidak lagi tersedia/);
  });

  it("idempotensi: kirim ulang dengan kunci yang sama tidak membuat pesanan kedua", async () => {
    const first = await createOrder(orderInput(), GUEST, deps);
    const second = await createOrder(orderInput(), GUEST, deps);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.order.orderNumber).toBe(first.order.orderNumber);
    expect(getDb().orders.size).toBe(1);
    expect(availableQuantity("UR02-BLK-42")).toBe(19); // reservasi hanya sekali
  });

  it("kegagalan provider melepas reservasi stok (tidak ada pesanan yatim)", async () => {
    const failing: PaymentProvider = {
      ...mockPaymentProvider,
      async createPayment() {
        throw new Error("provider down");
      },
    };
    const before = availableQuantity("UR02-BLK-42");
    const result = await createOrder(orderInput(), GUEST, { payments: failing, shipping: mockShippingProvider });
    expect(result.ok).toBe(false);
    expect(availableQuantity("UR02-BLK-42")).toBe(before);
    const [order] = [...getDb().orders.values()];
    expect(order.status).toBe("cancelled");
  });

  it("syarat dan ketentuan wajib disetujui", async () => {
    const result = await createOrder(orderInput({ termsAccepted: false }), GUEST, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["termsAccepted"]).toBeDefined();
  });

  it("promo kedaluwarsa ditolak di server", async () => {
    const result = await createOrder(orderInput({ promoCode: "KADALUARSA20" }), GUEST, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["promoCode"]).toMatch(/berakhir/);
  });

  it("pembayaran berhasil lewat webhook: pesanan menjadi paid, bukan dari klien", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    const outcome = processProviderEvent(successEvent(attemptRef(created.order.orderNumber), created.order.totalIdr));
    expect(outcome).toBe("processed");
    const order = getDb().orders.get(created.order.orderNumber)!;
    expect(order.status).toBe("paid");
    expect(order.paymentStatus).toBe("paid");
    expect(order.paidAt).not.toBeNull();
  });

  it("webhook duplikat tidak diproses dua kali (AT-04)", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    const event = successEvent(attemptRef(created.order.orderNumber), created.order.totalIdr, "evt-dup");
    expect(processProviderEvent(event)).toBe("processed");
    expect(processProviderEvent(event)).toBe("duplicate");
    expect(getDb().orders.get(created.order.orderNumber)!.history.filter((h) => h.to === "paid")).toHaveLength(1);
  });

  it("nominal webhook tidak sama dengan total: tidak mengubah status, tercatat sebagai pengecualian", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    const outcome = processProviderEvent(successEvent(attemptRef(created.order.orderNumber), created.order.totalIdr - 1, "evt-amt"));
    expect(outcome).toBe("exception");
    expect(getDb().orders.get(created.order.orderNumber)!.status).toBe("pending_payment");
    expect(getDb().paymentExceptions.some((e) => e.kind === "amount_mismatch")).toBe(true);
  });

  it("pembayaran berhasil setelah pesanan dibatalkan dicatat sebagai pengecualian, bukan fulfilment (AT-06)", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    cancelOwnOrder(GUEST, created.order.orderNumber, [created.order.orderNumber]);
    const outcome = processProviderEvent(successEvent(attemptRef(created.order.orderNumber), created.order.totalIdr, "evt-late"));
    expect(outcome).toBe("exception");
    expect(getDb().orders.get(created.order.orderNumber)!.status).toBe("cancelled");
    expect(getDb().paymentExceptions.some((e) => e.kind === "late_success_after_cancel")).toBe(true);
  });

  it("batas waktu pembayaran habis: pesanan dibatalkan dan stok dilepas", async () => {
    const clock = startAt(AT);
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    clock.advanceMinutes(PAYMENT_WINDOW_MINUTES + 1);
    expect(expirePendingOrders(new Date(Date.parse(AT) + (PAYMENT_WINDOW_MINUTES + 1) * 60_000))).toBe(1);
    expect(getDb().orders.get(created.order.orderNumber)!.status).toBe("cancelled");
    expect(availableQuantity("UR02-BLK-42")).toBe(20);
  });

  it("pesanan tamu hanya terlihat di browser yang memiliki nomornya; pelacakan butuh email yang cocok", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    const no = created.order.orderNumber;
    expect(getOrderForViewer(no, GUEST, [])).toBeNull();
    expect(getOrderForViewer(no, GUEST, [no])).not.toBeNull();
    expect(trackOrder(no, "orang-lain@uji.id")).toBeNull();
    expect(trackOrder(no, "BUDI@uji.id")).not.toBeNull();
  });

  it("pelanggan A tidak bisa membaca pesanan pelanggan B (AT-07)", async () => {
    const a = staff("customer", "a@uji.id");
    const b = staff("customer", "b@uji.id");
    const created = await createOrder(orderInput({ idempotencyKey: "key-owner-b" }), asViewer(b), deps);
    if (!created.ok) throw new Error("setup gagal");
    expect(getOrderForViewer(created.order.orderNumber, asViewer(a), [])).toBeNull();
    expect(getOrderForViewer(created.order.orderNumber, asViewer(b), [])).not.toBeNull();
  });

  it("transisi status oleh staf wajib izin dan prasyarat resi", async () => {
    const created = await createOrder(orderInput(), GUEST, deps);
    if (!created.ok) throw new Error("setup gagal");
    const no = created.order.orderNumber;
    processProviderEvent(successEvent(attemptRef(no), created.order.totalIdr, "evt-ok"));
    const operator = staff("order_operator");
    const warehouse = staff("warehouse", "gudang@uji.id");
    transitionOrder(operator, no, { to: "processing" });
    expect(() => transitionOrder(warehouse, no, { to: "shipped", carrier: "", trackingNumber: "" })).toThrow(/resi/);
    transitionOrder(warehouse, no, { to: "shipped", carrier: "JNE", trackingNumber: "JNE123456789" });
    expect(availableQuantity("UR02-BLK-42")).toBe(19);
    expect(getDb().orders.get(no)!.status).toBe("shipped");
    expect(() => transitionOrder(operator, no, { to: "cancelled" })).toThrow();
  });
});
