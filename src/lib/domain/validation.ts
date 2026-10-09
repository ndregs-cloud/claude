import type { AddressInput, ContactInput } from "./types";

export type FieldErrors = Record<string, string>;
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES_PER_CART = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Menerima 08xxxxxxxxxx atau +628xxxxxxxxx; mengembalikan format +62 atau null. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, "");
  let digits: string;
  if (compact.startsWith("+62")) digits = compact.slice(3);
  else if (compact.startsWith("62")) digits = compact.slice(2);
  else if (compact.startsWith("0")) digits = compact.slice(1);
  else return null;
  if (!/^\d+$/.test(digits) || digits.length < 9 || digits.length > 12) return null;
  return `+62${digits}`;
}

export function parseQuantity(raw: unknown): number | null {
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_QTY_PER_LINE) return null;
  return value;
}

export function validateContact(input: ContactInput): ValidationResult<ContactInput> {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  if (name.length < 2) errors.name = "Isi nama lengkap Anda.";
  if (!EMAIL_RE.test(email)) errors.email = "Masukkan alamat email yang valid.";
  if (!phone) errors.phone = "Masukkan nomor ponsel yang valid, misalnya 08xxxxxxxxxx.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, phone: phone as string } };
}

export function validateAddress(input: AddressInput): ValidationResult<AddressInput> {
  const errors: FieldErrors = {};
  const value: AddressInput = {
    recipientName: input.recipientName.trim(),
    phone: input.phone,
    province: input.province.trim(),
    city: input.city.trim(),
    district: input.district.trim(),
    postalCode: input.postalCode.trim(),
    street: input.street.trim(),
    notes: input.notes.trim(),
  };

  if (value.recipientName.length < 2) errors.recipientName = "Isi nama penerima.";
  const phone = normalizePhone(input.phone);
  if (!phone) errors.phone = "Masukkan nomor ponsel yang valid, misalnya 08xxxxxxxxxx.";
  else value.phone = phone;
  if (!value.province) errors.province = "Pilih provinsi.";
  if (!value.city) errors.city = "Isi kota atau kabupaten.";
  if (!value.district) errors.district = "Isi kecamatan.";
  if (!/^\d{5}$/.test(value.postalCode)) errors.postalCode = "Kode pos harus 5 digit.";
  if (value.street.length < 5) errors.street = "Isi alamat jalan, nomor rumah, RT/RW.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

/** Masking PII untuk tampilan admin: tanpa hak customer.read. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 5)}*****${phone.slice(-2)}`;
}
