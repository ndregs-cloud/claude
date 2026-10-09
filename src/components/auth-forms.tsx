"use client";

import { useActionState } from "react";
import { loginAction, registerAction, type AuthFormState } from "@/app/actions/auth";
import { Alert, Button, TextField } from "./ui";

const initial: AuthFormState = { error: null, fieldErrors: {}, values: {} };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5" aria-label="Form masuk">
      <input type="hidden" name="lanjut" value={next} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <TextField name="email" label="Email" type="email" required autoComplete="email" inputMode="email" defaultValue={state.values.email} error={state.fieldErrors.email} />
      <TextField name="password" label="Kata sandi" type="password" required autoComplete="current-password" />
      <Button type="submit" disabled={pending} fullWidth>{pending ? "Memproses…" : "Masuk"}</Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border-default bg-surface p-5" aria-label="Form daftar">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <TextField name="name" label="Nama lengkap" required autoComplete="name" defaultValue={state.values.name} error={state.fieldErrors.name} />
      <TextField name="email" label="Email" type="email" required autoComplete="email" inputMode="email" defaultValue={state.values.email} error={state.fieldErrors.email} />
      <TextField name="phone" label="Nomor ponsel" type="tel" required autoComplete="tel" inputMode="tel" placeholder="08xxxxxxxxxx" defaultValue={state.values.phone} error={state.fieldErrors.phone} />
      <TextField name="password" label="Kata sandi" type="password" required autoComplete="new-password" help="Minimal 8 karakter." error={state.fieldErrors.password} />
      <Button type="submit" disabled={pending} fullWidth>{pending ? "Membuat akun…" : "Buat akun"}</Button>
    </form>
  );
}
