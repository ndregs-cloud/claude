// Adapter pembayaran. Implementasi mock di bawah TIDAK memproses uang sungguhan.
// Ganti dengan adapter penyedia berizin (hosted/tokenized checkout) setelah kontrak dan sandbox tersedia.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface CreatePaymentInput {
  attemptId: string;
  orderNumber: string;
  amountIdr: number;
  currency: "IDR";
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  providerRef: string;
  status: "requires_action" | "pending";
  nextActionUrl: string | null;
}

export interface SubmitRefundInput {
  refundId: string;
  providerRef: string;
  amountIdr: number;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isSimulation: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  submitRefund(input: SubmitRefundInput): Promise<{ providerRef: string; status: "pending" }>;
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  isSimulation: true,
  async createPayment() {
    return {
      providerRef: `mock_pay_${randomBytes(8).toString("hex")}`,
      status: "requires_action",
      nextActionUrl: null,
    };
  },
  async submitRefund() {
    return { providerRef: `mock_ref_${randomBytes(8).toString("hex")}`, status: "pending" };
  },
};

export type ProviderEventType = "payment.succeeded" | "payment.failed" | "refund.succeeded" | "refund.failed";

export interface ProviderEvent {
  provider: string;
  eventId: string;
  type: ProviderEventType;
  providerRef: string;
  amountIdr: number;
  currency: string;
  occurredAt: string;
}

export function signPayload(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** Verifikasi tanda tangan memakai raw body dan perbandingan konstan-waktu. */
export function verifySignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(signPayload(secret, rawBody), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const EVENT_TYPES: readonly ProviderEventType[] = [
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
  "refund.failed",
];

export function parseProviderEvent(value: unknown): ProviderEvent | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.provider !== "string" ||
    typeof v.eventId !== "string" ||
    typeof v.providerRef !== "string" ||
    typeof v.amountIdr !== "number" ||
    !Number.isSafeInteger(v.amountIdr) ||
    typeof v.currency !== "string" ||
    typeof v.occurredAt !== "string" ||
    typeof v.type !== "string" ||
    !EVENT_TYPES.includes(v.type as ProviderEventType)
  ) {
    return null;
  }
  return v as unknown as ProviderEvent;
}
