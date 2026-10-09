import type { Metadata } from "next";
import { AccessDenied, Section } from "@/components/admin-ui";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatIDR } from "@/lib/money";
import { getCurrentUser } from "@/lib/auth-context";
import { can } from "@/lib/domain/permissions";
import { getDashboardMetrics } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Admin · Dashboard" };

export default async function AdminDashboardPage() {
  const viewer = await getCurrentUser();
  if (!can(viewer, "dashboard.read")) return <AccessDenied permission="dashboard.read" />;
  const m = getDashboardMetrics();
  const kpis = [
    { label: "Pesanan hari ini", value: String(m.ordersToday), hint: "Zona waktu Asia/Jakarta" },
    { label: "Pendapatan terkonfirmasi", value: formatIDR(m.confirmedRevenueIdr), hint: "Hanya pesanan yang sudah dibayar" },
    { label: "Menunggu pembayaran", value: String(m.pendingPayment), hint: "Reservasi stok berjalan" },
    { label: "Belum diproses", value: String(m.unfulfilled), hint: "Status dibayar atau diproses" },
    { label: "Stok menipis", value: String(m.lowStockSkus), hint: "SKU dengan sisa ≤ 5" },
    { label: "Retur terbuka", value: String(m.openReturns), hint: "Diajukan atau disetujui" },
    { label: "Refund menunggu persetujuan", value: String(m.refundsAwaitingApproval), hint: "Butuh pemeriksa berbeda" },
    { label: "Pengecualian pembayaran", value: String(m.unresolvedExceptions), hint: "Perlu rekonsiliasi manual" },
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-text-secondary" aria-live="polite">Data diperbarui {formatDateTime(m.generatedAt)}. Metrik dihitung dari data langsung, bukan cache.</p>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <li key={kpi.label}>
            <Card className="h-full">
              <p className="text-sm text-text-secondary">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
              <p className="mt-1 text-xs text-text-secondary">{kpi.hint}</p>
            </Card>
          </li>
        ))}
      </ul>
      <Section title="Catatan">
        <p className="text-sm text-text-secondary">
          Dashboard ini menampilkan metrik inti dasar. Grafik tren, ekspor laporan, dan definisi KPI final menunggu keputusan bisnis dan data analytics.
        </p>
      </Section>
    </div>
  );
}
