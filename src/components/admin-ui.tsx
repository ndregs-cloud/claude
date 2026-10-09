import Link from "next/link";
import type { ReactNode } from "react";
import { can, type Permission } from "@/lib/domain/permissions";
import type { AuthUser, Role, Viewer } from "@/lib/domain/types";
import { Alert, Card } from "./ui";

export const ROLE_LABEL: Record<Role, string> = {
  customer: "Pelanggan",
  catalog_editor: "Editor katalog",
  order_operator: "Operator pesanan",
  warehouse: "Gudang",
  finance: "Finance",
  manager: "Manajer",
  admin: "Admin sistem",
  auditor: "Auditor",
};

export function AdminNav({ viewer }: { viewer: AuthUser }) {
  const items: { href: string; label: string; permission: Permission }[] = [
    { href: "/admin", label: "Dashboard", permission: "dashboard.read" },
    { href: "/admin/pesanan", label: "Pesanan", permission: "order.read" },
    { href: "/admin/inventaris", label: "Inventaris", permission: "inventory.read" },
    { href: "/admin/produk", label: "Produk", permission: "catalog.read" },
  ];
  const allowed = items.filter((item) => can(viewer, item.permission));
  return (
    <aside className="h-fit rounded-xl border border-border-default bg-surface p-4 md:sticky md:top-24">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{ROLE_LABEL[viewer.role]}</p>
      <p className="mb-3 truncate text-sm font-semibold">{viewer.name}</p>
      <nav aria-label="Navigasi admin">
        <ul className="flex flex-wrap gap-1 md:flex-col">
          {allowed.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-canvas">{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export function AccessDenied({ permission }: { permission: Permission }) {
  return (
    <Alert tone="danger" title="Akses ditolak">
      Peran Anda belum memiliki izin <code className="font-mono">{permission}</code>. Hubungi admin sistem untuk meminta akses.
    </Alert>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function FieldLabelSelect({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5 text-sm font-semibold">{children}</div>;
}

export type { Viewer };
