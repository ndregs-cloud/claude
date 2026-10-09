import { formatIDR } from "@/lib/money";

export function PriceBlock({
  currentIdr,
  compareAtIdr,
  size = "md",
  prefix,
}: {
  currentIdr: number;
  compareAtIdr?: number | null;
  size?: "sm" | "md" | "lg";
  prefix?: string;
}) {
  const sizeClass = size === "lg" ? "text-3xl" : size === "md" ? "text-lg" : "text-base";
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      {prefix ? <span className="text-sm text-text-secondary">{prefix}</span> : null}
      <span className={`font-bold tabular-nums ${sizeClass}`}>{formatIDR(currentIdr)}</span>
      {compareAtIdr && compareAtIdr > currentIdr ? (
        <span className="text-sm text-text-secondary line-through tabular-nums">
          <span className="sr-only">Harga sebelumnya </span>
          {formatIDR(compareAtIdr)}
        </span>
      ) : null}
    </div>
  );
}

export const money = formatIDR;
