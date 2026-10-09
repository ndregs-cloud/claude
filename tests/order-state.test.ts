import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, InvalidTransitionError, refundableAmount } from "@/lib/domain/order-state";

describe("state machine pesanan", () => {
  it("jalur normal diizinkan", () => {
    expect(canTransition("pending_payment", "paid")).toBe(true);
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
    expect(canTransition("delivered", "completed")).toBe(true);
  });

  it("pesanan yang sudah terkirim tidak boleh langsung dibatalkan", () => {
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("shipped", "cancelled")).toBe(false);
  });

  it("tidak bisa melewati pembayaran", () => {
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(() => assertTransition("pending_payment", "processing")).toThrow(InvalidTransitionError);
  });

  it("status final tidak bisa berpindah", () => {
    expect(canTransition("cancelled", "paid")).toBe(false);
    expect(canTransition("refunded", "returned")).toBe(false);
  });

  it("refund tidak boleh melebihi nilai yang masih dapat di-refund", () => {
    expect(refundableAmount(1_000_000, 0)).toBe(1_000_000);
    expect(refundableAmount(1_000_000, 600_000)).toBe(400_000);
    expect(refundableAmount(1_000_000, 1_200_000)).toBe(0);
  });
});
