import type { Metadata } from "next";
import { AccessDenied, Section } from "@/components/admin-ui";
import { StatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth-context";
import { getDb } from "@/lib/db";
import { formatIDR } from "@/lib/money";
import { can } from "@/lib/domain/permissions";
import { getCategory, variantPriceIdr } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Admin · Produk" };

const STATUS_LABEL_PRODUCT = { active: "Aktif", draft: "Draf", archived: "Arsip" } as const;
const STATUS_TONE_PRODUCT = { active: "success", draft: "warning", archived: "neutral" } as const;

export default async function AdminProdukPage() {
  const viewer = await getCurrentUser();
  if (!can(viewer, "catalog.read")) return <AccessDenied permission="catalog.read" />;
  const products = getDb().products;
  return (
    <Section title={`Produk (${products.length})`}>
      <p className="mb-3 text-sm text-text-secondary">
        Daftar read-only pada versi ini. Pembuatan dan pengeditan produk (termasuk approval harga) menjadi langkah berikutnya.
        Produk berstatus draf atau arsip tidak tampil di storefront.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Daftar produk</caption>
          <thead className="text-left text-text-secondary">
            <tr className="border-b border-border-default">
              <th scope="col" className="py-2 font-medium">Nama</th>
              <th scope="col" className="py-2 font-medium">Kategori</th>
              <th scope="col" className="py-2 font-medium">Status</th>
              <th scope="col" className="py-2 text-right font-medium">Varian</th>
              <th scope="col" className="py-2 text-right font-medium">Harga</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const prices = product.variants.map((v) => variantPriceIdr(product, v));
              return (
                <tr key={product.id} className="border-b border-border-default last:border-0">
                  <td className="py-2"><p className="font-medium">{product.name}</p><p className="font-mono text-xs text-text-secondary">{product.slug}</p></td>
                  <td className="py-2">{getCategory(product.categorySlug)?.name}</td>
                  <td className="py-2"><StatusBadge tone={STATUS_TONE_PRODUCT[product.status]} label={STATUS_LABEL_PRODUCT[product.status]} /></td>
                  <td className="py-2 text-right tabular-nums">{product.variants.length}</td>
                  <td className="py-2 text-right tabular-nums">{formatIDR(Math.min(...prices))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
