import Link from "next/link";

export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Navigasi halaman" className="flex items-center justify-between gap-3 pt-6">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="rounded-md border border-border-default bg-surface px-4 py-2 text-sm font-semibold hover:bg-canvas">
          ← Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-text-secondary" aria-current="page">
        Halaman {page} dari {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={buildHref(page + 1)} className="rounded-md border border-border-default bg-surface px-4 py-2 text-sm font-semibold hover:bg-canvas">
          Berikutnya →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
