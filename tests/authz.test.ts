import { beforeEach, describe, expect, it } from "vitest";
import { can, ForbiddenError, requirePermission } from "@/lib/domain/permissions";
import { freshDb, staff } from "./helpers";
import { adjustStock } from "@/lib/services/inventory";
import type { AuthUser } from "@/lib/domain/types";

describe("permission dan role", () => {
  beforeEach(() => {
    freshDb();
  });

  it("default deny: pelanggan dan tamu tidak punya izin staf", () => {
    const customer = staff("customer");
    expect(can(customer, "order.read")).toBe(false);
    expect(can(null, "dashboard.read")).toBe(false);
  });

  it("finance tidak bisa menyesuaikan stok", () => {
    const finance = staff("finance");
    expect(can(finance, "inventory.adjust")).toBe(false);
    expect(() => requirePermission(finance, "inventory.adjust")).toThrow(ForbiddenError);
  });

  it("penyesuaian stok ditolak untuk role tanpa izin, dan tidak mengubah saldo", () => {
    const operator: AuthUser = staff("order_operator");
    expect(() => adjustStock(operator, "UR02-BLK-42", 5, "stock_opname", "Uji otorisasi")).toThrow(ForbiddenError);
  });
});
