import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth-context";

export default async function AkunLayout({ children }: { children: ReactNode }) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/masuk?lanjut=/akun");
  return <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">{children}</div>;
}
