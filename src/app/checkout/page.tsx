import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { CheckoutForm } from "@/components/checkout-form";
import { EmptyState, LinkButton } from "@/components/ui";
import { getCartItems, getCurrentUser } from "@/lib/auth-context";
import { buildCartView } from "@/lib/services/cart";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [items, viewer] = await Promise.all([getCartItems(), getCurrentUser()]);
  const view = buildCartView(items);

  if (view.lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
        <EmptyState title="Keranjang kosong" description="Tambahkan produk ke keranjang sebelum checkout." action={<LinkButton href="/belanja">Mulai belanja</LinkButton>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold md:text-3xl">Checkout</h1>
      <p className="mt-1 text-text-secondary">Selesaikan pesananmu dengan aman. Ringkasan biaya selalu terlihat.</p>
      <div className="mt-6">
        <CheckoutForm
          idempotencyKey={randomUUID()}
          lines={view.lines.map((line) => ({
            sku: line.sku,
            productName: line.productName,
            variantLabel: line.variantLabel,
            quantity: line.quantity,
            lineTotalIdr: line.lineTotalIdr,
          }))}
          initial={{
            contactName: viewer?.name ?? "",
            contactEmail: viewer?.email ?? "",
            contactPhone: viewer?.phone ?? "",
            recipientName: viewer?.name ?? "",
            recipientPhone: viewer?.phone ?? "",
          }}
        />
      </div>
    </div>
  );
}
