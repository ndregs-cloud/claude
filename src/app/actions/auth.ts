"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, setSessionCookie } from "@/lib/cookies";
import { safeNext } from "@/lib/safe-redirect";
import { authenticate, createSession, endSession, registerCustomer, SESSION_COOKIE } from "@/lib/services/auth";
import { cookies } from "next/headers";

export interface AuthFormState {
  error: string | null;
  fieldErrors: Record<string, string>;
  values: Record<string, string>;
}

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = str(formData, "email");
  const password = str(formData, "password");
  const values = { email };
  if (!email || !password) {
    return { error: "Isi email dan kata sandi.", fieldErrors: {}, values };
  }
  const user = authenticate(email, password);
  // Pesan sama untuk email tidak terdaftar maupun kata sandi salah (anti-enumeration).
  if (!user) return { error: "Email atau kata sandi tidak sesuai.", fieldErrors: {}, values };

  const session = createSession(user.id);
  await setSessionCookie(session.id);
  redirect(safeNext(str(formData, "lanjut"), user.role === "customer" ? "/akun" : "/admin"));
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = {
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
  };
  const result = registerCustomer({
    name: values.name,
    email: values.email,
    phone: values.phone,
    password: str(formData, "password"),
  });
  if (!result.ok) {
    return { error: "Periksa kembali data yang diisi.", fieldErrors: result.errors, values };
  }
  const session = createSession(result.user.id);
  await setSessionCookie(session.id);
  redirect("/akun");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  endSession(jar.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  redirect("/");
}
