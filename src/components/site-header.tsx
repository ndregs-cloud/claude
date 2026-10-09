import Link from "next/link";
import { isStaff } from "@/lib/domain/permissions";
import type { AuthUser } from "@/lib/domain/types";
import { logoutAction } from "@/app/actions/auth";
import { buttonClass } from "./ui";

export function SiteHeader({ viewer, cartCount }: { viewer: AuthUser | null; cartCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-h-11 items-center text-xl font-extrabold tracking-tight" aria-label="NOVA STORE, beranda">
            NOVA<span className="text-brand-600">STORE</span>
          </Link>
          <nav aria-label="Akun dan keranjang" className="flex items-center gap-1 md:hidden">
            <Link href="/keranjang" className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-canvas" aria-label={`Keranjang, ${cartCount} item`}>
              Keranjang{cartCount > 0 ? ` (${cartCount})` : ""}
            </Link>
          </nav>
        </div>

        <form action="/cari" role="search" className="flex-1">
          <label htmlFor="cari-q" className="sr-only">
            Cari produk, brand, atau kategori
          </label>
          <div className="flex h-11 items-center gap-2 rounded-md border border-border-default bg-canvas px-3 focus-within:border-brand-600">
            <input
              id="cari-q"
              name="q"
              type="search"
              placeholder="Cari produk, brand, atau kategori…"
              className="h-full w-full bg-transparent text-[15px] outline-none placeholder:text-text-secondary"
              maxLength={80}
            />
            <button type="submit" className={buttonClass("primary", "sm")}>
              Cari
            </button>
          </div>
        </form>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 text-sm font-semibold md:flex">
          <Link href="/belanja" className="flex min-h-11 items-center rounded-md px-3 hover:bg-canvas">Kategori</Link>
          <Link href="/bantuan" className="flex min-h-11 items-center rounded-md px-3 hover:bg-canvas">Bantuan</Link>
          {viewer ? (
            <Link href="/akun" className="flex min-h-11 items-center rounded-md px-3 hover:bg-canvas">Akun</Link>
          ) : (
            <Link href="/masuk" className="flex min-h-11 items-center rounded-md px-3 hover:bg-canvas">Masuk</Link>
          )}
          {isStaff(viewer) ? (
            <Link href="/admin" className="flex min-h-11 items-center rounded-md px-3 text-brand-600 hover:bg-brand-50">Admin</Link>
          ) : null}
          <Link
            href="/keranjang"
            className="ml-1 flex min-h-11 items-center gap-2 rounded-md bg-ink-900 px-4 text-white hover:bg-ink-900/90"
            aria-label={`Keranjang, ${cartCount} item`}
          >
            Keranjang
            {cartCount > 0 ? (
              <span className="rounded-full bg-white px-2 text-xs font-bold text-ink-900" aria-hidden="true">
                {cartCount}
              </span>
            ) : null}
          </Link>
          {viewer ? (
            <form action={logoutAction}>
              <button type="submit" className="ml-1 flex min-h-11 items-center rounded-md px-3 text-text-secondary hover:bg-canvas">
                Keluar
              </button>
            </form>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
