import { DomainError } from "./errors";
import type { AuthUser, Role, Viewer } from "./types";

export const PERMISSIONS = [
  "catalog.read",
  "catalog.write",
  "order.read",
  "order.fulfill",
  "order.cancel",
  "inventory.read",
  "inventory.adjust",
  "return.decide",
  "return.receive",
  "refund.request",
  "refund.approve",
  "dashboard.read",
  "customer.read",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Default deny: role yang tidak tercantum tidak memiliki izin apa pun. */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: [],
  catalog_editor: ["catalog.read", "catalog.write"],
  order_operator: ["catalog.read", "order.read", "order.fulfill", "order.cancel", "return.decide", "customer.read"],
  warehouse: ["catalog.read", "order.read", "order.fulfill", "inventory.read", "inventory.adjust", "return.receive"],
  finance: ["order.read", "refund.request", "refund.approve", "dashboard.read"],
  manager: [
    "catalog.read",
    "order.read",
    "inventory.read",
    "return.decide",
    "refund.request",
    "refund.approve",
    "dashboard.read",
    "audit.read",
  ],
  admin: [...PERMISSIONS],
  auditor: ["catalog.read", "order.read", "inventory.read", "dashboard.read", "audit.read"],
};

export const STAFF_ROLES: readonly Role[] = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter(
  (role) => role !== "customer",
);

export function can(viewer: Viewer, permission: Permission): boolean {
  if (!viewer) return false;
  return ROLE_PERMISSIONS[viewer.role].includes(permission);
}

export function isStaff(viewer: Viewer): boolean {
  return viewer !== null && viewer.role !== "customer";
}

export class ForbiddenError extends DomainError {
  constructor(permission: Permission | "owner") {
    super("FORBIDDEN", `Akses ditolak (${permission}).`);
    this.name = "ForbiddenError";
  }
}

export function requirePermission(viewer: Viewer, permission: Permission): asserts viewer is AuthUser {
  if (!can(viewer, permission)) throw new ForbiddenError(permission);
}
