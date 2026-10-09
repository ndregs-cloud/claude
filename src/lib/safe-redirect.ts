/** Hanya izinkan path relatif internal untuk parameter "lanjut" (cegah open redirect). */
export function safeNext(raw: string | null | undefined, fallback = "/akun"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  return raw;
}

export function withMessage(path: string, kind: "pesan" | "galat", text: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(text)}`;
}
