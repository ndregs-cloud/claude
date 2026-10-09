import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, GUEST, orderInput, startAt, staff, asViewer } from "./helpers";
import { getDb } from "@/lib/db";
import { createOrder, transitionOrder } from "@/lib/services/orders";
import { processProviderEvent } from "@/lib/services/payment-events";
import { mockPaymentProvider, type ProviderEvent } from "@/lib/payments/provider";
import { mockShippingProvider } from "@/lib/shipping/provider";
import { approveRefund, decideReturn, receiveReturn, requestRefund, requestReturn } from "@/lib/services/returns";

const AT = "2026-10-10T03:00:00Z";
const deps = { payments: mockPaymentProvider, shipping: mockShippingProvider };

async function deliveredOrder(viewerIsCustomer: boolean) {
  const customer = staff("customer", "pembeli@uji.id");
  const viewer = viewerIsCustomer ? asViewer(customer) : GUEST;
  const created = await createOrder(orderInput({ items: [{ sku: "TOTE-BLK", quantity: 2 }] }), viewer, deps);
  if (!created.ok) throw new Error("setup gagal");
  const no = created.order.orderNumber;
  const ref = [...getDb().paymentAttempts.values()].find((a) => a.orderNumber === no)!.providerRef;
  const event: ProviderEvent = { provider: "mock", eventId: `evt-${no}`, type: "payment.succeeded", providerRef: ref, amountIdr: created.order.totalIdr, currency: "IDR", occurredAt: AT };
  processProviderEvent(event);
  const operator = staff("order_operator", "op@uji.id");
  const warehouse = staff("warehouse", "wh@uji.id");
  transitionOrder(operator, no, { to: "processing" });
  transitionOrder(warehouse, no, { to: "shipped", carrier: "JNE", trackingNumber: "JNE000000001" });
  transitionOrder(warehouse, no, { to: "delivered" });
  return { no, viewer, customer, total: created.order.totalIdr, ref };
}

describe("retur dan refund", () => {
  beforeEach(() => {
    freshDb();
    startAt(AT);
  });

  it("retur hanya untuk pesanan terkirim dan jumlah tidak boleh melebihi yang dibeli", async () => {
    const order = await deliveredOrder(true);
    expect(() => requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 3 }], reason: "Ukuran tidak sesuai" }, [])).toThrow(/melebihi/);
    const item = requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 1 }], reason: "Warna tidak sesuai" }, []);
    expect(item.status).toBe("requested");
    expect(getDb().orders.get(order.no)!.status).toBe("return_requested");
  });

  it("tamu tidak bisa mengajukan retur untuk pesanan yang bukan miliknya", async () => {
    const order = await deliveredOrder(true);
    const stranger = staff("customer", "lain@uji.id");
    expect(() => requestReturn(asViewer(stranger), order.no, { items: [{ sku: "TOTE-BLK", quantity: 1 }], reason: "Mencoba akses lain" }, [])).toThrow(/tidak ditemukan/);
  });

  it("alur retur sampai barang diterima: stok layak jual kembali, rusak dicatat terpisah", async () => {
    const order = await deliveredOrder(true);
    const stockBefore = getDb().stock.get("TOTE-BLK")!.onHand;
    const item = requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 2 }], reason: "Barang rusak saat diterima" }, []);
    const manager = staff("manager", "mgr@uji.id");
    decideReturn(manager, item.id, "approve", "Setuju");
    expect(() => receiveReturn(staff("warehouse", "wh2@uji.id"), item.id, [{ sku: "TOTE-BLK", quantity: 1, condition: "sellable" }])).toThrow(/sama/);
    receiveReturn(staff("warehouse", "wh3@uji.id"), item.id, [{ sku: "TOTE-BLK", quantity: 2, condition: "damaged" }]);
    expect(getDb().stock.get("TOTE-BLK")!.onHand).toBe(stockBefore); // rusak tidak masuk stok jual
    expect(getDb().stock.get("TOTE-BLK")!.damaged).toBe(2);
    expect(getDb().orders.get(order.no)!.status).toBe("returned");
  });

  it("refund: pengaju tidak boleh menyetujui sendiri (maker-checker)", async () => {
    const order = await deliveredOrder(true);
    const item = requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 1 }], reason: "Tidak jadi dipakai" }, []);
    decideReturn(staff("manager", "m1@uji.id"), item.id, "approve", "");
    receiveReturn(staff("warehouse", "w1@uji.id"), item.id, [{ sku: "TOTE-BLK", quantity: 1, condition: "sellable" }]);

    const finance = staff("finance", "fin@uji.id");
    const refund = requestRefund(finance, order.no, 100_000, "Retur barang");
    await expect(approveRefund(finance, refund.id)).rejects.toThrow(/berbeda/);
    const checker = staff("manager", "m2@uji.id");
    const approved = await approveRefund(checker, refund.id);
    expect(approved.status).toBe("submitted");
    expect(getDb().orders.get(order.no)!.status).toBe("returned"); // belum selesai: menunggu webhook
  });

  it("refund tidak boleh melebihi sisa nilai pesanan", async () => {
    const order = await deliveredOrder(true);
    const item = requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 1 }], reason: "Tidak jadi dipakai" }, []);
    decideReturn(staff("manager", "m3@uji.id"), item.id, "approve", "");
    receiveReturn(staff("warehouse", "w2@uji.id"), item.id, [{ sku: "TOTE-BLK", quantity: 1, condition: "sellable" }]);
    expect(() => requestRefund(staff("finance", "f2@uji.id"), order.no, order.total + 1, "Terlalu besar")).toThrow(/melebihi/);
  });

  it("refund dianggap selesai hanya setelah konfirmasi webhook penyedia", async () => {
    const order = await deliveredOrder(true);
    const item = requestReturn(order.viewer, order.no, { items: [{ sku: "TOTE-BLK", quantity: 1 }], reason: "Barang tidak sesuai" }, []);
    decideReturn(staff("manager", "m4@uji.id"), item.id, "approve", "");
    receiveReturn(staff("warehouse", "w3@uji.id"), item.id, [{ sku: "TOTE-BLK", quantity: 1, condition: "sellable" }]);
    const refund = requestRefund(staff("finance", "f3@uji.id"), order.no, 100_000, "Retur");
    const submitted = await approveRefund(staff("manager", "m5@uji.id"), refund.id);
    expect(processProviderEvent({ provider: "mock", eventId: "rf-1", type: "refund.succeeded", providerRef: submitted.providerRef!, amountIdr: 100_000, currency: "IDR", occurredAt: AT })).toBe("processed");
    expect(getDb().orders.get(order.no)!.status).toBe("partially_refunded");
    expect(getDb().refunds.get(refund.id)!.status).toBe("succeeded");
  });
});
