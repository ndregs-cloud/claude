// Pembungkus untuk konteks request Next.js (cookies). Jangan dipakai di test unit murni.
import { cookies } from "next/headers";
import type { AuthUser } from "./domain/types";
import { parseCart, CART_COOKIE, type CartItem } from "./services/cart";
import { resolveSession, SESSION_COOKIE } from "./services/auth";

export const GUEST_ORDERS_COOKIE = "ng_guest_orders";
const ORDER_NUMBER_RE = /^NS-\d{8}-[A-Z2-9]{6}$/;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return resolveSession(jar.get(SESSION_COOKIE)?.value);
}

export async function getCartItems(): Promise<CartItem[]> {
  const jar = await cookies();
  return parseCart(jar.get(CART_COOKIE)?.value);
}

export async function getGuestOrderNumbers(): Promise<string[]> {
  const jar = await cookies();
  const raw = jar.get(GUEST_ORDERS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && ORDER_NUMBER_RE.test(item)).slice(-10);
  } catch {
    return [];
  }
}
