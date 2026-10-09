import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Button, EmptyState, LinkButton, buttonClass } from "@/components/ui";
import { PriceBlock } from "@/components/money";
import { ProductVisual } from "@/components/product-card";
import { getCartItems } from "@/lib/auth-context";
import { formatIDR } from "@/lib/money";
import { buildCartView } from "@/lib/services/cart";
import { updateCartAction, clearInvalidItemsAction } from "@/app/actions/cart";

export const metadata: Metadata = { title: "Keranjang" };

export default async function KeranjangPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = buildCartView(await getCartItems());

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-bold md:text-3xl">Keranjang</h1>
      {sp.pesan ? <div className="mt-4"><Alert tone="success">{sp.pesan}</Alert></div> : null}
      {sp.galat ? <div className="mt-4"><Alert tone="danger">{sp.galat}</Alert></div> : null}

      {view.lines.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Keranjang masih kosong"
            description="Pesanan yang Anda tambahkan akan tampil di sini. Mulai dari koleksi terbaru."
            action={<LinkButton href="/belanja">Mulai belanja</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ul className="flex flex-col gap-3" aria-label="Item di keranjang">
            {view.lines.map((line) => (
              <li key={line.sku} className="flex gap-4 rounded-xl border border-border-default bg-surface p-4">
                <ProductVisual tone={line.tone} name={line.productName} className="size-20 shrink-0 sm:size-24" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {line.productSlug ? (
                        <Link href={`/produk/${line.productSlug}?v=${line.sku}`} className="font-semibold hover:text-brand-600 hover:underline">
                          {line.productName}
                        </Link>
                      ) : (
                        <p className="font-semibold">{line.productName}</p>
                      )}
                      <p className="text-sm text-text-secondary">Varian: {line.variantLabel || "-"}</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatIDR(line.lineTotalIdr)}</p>
                  </div>
                  <p className="text-sm text-text-secondary">Harga satuan {formatIDR(line.unitPriceIdr)}</p>
                  {line.issue ? <p className="text-sm font-medium text-danger">{line.issue}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <form action={updateCartAction} className="flex items-center gap-1">
                      <input type="hidden" name="sku" value={line.sku} />
                      <input type="hidden" name="op" value="dec" />
                      <button type="submit" aria-label={`Kurangi jumlah ${line.productName}`} className={buttonClass("secondary", "sm", false, "size-11 px-0")}>−</button>
                    </form>
                    <output aria-label={`Jumlah ${line.productName}`} className="min-w-10 text-center font-semibold tabular-nums">{line.quantity}</output>
                    <form action={updateCartAction} className="flex items-center gap-1">
                      <input type="hidden" name="sku" value={line.sku} />
                      <input type="hidden" name="op" value="inc" />
                      <button type="submit" aria-label={`Tambah jumlah ${line.productName}`} className={buttonClass("secondary", "sm", false, "size-11 px-0")} disabled={line.quantity >= line.available}>+</button>
                    </form>
                    <form action={updateCartAction} className="ml-2">
                      <input type="hidden" name="sku" value={line.sku} />
                      <input type="hidden" name="op" value="remove" />
                      <button type="submit" aria-label={`Hapus ${line.productName} dari keranjang`} className={buttonClass("tertiary", "sm", false, "text-danger")}>Hapus</button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside aria-labelledby="ringkasan-keranjang" className="h-fit rounded-xl border border-border-default bg-surface p-5 shadow-1 lg:sticky lg:top-24">
            <h2 id="ringkasan-keranjang" className="text-lg font-bold">Ringkasan</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-text-secondary">Jumlah item</dt><dd className="tabular-nums">{view.itemCount}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd className="tabular-nums">{formatIDR(view.subtotalIdr)}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Diskon &amp; ongkir</dt><dd className="text-text-secondary">Dihitung saat checkout</dd></div>
            </dl>
            <div className="mt-4 border-t border-border-default pt-4">
              <PriceBlock currentIdr={view.subtotalIdr} prefix="Subtotal sementara" />
            </div>
            <div className="mt-5 flex flex-col gap-3">
              {view.hasBlockingIssue ? (
                <>
                  <Alert tone="warning">Ada item yang perlu diperbaiki sebelum checkout.</Alert>
                  <form action={clearInvalidItemsAction}>
                    <Button variant="secondary" fullWidth type="submit">Hapus item yang bermasalah</Button>
                  </form>
                </>
              ) : (
                <Link href="/checkout" className={buttonClass("primary", "lg", true)}>Lanjut ke checkout</Link>
              )}
              <Link href="/belanja" className={buttonClass("tertiary", "md", true)}>Lanjutkan belanja</Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
