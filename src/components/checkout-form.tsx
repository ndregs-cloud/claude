"use client";

import { useActionState, useCallback, useEffect, useRef, useState, startTransition } from "react";
import { checkoutAction, previewCheckoutAction, type CheckoutFormState, type CheckoutPreview } from "@/app/actions/checkout";
import { formatIDR } from "@/lib/money";
import { PROVINCES } from "@/lib/shipping/provider";
import { Alert, Button, SelectField, TextField } from "./ui";

const initialState: CheckoutFormState = { formError: null, errors: {}, values: {} };

export interface CheckoutLine {
  sku: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  lineTotalIdr: number;
}

const FIELD_LABEL: Record<string, string> = {
  contactName: "Nama lengkap",
  contactEmail: "Email",
  contactPhone: "Nomor ponsel",
  recipientName: "Nama penerima",
  recipientPhone: "Nomor ponsel penerima",
  province: "Provinsi",
  city: "Kota/kabupaten",
  district: "Kecamatan",
  postalCode: "Kode pos",
  street: "Alamat lengkap",
  shippingServiceId: "Layanan pengiriman",
  promoCode: "Kode promo",
  terms: "Persetujuan",
};

export function CheckoutForm({
  idempotencyKey,
  lines,
  initial,
}: {
  idempotencyKey: string;
  lines: CheckoutLine[];
  initial: Record<string, string>;
}) {
  const [state, formAction, isPending] = useActionState(checkoutAction, initialState);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Total dan ongkir selalu dihitung ulang di server; klien hanya menampilkan hasilnya.
  const refresh = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    startTransition(async () => {
      setPreview(await previewCheckoutAction(data));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const scheduleRefresh = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 350);
  };

  const value = (key: string) => state.values[key] ?? initial[key] ?? "";
  const error = (key: string) => state.errors[key];
  const errorEntries = Object.entries(state.errors);
  const promoError =
    error("promoCode") ?? (preview?.promo.status === "invalid" ? preview.promo.message ?? undefined : undefined);
  const blocked = !preview || !preview.ready || preview.blockingMessage !== null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={scheduleRefresh}
      aria-label="Checkout"
      className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="flex min-w-0 flex-col gap-8">
        {state.formError ? (
          <Alert tone="danger" title="Checkout belum dapat diproses">
            {state.formError}
          </Alert>
        ) : null}
        {errorEntries.length > 0 ? (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger-bg p-4">
            <p className="font-semibold">Periksa {errorEntries.length} isian berikut:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {errorEntries.map(([key, message]) => (
                <li key={key}>
                  <a href={`#f-${key}`} className="underline">
                    {FIELD_LABEL[key] ? `${FIELD_LABEL[key]}: ` : ""}
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <section aria-labelledby="kontak-title" className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5">
          <h2 id="kontak-title" className="text-lg font-bold">1. Data kontak</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="contactName" label="Nama lengkap" required autoComplete="name" defaultValue={value("contactName")} error={error("contactName")} />
            <TextField name="contactEmail" label="Email" type="email" required autoComplete="email" inputMode="email" defaultValue={value("contactEmail")} error={error("contactEmail")} help="Konfirmasi pesanan dan pelacakan dikirim ke email ini." />
            <TextField name="contactPhone" label="Nomor ponsel" type="tel" required autoComplete="tel" inputMode="tel" placeholder="08xxxxxxxxxx" defaultValue={value("contactPhone")} error={error("contactPhone")} />
          </div>
        </section>

        <section aria-labelledby="alamat-title" className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5">
          <h2 id="alamat-title" className="text-lg font-bold">2. Alamat pengiriman</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="recipientName" label="Nama penerima" required autoComplete="shipping name" defaultValue={value("recipientName")} error={error("recipientName")} />
            <TextField name="recipientPhone" label="Nomor ponsel penerima" type="tel" required autoComplete="shipping tel" inputMode="tel" placeholder="08xxxxxxxxxx" defaultValue={value("recipientPhone")} error={error("recipientPhone")} />
            <SelectField name="province" label="Provinsi" required options={PROVINCES.map((p) => ({ value: p, label: p }))} defaultValue={value("province")} error={error("province")} />
            <TextField name="city" label="Kota/kabupaten" required autoComplete="address-level2" defaultValue={value("city")} error={error("city")} />
            <TextField name="district" label="Kecamatan" required defaultValue={value("district")} error={error("district")} />
            <TextField name="postalCode" label="Kode pos" required inputMode="numeric" autoComplete="postal-code" maxLength={5} defaultValue={value("postalCode")} error={error("postalCode")} />
            <div className="sm:col-span-2">
              <TextField name="street" label="Alamat lengkap" required autoComplete="street-address" placeholder="Jalan, nomor rumah, RT/RW, patokan" defaultValue={value("street")} error={error("street")} />
            </div>
            <div className="sm:col-span-2">
              <TextField name="notes" label="Catatan untuk kurir (opsional)" defaultValue={value("notes")} />
            </div>
          </div>
        </section>

        <section aria-labelledby="kirim-title" className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5">
          <h2 id="kirim-title" className="text-lg font-bold">3. Layanan pengiriman</h2>
          {preview && preview.shippingOptions.length > 0 ? (
            <fieldset className="flex flex-col gap-3" aria-describedby={error("shippingServiceId") ? "f-shippingServiceId-err" : undefined}>
              <legend className="sr-only">Pilih layanan pengiriman</legend>
              {preview.shippingOptions.map((option) => (
                <label key={option.serviceId} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-default p-4 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingServiceId"
                      value={option.serviceId}
                      defaultChecked={(value("shippingServiceId") || preview.selectedServiceId) === option.serviceId}
                      className="size-5 accent-brand-600"
                    />
                    <span>
                      <span className="block font-semibold">{option.serviceName}</span>
                      <span className="block text-sm text-text-secondary">Estimasi {option.estimate}</span>
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatIDR(option.costIdr)}</span>
                </label>
              ))}
              {error("shippingServiceId") ? (
                <p id="f-shippingServiceId-err" className="text-sm text-danger">{error("shippingServiceId")}</p>
              ) : null}
            </fieldset>
          ) : (
            <p className="text-sm text-text-secondary">Pilih provinsi di atas untuk melihat layanan dan ongkir. Ongkir dihitung dari alamat Anda.</p>
          )}
        </section>

        <section aria-labelledby="promo-title" className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5">
          <h2 id="promo-title" className="text-lg font-bold">4. Promo &amp; persetujuan</h2>
          <TextField name="promoCode" label="Kode promo (opsional)" defaultValue={value("promoCode")} error={promoError} help={preview?.promo.status === "applied" ? preview.promo.message ?? undefined : "Syarat promo ditampilkan setelah kode dimasukkan."} />
          <div className="flex flex-col gap-1.5">
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" name="terms" defaultChecked={value("terms") === "on"} className="mt-1 size-5 accent-brand-600" aria-describedby={error("termsAccepted") ? "f-terms-err" : undefined} />
              <span>Saya menyetujui <a href="/bantuan#pengiriman" className="text-brand-600 underline">syarat pengiriman</a> dan <a href="/bantuan#retur" className="text-brand-600 underline">kebijakan retur</a>.</span>
            </label>
            {error("termsAccepted") ? <p id="f-terms-err" className="text-sm text-danger">{error("termsAccepted")}</p> : null}
          </div>
        </section>
      </div>

      <aside aria-labelledby="ringkasan-title" className="h-fit rounded-xl border border-border-default bg-surface p-5 shadow-1 lg:sticky lg:top-24">
        <h2 id="ringkasan-title" className="text-lg font-bold">Ringkasan pesanan</h2>
        <ul className="mt-4 space-y-3 border-b border-border-default pb-4 text-sm">
          {lines.map((line) => (
            <li key={line.sku} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium">{line.productName}</span>
                <span className="text-text-secondary">{line.variantLabel} × {line.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatIDR(line.lineTotalIdr)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm" aria-live="polite">
          <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd className="tabular-nums">{formatIDR(preview?.subtotalIdr ?? lines.reduce((s, l) => s + l.lineTotalIdr, 0))}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Diskon</dt><dd className="tabular-nums">{preview && preview.discountIdr > 0 ? `− ${formatIDR(preview.discountIdr)}` : "–"}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Ongkir</dt><dd className="tabular-nums">{preview?.ready ? formatIDR(preview.shippingIdr) : "Dihitung dari alamat"}</dd></div>
          <div className="flex justify-between border-t border-border-default pt-3 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{preview ? formatIDR(preview.totalIdr) : "Menghitung…"}</dd></div>
        </dl>
        {preview?.blockingMessage ? <div className="mt-4"><Alert tone="warning">{preview.blockingMessage}</Alert></div> : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button type="submit" size="lg" fullWidth disabled={isPending || blocked}>
            {isPending ? "Memproses pesanan…" : "Buat pesanan"}
          </Button>
          {blocked && !preview?.blockingMessage ? (
            <p className="text-xs text-text-secondary">Lengkapi provinsi dan pilih layanan pengiriman untuk mengaktifkan tombol.</p>
          ) : null}
          <p className="text-xs text-text-secondary">
            Pesanan dibuat dengan status menunggu pembayaran. Status berubah menjadi dibayar hanya setelah penyedia pembayaran mengonfirmasi.
          </p>
        </div>
      </aside>
    </form>
  );
}
