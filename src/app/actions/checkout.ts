"use server";

import { redirect } from "next/navigation";
import { getCartItems, getCurrentUser, getGuestOrderNumbers } from "@/lib/auth-context";
import { rememberGuestOrder, writeCartCookie } from "@/lib/cookies";
import { DomainError } from "@/lib/domain/errors";
import { computeOrderTotals, validatePromotion } from "@/lib/domain/pricing";
import { createOrder } from "@/lib/services/orders";
import { findSellableSku } from "@/lib/services/catalog";
import { buildCartView } from "@/lib/services/cart";
import { mockShippingProvider, type ShippingQuote } from "@/lib/shipping/provider";
import { now } from "@/lib/db";

export interface CheckoutFormState {
  formError: string | null;
  errors: Record<string, string>;
  values: Record<string, string>;
}

export interface CheckoutPreview {
  ready: boolean;
  blockingMessage: string | null;
  shippingOptions: ShippingQuote[];
  selectedServiceId: string | null;
  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  totalIdr: number;
  promo: { status: "none" | "applied" | "invalid"; message: string | null };
}

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Field form -> kunci error dari layer domain. */
const FIELD_FOR: Record<string, string> = {
  "contact.name": "contactName",
  "contact.email": "contactEmail",
  "contact.phone": "contactPhone",
  "address.recipientName": "recipientName",
  "address.phone": "recipientPhone",
  "address.province": "province",
  "address.city": "city",
  "address.district": "district",
  "address.postalCode": "postalCode",
  "address.street": "street",
  shippingServiceId: "shippingServiceId",
  promoCode: "promoCode",
  termsAccepted: "terms",
};

const FORM_FIELDS = [
  "idempotencyKey",
  "contactName",
  "contactEmail",
  "contactPhone",
  "recipientName",
  "recipientPhone",
  "province",
  "city",
  "district",
  "postalCode",
  "street",
  "notes",
  "shippingServiceId",
  "promoCode",
] as const;

function readValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of FORM_FIELDS) if (field !== "idempotencyKey") values[field] = str(formData, field);
  values.terms = formData.get("terms") === "on" ? "on" : "";
  return values;
}

export async function previewCheckoutAction(formData: FormData): Promise<CheckoutPreview> {
  const items = await getCartItems();
  const view = buildCartView(items);
  const base: CheckoutPreview = {
    ready: false,
    blockingMessage: null,
    shippingOptions: [],
    selectedServiceId: null,
    subtotalIdr: view.subtotalIdr,
    discountIdr: 0,
    shippingIdr: 0,
    totalIdr: view.subtotalIdr,
    promo: { status: "none", message: null },
  };
  if (items.length === 0) return { ...base, blockingMessage: "Keranjang kosong." };
  if (view.hasBlockingIssue) {
    return { ...base, blockingMessage: "Ada item yang stoknya berubah. Perbarui keranjang sebelum checkout." };
  }

  const province = str(formData, "province");
  const postalCode = str(formData, "postalCode");
  const city = str(formData, "city");
  const shippingOptions = province
    ? await mockShippingProvider.quote({ province, city, postalCode })
    : [];
  const requested = str(formData, "shippingServiceId");
  const selected = shippingOptions.find((option) => option.serviceId === requested) ?? shippingOptions[0] ?? null;
  const shippingIdr = selected?.costIdr ?? 0;

  const lines = items.map((item) => {
    const ctx = findSellableSku(item.sku)!;
    return { sku: item.sku, unitPriceIdr: ctx.unitPriceIdr, quantity: item.quantity };
  });
  const subtotalIdr = lines.reduce((sum, line) => sum + line.unitPriceIdr * line.quantity, 0);

  let promo: CheckoutPreview["promo"] = { status: "none", message: null };
  let appliedPromo = null;
  const code = str(formData, "promoCode").trim();
  if (code) {
    const result = validatePromotion(code, subtotalIdr, now());
    if (result.ok) {
      appliedPromo = result.promo;
      promo = { status: "applied", message: `Kode ${result.promo.code} diterapkan. ${result.promo.terms}` };
    } else {
      promo = { status: "invalid", message: result.message };
    }
  }

  const totals = computeOrderTotals(lines, appliedPromo, shippingIdr);
  return {
    ready: selected !== null,
    blockingMessage: null,
    shippingOptions,
    selectedServiceId: selected?.serviceId ?? null,
    subtotalIdr: totals.subtotalIdr,
    discountIdr: totals.discountIdr,
    shippingIdr: totals.shippingIdr,
    totalIdr: totals.totalIdr,
    promo,
  };
}

export async function checkoutAction(_prev: CheckoutFormState, formData: FormData): Promise<CheckoutFormState> {
  const values = readValues(formData);
  const items = await getCartItems();
  const viewer = await getCurrentUser();
  const guestOrders = await getGuestOrderNumbers();

  try {
    const result = await createOrder(
      {
        idempotencyKey: str(formData, "idempotencyKey"),
        items: items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
        contact: {
          name: values.contactName,
          email: values.contactEmail,
          phone: values.contactPhone,
        },
        address: {
          recipientName: values.recipientName,
          phone: values.recipientPhone,
          province: values.province,
          city: values.city,
          district: values.district,
          postalCode: values.postalCode,
          street: values.street,
          notes: values.notes,
        },
        shippingServiceId: values.shippingServiceId,
        promoCode: values.promoCode,
        termsAccepted: values.terms === "on",
      },
      viewer,
    );

    if (!result.ok) {
      const errors: Record<string, string> = {};
      for (const [key, message] of Object.entries(result.errors)) {
        errors[FIELD_FOR[key] ?? key] = message;
      }
      return { formError: result.formError, errors, values };
    }

    await writeCartCookie([]);
    if (!viewer) await rememberGuestOrder(result.order.orderNumber, guestOrders);
    redirect(`/pesanan/${result.order.orderNumber}?baru=1`);
  } catch (error) {
    if (error instanceof DomainError) return { formError: error.message, errors: {}, values };
    throw error;
  }
}
