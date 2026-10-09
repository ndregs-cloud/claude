"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-context";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import type { OrderStatus } from "@/lib/domain/order-state";
import { withMessage } from "@/lib/safe-redirect";
import { adjustStock } from "@/lib/services/inventory";
import { transitionOrder } from "@/lib/services/orders";
import { approveRefund, decideReturn, receiveReturn, requestRefund } from "@/lib/services/returns";
import { getDb } from "@/lib/db";

type Outcome = { path: string; kind: "pesan" | "galat"; text: string };

async function run(path: string, success: string, action: () => unknown | Promise<unknown>): Promise<void> {
  let outcome: Outcome;
  try {
    await action();
    outcome = { path, kind: "pesan", text: success };
  } catch (error) {
    if (error instanceof DomainError || error instanceof ForbiddenError) {
      outcome = { path, kind: "galat", text: error.message };
    } else {
      outcome = { path, kind: "galat", text: "Terjadi kesalahan. Periksa data dan coba lagi." };
      console.error("[admin action]", error);
    }
  }
  redirect(withMessage(outcome.path, outcome.kind, outcome.text));
}

export async function transitionOrderAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const to = String(formData.get("to") ?? "") as OrderStatus;
  const path = `/admin/pesanan/${orderNumber}`;
  const viewer = await getCurrentUser();
  await run(path, "Status pesanan diperbarui.", () =>
    transitionOrder(viewer, orderNumber, {
      to,
      carrier: String(formData.get("carrier") ?? ""),
      trackingNumber: String(formData.get("trackingNumber") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    }),
  );
}

export async function decideReturnAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const decision = formData.get("decision") === "approve" ? "approve" : "reject";
  const viewer = await getCurrentUser();
  await run(`/admin/pesanan/${orderNumber}`, decision === "approve" ? "Retur disetujui." : "Retur ditolak.", () =>
    decideReturn(viewer, returnId, decision, String(formData.get("note") ?? "")),
  );
}

export async function receiveReturnAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const viewer = await getCurrentUser();
  const returnCase = getDb().returns.get(returnId);
  const received = (returnCase?.items ?? []).map((item) => ({
    sku: item.sku,
    quantity: Number(formData.get(`recv_${item.sku}`) ?? 0),
    condition: (formData.get(`cond_${item.sku}`) === "damaged" ? "damaged" : "sellable") as "sellable" | "damaged",
  }));
  await run(`/admin/pesanan/${orderNumber}`, "Barang retur tercatat di gudang.", () =>
    receiveReturn(viewer, returnId, received),
  );
}

export async function requestRefundAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const amount = Number(formData.get("amountIdr") ?? 0);
  const viewer = await getCurrentUser();
  await run(`/admin/pesanan/${orderNumber}`, "Permintaan refund dibuat. Menunggu persetujuan pihak lain.", () =>
    requestRefund(viewer, orderNumber, amount, String(formData.get("reason") ?? "")),
  );
}

export async function approveRefundAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const refundId = String(formData.get("refundId") ?? "");
  const viewer = await getCurrentUser();
  await run(`/admin/pesanan/${orderNumber}`, "Refund disetujui dan dikirim ke penyedia. Status akhir menunggu konfirmasi.", () =>
    approveRefund(viewer, refundId),
  );
}

export async function adjustStockAction(formData: FormData): Promise<void> {
  const sku = String(formData.get("sku") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  const viewer = await getCurrentUser();
  await run("/admin/inventaris", "Penyesuaian stok tersimpan dan tercatat di ledger.", () =>
    adjustStock(viewer, sku, delta, String(formData.get("reason") ?? ""), String(formData.get("note") ?? "")),
  );
}
