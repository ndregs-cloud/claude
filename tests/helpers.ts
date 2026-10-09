import { resetDb, setClock, getDb, addUser, toAuthUser } from "@/lib/db";
import type { Viewer, AuthUser } from "@/lib/domain/types";
import type { ContactInput, AddressInput } from "@/lib/domain/types";
import type { CreateOrderInput } from "@/lib/services/orders";

export const TEST_PASSWORD = "uji-coba-12345";

export function startAt(iso: string) {
  let current = new Date(iso).getTime();
  setClock(() => new Date(current));
  return {
    advanceMinutes(minutes: number) {
      current += minutes * 60_000;
    },
    set(iso2: string) {
      current = new Date(iso2).getTime();
    },
  };
}

export function freshDb() {
  return resetDb({ seedDemo: false });
}

export function staff(role: AuthUser["role"], email = `${role}@uji.id`): AuthUser {
  const user = addUser(getDb(), { email, name: `Uji ${role}`, phone: null, role, password: TEST_PASSWORD });
  return toAuthUser(user);
}

export const CUSTOMER_CONTACT: ContactInput = { name: "Budi Santoso", email: "budi@uji.id", phone: "081234567890" };

export const ADDRESS: AddressInput = {
  recipientName: "Budi Santoso",
  phone: "081234567890",
  province: "DKI Jakarta",
  city: "Jakarta Selatan",
  district: "Kebayoran Baru",
  postalCode: "12345",
  street: "Jl. Contoh No. 1, RT 01/RW 02",
  notes: "",
};

export function orderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    idempotencyKey: "key-uji-0001",
    items: [{ sku: "UR02-BLK-42", quantity: 1 }],
    contact: CUSTOMER_CONTACT,
    address: ADDRESS,
    shippingServiceId: "reguler",
    promoCode: "",
    termsAccepted: true,
    ...overrides,
  };
}

export function asViewer(user: AuthUser): Viewer {
  return user;
}

export const GUEST: Viewer = null;
