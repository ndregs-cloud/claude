import { cookies } from "next/headers";
import { CART_COOKIE, serializeCart, type CartItem } from "./services/cart";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./services/auth";
import { GUEST_ORDERS_COOKIE } from "./auth-context";

const base = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export async function setSessionCookie(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, { ...base(), maxAge: SESSION_TTL_MS / 1000 });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function writeCartCookie(items: readonly CartItem[]): Promise<void> {
  const jar = await cookies();
  if (items.length === 0) {
    jar.delete(CART_COOKIE);
    return;
  }
  jar.set(CART_COOKIE, serializeCart(items), { ...base(), maxAge: 60 * 60 * 24 * 30 });
}

export async function rememberGuestOrder(orderNumber: string, existing: readonly string[]): Promise<void> {
  const jar = await cookies();
  const next = [...existing.filter((item) => item !== orderNumber), orderNumber].slice(-10);
  jar.set(GUEST_ORDERS_COOKIE, JSON.stringify(next), { ...base(), maxAge: 60 * 60 * 24 * 30 });
}
