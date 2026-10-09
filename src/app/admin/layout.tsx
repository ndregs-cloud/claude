import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-ui";
import { getCurrentUser } from "@/lib/auth-context";
import { isStaff } from "@/lib/domain/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/masuk?lanjut=/admin");
  if (!isStaff(viewer)) redirect("/akses-ditolak");
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:px-8">
      <AdminNav viewer={viewer} />
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
