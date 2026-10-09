"use client";

import { useActionState } from "react";
import { trackOrderAction, type TrackingState } from "@/app/actions/tracking";
import { Alert, Button, StatusBadge, TextField } from "./ui";

const initial: TrackingState = { error: null, result: null };

export function TrackForm() {
  const [state, action, pending] = useActionState(trackOrderAction, initial);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5" aria-label="Form pelacakan pesanan">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        <TextField name="orderNumber" label="Nomor pesanan" required placeholder="NS-20261010-XXXXXX" autoComplete="off" />
        <TextField name="email" label="Email pemesan" type="email" required autoComplete="email" inputMode="email" />
        <Button type="submit" disabled={pending} fullWidth>{pending ? "Memeriksa…" : "Lacak pesanan"}</Button>
      </form>

      {state.result ? (
        <section aria-labelledby="hasil-lacak" aria-live="polite" className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5">
          <h2 id="hasil-lacak" className="text-lg font-bold">Pesanan <span className="font-mono">{state.result.orderNumber}</span></h2>
          <p><StatusBadge tone={state.result.tone} label={state.result.statusLabel} /></p>
          {state.result.trackingNumber ? (
            <p className="text-sm">Kurir: {state.result.carrier} · Resi: <span className="font-mono font-semibold">{state.result.trackingNumber}</span></p>
          ) : (
            <p className="text-sm text-text-secondary">Nomor resi belum tersedia.</p>
          )}
          <p className="text-xs text-text-secondary">Diperbarui {state.result.updatedAt}</p>
          <ol className="space-y-3">
            {[...state.result.timeline].reverse().map((event, index) => (
              <li key={index} className="border-l-2 border-border-default pl-4">
                <p className="font-semibold">{event.label}</p>
                <p className="text-sm text-text-secondary">{event.at}</p>
                <p className="text-sm">{event.reason}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
