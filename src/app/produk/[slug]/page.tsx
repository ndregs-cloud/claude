import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Button, buttonClass } from "@/components/ui";
import { Breadcrumb } from "@/components/breadcrumb";
import { PriceBlock } from "@/components/money";
import { ProductVisual } from "@/components/product-card";
import { MAX_QTY_PER_LINE } from "@/lib/domain/validation";
import type { Product, Variant } from "@/lib/domain/types";
import { getCategory, getPublicProductBySlug, variantPriceIdr } from "@/lib/services/catalog";
import { availableQuantity } from "@/lib/services/inventory";
import { LOW_STOCK_THRESHOLD } from "@/lib/services/catalog";
import { addToCartAction } from "@/app/actions/cart";

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = getPublicProductBySlug((await params).slug);
  return { title: product?.name ?? "Produk", description: product?.description };
}

/** Varian yang paling mirip dengan pilihan saat ini, dengan satu atribut diganti. */
function variantFor(product: Product, current: Variant, key: string, value: string): Variant | undefined {
  const exact = product.variants.find(
    (variant) =>
      variant.attributes[key] === value &&
      Object.keys(current.attributes).every((k) => k === key || variant.attributes[k] === current.attributes[k]),
  );
  return exact ?? product.variants.find((variant) => variant.attributes[key] === value);
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params;
  const sp = await searchParams;
  const product = getPublicProductBySlug(slug);
  if (!product) notFound();

  const requested = product.variants.find((variant) => variant.sku === first(sp.v));
  const variant =
    requested ?? product.variants.find((item) => availableQuantity(item.sku) > 0) ?? product.variants[0];
  const available = availableQuantity(variant.sku);
  const price = variantPriceIdr(product, variant);
  const category = getCategory(product.categorySlug);
  const attributeKeys = [...new Set(product.variants.flatMap((item) => Object.keys(item.attributes)))];
  const notice = first(sp.pesan);
  const error = first(sp.galat);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/" },
          { label: category?.name ?? "Kategori", href: category ? `/kategori/${category.slug}` : "/belanja" },
          { label: product.name },
        ]}
      />

      {notice ? <div className="mt-4"><Alert tone="success">{notice}</Alert></div> : null}
      {error ? <div className="mt-4"><Alert tone="danger" title="Tidak dapat menambahkan ke keranjang">{error}</Alert></div> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ProductVisual tone={product.tone} name={`${product.name} ${variant.label}`} className="aspect-square w-full lg:sticky lg:top-24" />

        <section aria-labelledby="judul-produk" className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-brand-600">{product.brand} / {category?.name}</p>
            <h1 id="judul-produk" className="mt-1 text-2xl font-bold md:text-3xl">{product.name}</h1>
            {product.reviewCount > 0 ? (
              <p className="mt-2 text-sm text-text-secondary">
                Rating {product.rating.toFixed(1)} · <a href="#ulasan" className="text-brand-600 underline">{product.reviewCount} ulasan</a>
              </p>
            ) : null}
          </div>

          <PriceBlock currentIdr={price} compareAtIdr={product.compareAtIdr} size="lg" />

          <p className="text-sm font-medium">
            {available === 0 ? (
              <span className="text-danger">Stok habis untuk varian ini</span>
            ) : available <= LOW_STOCK_THRESHOLD ? (
              <span className="text-warning">Stok terbatas</span>
            ) : (
              <span className="text-success">Stok tersedia</span>
            )}
          </p>

          <form action={addToCartAction} className="flex flex-col gap-5" aria-label="Pilih varian dan tambahkan ke keranjang">
            <input type="hidden" name="sku" value={variant.sku} />
            <input type="hidden" name="slug" value={product.slug} />

            {attributeKeys.map((key) => {
              const values = [...new Set(product.variants.map((item) => item.attributes[key]).filter(Boolean))];
              return (
                <fieldset key={key} className="flex flex-col gap-2">
                  <legend className="text-sm font-semibold capitalize">{key.replace(/_/g, " ")}: <span className="font-normal">{variant.attributes[key] ?? "-"}</span></legend>
                  <div className="flex flex-wrap gap-2">
                    {values.map((value) => {
                      const target = variantFor(product, variant, key, value);
                      const selected = variant.attributes[key] === value;
                      const soldOut = !target || availableQuantity(target.sku) === 0;
                      return (
                        <Link
                          key={value}
                          href={target ? `/produk/${product.slug}?v=${target.sku}` : `/produk/${product.slug}`}
                          aria-current={selected ? "true" : undefined}
                          aria-label={`${key} ${value}${soldOut ? ", habis" : ""}`}
                          className={`flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-semibold ${
                            selected ? "border-brand-600 bg-brand-50 text-brand-700" : "border-border-default bg-surface hover:bg-canvas"
                          } ${soldOut ? "text-text-secondary line-through" : ""}`}
                        >
                          {value}
                          {soldOut ? <span className="ml-1 text-xs no-underline">(Habis)</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="jumlah" className="text-sm font-semibold">Jumlah</label>
              <input
                id="jumlah"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={Math.max(1, Math.min(MAX_QTY_PER_LINE, available))}
                defaultValue={1}
                disabled={available === 0}
                className="h-11 w-28 rounded-md border border-border-default px-3"
              />
              <p className="text-sm text-text-secondary">Maksimal {MAX_QTY_PER_LINE} per item.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" size="lg" disabled={available === 0} className="sm:flex-1">
                {available === 0 ? "Stok habis" : "Tambah ke keranjang"}
              </Button>
            </div>
          </form>

          <div className="rounded-lg bg-canvas p-4 text-sm text-text-secondary">
            Estimasi pengiriman dan ongkir dihitung saat checkout sesuai alamat Anda. Lihat{" "}
            <Link href="/bantuan#pengiriman" className="text-brand-600 underline">kebijakan pengiriman</Link> dan{" "}
            <Link href="/bantuan#retur" className="text-brand-600 underline">kebijakan retur</Link>.
          </div>

          <div className="space-y-4">
            <section aria-labelledby="deskripsi-title">
              <h2 id="deskripsi-title" className="text-lg font-bold">Deskripsi</h2>
              <p className="mt-2 text-text-secondary">{product.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-text-secondary">
                {product.highlights.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
            <section id="ulasan" aria-labelledby="ulasan-title">
              <h2 id="ulasan-title" className="text-lg font-bold">Ulasan</h2>
              <p className="mt-2 text-text-secondary">
                {product.reviewCount > 0
                  ? `Ringkasan: rating rata-rata ${product.rating.toFixed(1)} dari ${product.reviewCount} ulasan. Daftar ulasan lengkap belum tersedia pada versi ini.`
                  : "Belum ada ulasan untuk produk ini."}
              </p>
            </section>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/keranjang" className={buttonClass("secondary", "sm")}>Lihat keranjang</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
