import { getDb, now } from "../db";
import { LOW_STOCK_THRESHOLD } from "./catalog";
import { availableQuantity } from "./inventory";
import { listOrders } from "./orders";

function jakartaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export interface DashboardMetrics {
  ordersToday: number;
  confirmedRevenueIdr: number;
  pendingPayment: number;
  unfulfilled: number;
  lowStockSkus: number;
  openReturns: number;
  refundsAwaitingApproval: number;
  unresolvedExceptions: number;
  generatedAt: string;
}

export function getDashboardMetrics(): DashboardMetrics {
  const db = getDb();
  const at = now();
  const today = jakartaDateKey(at);
  const orders = listOrders();
  const lowStockSkus = [...db.stock.keys()].filter((sku) => {
    const row = db.stock.get(sku);
    return row !== undefined && availableQuantity(sku) > 0 && availableQuantity(sku) <= LOW_STOCK_THRESHOLD;
  }).length;

  return {
    ordersToday: orders.filter((order) => jakartaDateKey(new Date(order.createdAt)) === today).length,
    // Pendapatan hanya dihitung dari pesanan yang pembayarannya sudah terkonfirmasi.
    confirmedRevenueIdr: orders.filter((order) => order.paidAt !== null).reduce((sum, order) => sum + order.totalIdr, 0),
    pendingPayment: orders.filter((order) => order.status === "pending_payment").length,
    unfulfilled: orders.filter((order) => order.status === "paid" || order.status === "processing").length,
    lowStockSkus,
    openReturns: [...db.returns.values()].filter((item) => item.status === "requested" || item.status === "approved").length,
    refundsAwaitingApproval: [...db.refunds.values()].filter((item) => item.status === "requested").length,
    unresolvedExceptions: db.paymentExceptions.filter((item) => !item.resolved).length,
    generatedAt: at.toISOString(),
  };
}
