import { beforeEach, describe, expect, it } from "vitest";
import { freshDb, staff } from "./helpers";
import { getDb } from "@/lib/db";
import { adjustStock, availableQuantity, reserveStock, releaseStock, StockError } from "@/lib/services/inventory";

describe("ledger stok", () => {
  beforeEach(() => {
    freshDb();
  });

  it("reservasi tidak boleh melebihi ketersediaan (tanpa oversell)", () => {
    const before = availableQuantity("UR02-CLD-41"); // 3 tersedia
    expect(before).toBe(3);
    expect(() => reserveStock([{ sku: "UR02-CLD-41", quantity: 4 }], "NS-TEST-AAAAAA", null)).toThrow(StockError);
    expect(availableQuantity("UR02-CLD-41")).toBe(3); // tidak berubah sama sekali
  });

  it("dua pembelian untuk SKU terakhir: hanya yang pertama berhasil", () => {
    const row = getDb().stock.get("SW-44-ABU")!; // 2 tersedia
    row.onHand = 1; // sisakan satu unit
    reserveStock([{ sku: "SW-44-ABU", quantity: 1 }], "NS-TEST-BBBBBB", "pembeli-a");
    expect(() => reserveStock([{ sku: "SW-44-ABU", quantity: 1 }], "NS-TEST-CCCCCC", "pembeli-b")).toThrow(StockError);
    expect(getDb().stock.get("SW-44-ABU")!.reserved).toBe(1);
  });

  it("pelepasan reservasi mengembalikan ketersediaan dan tercatat di ledger", () => {
    const start = availableQuantity("TOTE-SND");
    reserveStock([{ sku: "TOTE-SND", quantity: 2 }], "NS-TEST-DDDDDD", null);
    releaseStock([{ sku: "TOTE-SND", quantity: 2 }], "NS-TEST-DDDDDD", null);
    expect(availableQuantity("TOTE-SND")).toBe(start);
    const types = getDb().stockMovements.filter((m) => m.sku === "TOTE-SND").map((m) => m.type);
    expect(types).toEqual(["reserve", "release"]);
  });

  it("penyesuaian stok wajib berizin, beralasan, dan tidak boleh negatif", () => {
    const admin = staff("admin");
    expect(() => adjustStock(admin, "BAG-LAV", -999, "stock_opname", "Hitung ulang gudang")).toThrow(/negatif/);
    expect(() => adjustStock(admin, "BAG-LAV", 0, "stock_opname", "Tidak ada perubahan")).toThrow();
    expect(() => adjustStock(admin, "BAG-LAV", 2, "alasan-tidak-ada", "Catatan cukup panjang")).toThrow(/alasan/i);
    adjustStock(admin, "BAG-LAV", 2, "stock_opname", "Hasil hitung fisik");
    expect(getDb().stock.get("BAG-LAV")!.onHand).toBe(14);
    expect(getDb().auditLog.some((a) => a.action === "inventory.adjust")).toBe(true);
  });
});
