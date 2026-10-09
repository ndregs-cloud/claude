import { formatIDR } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/domain/order-state";
import type { Order } from "@/lib/domain/types";
import { StatusBadge } from "./ui";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />;
}

export function OrderLinesTable({ order }: { order: Order }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">Item dalam pesanan {order.orderNumber}</caption>
        <thead>
          <tr className="border-b border-border-default text-left text-text-secondary">
            <th scope="col" className="py-2 font-medium">Produk</th>
            <th scope="col" className="py-2 text-right font-medium">Harga</th>
            <th scope="col" className="py-2 text-right font-medium">Jumlah</th>
            <th scope="col" className="py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.sku} className="border-b border-border-default last:border-0">
              <td className="py-3">
                <p className="font-medium">{line.productName}</p>
                <p className="text-text-secondary">{line.variantLabel}</p>
                {line.returnedQuantity > 0 ? <p className="text-text-secondary">Diretur: {line.returnedQuantity}</p> : null}
              </td>
              <td className="py-3 text-right tabular-nums">{formatIDR(line.unitPriceIdr)}</td>
              <td className="py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="py-3 text-right tabular-nums">{formatIDR(line.lineTotalIdr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd className="tabular-nums">{formatIDR(order.subtotalIdr)}</dd></div>
      {order.discountIdr > 0 ? (
        <div className="flex justify-between"><dt className="text-text-secondary">Diskon{order.promoCode ? ` (${order.promoCode})` : ""}</dt><dd className="tabular-nums">− {formatIDR(order.discountIdr)}</dd></div>
      ) : null}
      <div className="flex justify-between"><dt className="text-text-secondary">Ongkir ({order.shippingServiceName})</dt><dd className="tabular-nums">{formatIDR(order.shippingIdr)}</dd></div>
      <div className="flex justify-between border-t border-border-default pt-2 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatIDR(order.totalIdr)}</dd></div>
    </dl>
  );
}

export function OrderTimeline({ order, includeInternal = false }: { order: Order; includeInternal?: boolean }) {
  const events = order.history.filter((event) => includeInternal || event.visibility === "customer");
  return (
    <ol className="space-y-4">
      {[...events].reverse().map((event, index) => (
        <li key={`${event.at}-${index}`} className="relative border-l-2 border-border-default pl-4">
          <span className="absolute -left-[5px] top-1 size-2 rounded-full bg-brand-600" aria-hidden="true" />
          <p className="font-semibold">{STATUS_LABEL[event.to]}</p>
          <p className="text-sm text-text-secondary">{formatDateTime(event.at)}</p>
          <p className="text-sm">{event.reason}</p>
          {includeInternal ? <p className="text-xs text-text-secondary">Visibilitas: {event.visibility}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function AddressBlock({ order }: { order: Order }) {
  const a = order.shippingAddress;
  return (
    <address className="not-italic text-sm leading-relaxed">
      <p className="font-semibold">{a.recipientName}</p>
      <p>{a.phone}</p>
      <p>{a.street}</p>
      <p>{a.district}, {a.city}</p>
      <p>{a.province} {a.postalCode}</p>
      {a.notes ? <p className="text-text-secondary">Catatan: {a.notes}</p> : null}
    </address>
  );
}
