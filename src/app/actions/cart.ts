"use server";

import { redirect } from "next/navigation";
import { getCartItems } from "@/lib/auth-context";
import { writeCartCookie } from "@/lib/cookies";
import { parseQuantity } from "@/lib/domain/validation";
import { withMessage } from "@/lib/safe-redirect";
import { addCartItem, buildCartView, setCartItemQuantity } from "@/lib/services/cart";
import { availableQuantity } from "@/lib/services/inventory";
import { findSellableSku } from "@/lib/services/catalog";

export async function addToCartAction(formData: FormData): Promise<void> {
  const sku = String(formData.get("sku") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const productPath = `/produk/${slug}`;
  const quantity = parseQuantity(formData.get("quantity"));
  if (quantity === null) redirect(withMessage(productPath, "galat", "Jumlah tidak valid (1–10)."));

  const ctx = findSellableSku(sku);
  if (!ctx) redirect(withMessage(productPath, "galat", "Varian tidak tersedia. Pilih varian lain."));

  const available = availableQuantity(sku);
  const items = await getCartItems();
  const inCart = items.find((item) => item.sku === sku)?.quantity ?? 0;
  if (available === 0) redirect(withMessage(productPath, "galat", "Stok habis untuk varian ini."));
  if (inCart + quantity > available) {
    redirect(withMessage(productPath, "galat", `Stok tersisa ${available}. Keranjang Anda sudah berisi ${inCart}.`));
  }

  await writeCartCookie(addCartItem(items, sku, quantity));
  redirect(withMessage("/keranjang", "pesan", `${ctx.product.name} (${ctx.variant.label}) ditambahkan ke keranjang.`));
}

export async function updateCartAction(formData: FormData): Promise<void> {
  const sku = String(formData.get("sku") ?? "");
  const op = String(formData.get("op") ?? "");
  const items = await getCartItems();
  const current = items.find((item) => item.sku === sku);
  if (!current) redirect(withMessage("/keranjang", "galat", "Item tidak ditemukan di keranjang."));

  let next = current.quantity;
  if (op === "inc") next = current.quantity + 1;
  else if (op === "dec") next = current.quantity - 1;
  else if (op === "remove") next = 0;
  else redirect(withMessage("/keranjang", "galat", "Permintaan tidak dikenal."));

  if (next > 0) {
    const parsed = parseQuantity(next);
    if (parsed === null) redirect(withMessage("/keranjang", "galat", "Jumlah maksimal per item adalah 10."));
    const available = availableQuantity(sku);
    if (next > available) redirect(withMessage("/keranjang", "galat", `Stok tersisa ${available} untuk item ini.`));
  }

  await writeCartCookie(setCartItemQuantity(items, sku, next));
  redirect(withMessage("/keranjang", "pesan", next === 0 ? "Item dihapus dari keranjang." : "Jumlah diperbarui."));
}

export async function clearInvalidItemsAction(): Promise<void> {
  const items = await getCartItems();
  const view = buildCartView(items);
  const kept = view.lines.filter((line) => line.issue === null);
  await writeCartCookie(kept.map((line) => ({ sku: line.sku, quantity: line.quantity })));
  redirect("/keranjang");
}

