// Autentikasi berbasis sesi server-side. Ganti dengan Supabase Auth (atau setara) sebelum produksi:
// lihat blueprint 10.2. Sesi di sini hanya in-memory dan tidak bertahan saat restart.
import { randomBytes } from "node:crypto";
import { addUser, audit, getDb, now, toAuthUser } from "../db";
import type { AuthUser, Session } from "../domain/types";
import { normalizeEmail, normalizePhone, type FieldErrors } from "../domain/validation";
import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "ng_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

let dummyHash: string | null = null;

export type RegisterResult = { ok: true; user: AuthUser } | { ok: false; errors: FieldErrors };

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export function registerCustomer(input: RegisterInput): RegisterResult {
  const db = getDb();
  const errors: FieldErrors = {};
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if (name.length < 2) errors.name = "Isi nama lengkap Anda.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Masukkan alamat email yang valid.";
  if (!phone) errors.phone = "Masukkan nomor ponsel yang valid, misalnya 08xxxxxxxxxx.";
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (db.usersByEmail.has(email)) {
    // Pesan umum agar tidak menjadi oracle keberadaan akun; pengguna diarahkan ke login/lupa sandi.
    return { ok: false, errors: { email: "Email tidak dapat digunakan. Coba masuk atau gunakan email lain." } };
  }

  const user = addUser(db, { email, name, phone, role: "customer", password: input.password });
  audit(user.id, "auth.register", user.id);
  return { ok: true, user: toAuthUser(user) };
}

/** Pesan kegagalan selalu sama, dan verifikasi hash tetap dijalankan agar waktu respons seragam. */
export function authenticate(email: string, password: string): AuthUser | null {
  const db = getDb();
  const userId = db.usersByEmail.get(normalizeEmail(email));
  const user = userId ? db.users.get(userId) : undefined;
  if (!user) {
    dummyHash ??= hashPassword(randomBytes(12).toString("hex"));
    verifyPassword(password, dummyHash);
    return null;
  }
  if (!verifyPassword(password, user.passwordHash)) {
    audit(user.id, "auth.login_failed", user.id);
    return null;
  }
  audit(user.id, "auth.login", user.id);
  return toAuthUser(user);
}

export function createSession(userId: string): Session {
  const createdAt = now();
  const session: Session = {
    id: randomBytes(32).toString("base64url"),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS).toISOString(),
  };
  getDb().sessions.set(session.id, session);
  return session;
}

export function resolveSession(sessionId: string | undefined | null): AuthUser | null {
  if (!sessionId) return null;
  const db = getDb();
  const session = db.sessions.get(sessionId);
  if (!session) return null;
  if (Date.parse(session.expiresAt) < now().getTime()) {
    db.sessions.delete(sessionId);
    return null;
  }
  const user = db.users.get(session.userId);
  return user ? toAuthUser(user) : null;
}

export function endSession(sessionId: string | undefined | null): void {
  if (sessionId) getDb().sessions.delete(sessionId);
}
