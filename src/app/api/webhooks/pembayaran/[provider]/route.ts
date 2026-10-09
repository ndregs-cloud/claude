import { NextResponse } from "next/server";
import { mockPaymentProvider, parseProviderEvent, verifySignature } from "@/lib/payments/provider";
import { processProviderEvent } from "@/lib/services/payment-events";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Webhook penyedia pembayaran. Tanda tangan dihitung dari raw body dengan secret dari environment
 * (PAYMENT_WEBHOOK_SECRET). Tanpa secret, endpoint menolak semua permintaan.
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== mockPaymentProvider.name) {
    return NextResponse.json({ error: { code: "UNKNOWN_PROVIDER" } }, { status: 404 });
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: { code: "WEBHOOK_NOT_CONFIGURED" } }, { status: 503 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: { code: "PAYLOAD_TOO_LARGE" } }, { status: 413 });
  }
  if (!verifySignature(secret, raw, request.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE" } }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON" } }, { status: 400 });
  }
  const event = parseProviderEvent(parsed);
  if (!event || event.provider !== provider) {
    return NextResponse.json({ error: { code: "INVALID_EVENT" } }, { status: 400 });
  }

  // Duplikat dibalas 200 agar penyedia berhenti retry, tetapi tidak diproses ulang.
  const outcome = processProviderEvent(event);
  return NextResponse.json({ received: true, outcome }, { status: 200 });
}
