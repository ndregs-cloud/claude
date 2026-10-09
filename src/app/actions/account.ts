"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, getGuestOrderNumbers } from "@/lib/auth-context";
import { DomainError } from "@/lib/domain/errors";
import { ForbiddenError } from "@/lib/domain/permissions";
import { withMessage } from "@/lib/safe-redirect";
import { cancelOwnOrder } from "@/lib/services/orders";
import { requestReturn } from "@/lib/services/returns";

export async function cancelOrderAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const path = `/pesanan/${orderNumber}`;
  const viewer = await getCurrentUser();
  const guests = await getGuestOrderNumbers();
  try {
    cancelOwnOrder(viewer, orderNumber, guests);
  } catch (error) {
    if (error instanceof DomainError) redirect(withMessage(path, "galat", error.message));
    throw error;
  }
  redirect(withMessage(path, "pesan", "Pesanan dibatalkan dan stok dilepas."));
}

export async function requestReturnAction(formData: FormData): Promise<void> {
  const orderNumber = String(formData.get("orderNumber") ?? "");
  const path = `/pesanan/${orderNumber}`;
  const viewer = await getCurrentUser();
  const guests = await getGuestOrderNumbers();
  const items: { sku: string; quantity: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("qty_")) continue;
    const quantity = Number(raw);
    if (quantity > 0) items.push({ sku: key.slice(4), quantity });
  }
  try {
    requestReturn(viewer, orderNumber, { items, reason: String(formData.get("reason") ?? "") }, guests);
  } catch (error) {
    if (error instanceof DomainError || error instanceof ForbiddenError) {
      redirect(withMessage(path, "galat", error.message));
    }
    throw error;
  }
  redirect(withMessage(path, "pesan", "Permintaan retur dikirim. Tim kami akan meninjau dalam jam kerja."));
}
