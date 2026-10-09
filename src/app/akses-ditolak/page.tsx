import type { Metadata } from "next";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Akses ditolak" };

export default function AksesDitolakPage() {
  return (
    <div className="mx-auto max-w-[640px] space-y-4 px-4 py-16 md:px-8">
      <h1 className="text-2xl font-bold">Akses ditolak</h1>
      <p className="text-text-secondary">Akun Anda tidak memiliki izin untuk membuka area ini. Jika Anda membutuhkan akses untuk tugas operasional, minta persetujuan kepada admin sistem.</p>
      <LinkButton href="/" variant="secondary">Kembali ke beranda</LinkButton>
    </div>
  );
}
