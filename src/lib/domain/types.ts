import type { OrderStatus } from "./order-state";

export type Role =
  | "customer"
  | "catalog_editor"
  | "order_operator"
  | "warehouse"
  | "finance"
  | "manager"
  | "admin"
  | "auditor";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

/** Bentuk user yang aman dipakai di luar layer auth (tanpa hash). */
export type AuthUser = Omit<User, "passwordHash">;

/** Viewer = pengguna yang sedang login, atau null untuk tamu. */
export type Viewer = AuthUser | null;

export interface Variant {
  sku: string;
  label: string;
  attributes: Record<string, string>;
  priceAdjustmentIdr: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  description: string;
  highlights: string[];
  basePriceIdr: number;
  compareAtIdr: number | null;
  rating: number;
  reviewCount: number;
  status: "active" | "draft" | "archived";
  /** Warna placeholder untuk media produk (bukan gambar nyata). */
  tone: "blue" | "green" | "amber" | "violet" | "rose" | "slate";
  badge: string | null;
  createdAt: string;
  variants: Variant[];
}

export interface Category {
  slug: string;
  name: string;
  description: string;
}

export interface StockRow {
  sku: string;
  onHand: number;
  reserved: number;
  damaged: number;
  safetyStock: number;
  updatedAt: string;
}

export type StockMovementType =
  | "reserve"
  | "release"
  | "ship"
  | "adjust"
  | "return_to_stock"
  | "damage";

export interface StockMovement {
  id: string;
  sku: string;
  type: StockMovementType;
  onHandDelta: number;
  reservedDelta: number;
  damagedDelta: number;
  reason: string;
  orderNumber: string | null;
  actorId: string | null;
  at: string;
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  street: string;
  notes: string;
}

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
}

export interface OrderLine {
  sku: string;
  productId: string;
  productName: string;
  variantLabel: string;
  unitPriceIdr: number;
  quantity: number;
  discountIdr: number;
  lineTotalIdr: number;
  returnedQuantity: number;
}

export interface OrderEvent {
  at: string;
  from: OrderStatus | null;
  to: OrderStatus;
  actorId: string | null;
  reason: string;
  visibility: "customer" | "internal";
}

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "partially_refunded" | "refunded";

export interface Order {
  id: string;
  orderNumber: string;
  userId: string | null;
  contact: ContactInput;
  shippingAddress: AddressInput;
  shippingServiceId: string;
  shippingServiceName: string;
  shippingEstimate: string;
  lines: OrderLine[];
  subtotalIdr: number;
  discountIdr: number;
  shippingIdr: number;
  taxIdr: number;
  totalIdr: number;
  promoCode: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  reservedUntil: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  history: OrderEvent[];
}

export type PaymentAttemptStatus = "created" | "pending" | "requires_action" | "succeeded" | "failed" | "expired";

export interface PaymentAttempt {
  id: string;
  orderNumber: string;
  amountIdr: number;
  currency: "IDR";
  status: PaymentAttemptStatus;
  providerRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderEventRecord {
  key: string; // provider:eventId, unik untuk deduplikasi
  type: string;
  receivedAt: string;
  outcome: string;
}

export interface PaymentException {
  id: string;
  kind:
    | "payment_without_order"
    | "amount_mismatch"
    | "late_success_after_cancel"
    | "late_success_after_expiry"
    | "refund_without_record";
  orderNumber: string | null;
  detail: string;
  resolved: boolean;
  createdAt: string;
}

export type RefundStatus = "requested" | "approved" | "submitted" | "succeeded" | "failed" | "rejected";

export interface Refund {
  id: string;
  orderNumber: string;
  amountIdr: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  approvedBy: string | null;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReturnStatus = "requested" | "approved" | "rejected" | "received";

export interface ReturnItem {
  sku: string;
  quantity: number;
}

export interface ReturnCase {
  id: string;
  orderNumber: string;
  items: ReturnItem[];
  reason: string;
  status: ReturnStatus;
  requestedBy: string;
  decidedBy: string | null;
  receivedItems: (ReturnItem & { condition: "sellable" | "damaged" })[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  action: string;
  target: string;
  details: Record<string, string | number | boolean | null>;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}
