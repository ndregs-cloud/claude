// Penyimpanan in-memory yang berbentuk seperti tabel Postgres (lihat db/migrations/0001_init.sql).
// Ganti dengan adapter Postgres/Supabase tanpa mengubah layer domain atau service.
// Operasi kritis (stok, idempotensi, deduplikasi webhook) ditulis sebagai blok sinkron
// agar atomik di runtime Node tunggal; di Postgres padanannya adalah transaksi + row lock.
import { randomBytes, randomUUID } from "node:crypto";
import { INITIAL_STOCK, PRODUCTS } from "./catalog/seed";
import type {
  AuditEntry,
  AuthUser,
  Order,
  PaymentAttempt,
  PaymentException,
  Product,
  ProviderEventRecord,
  Refund,
  ReturnCase,
  Session,
  StockMovement,
  StockRow,
  User,
} from "./domain/types";
import { hashPassword } from "./services/password";

export interface Db {
  users: Map<string, User>;
  usersByEmail: Map<string, string>;
  sessions: Map<string, Session>;
  products: Product[];
  stock: Map<string, StockRow>;
  stockMovements: StockMovement[];
  orders: Map<string, Order>;
  idempotency: Map<string, string>;
  paymentAttempts: Map<string, PaymentAttempt>;
  providerEvents: Map<string, ProviderEventRecord>;
  paymentExceptions: PaymentException[];
  refunds: Map<string, Refund>;
  returns: Map<string, ReturnCase>;
  auditLog: AuditEntry[];
}

let clock: () => Date = () => new Date();

export function setClock(fn: () => Date): void {
  clock = fn;
}

export function now(): Date {
  return clock();
}

export function newId(): string {
  return randomUUID();
}

const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateOrderNumber(db: Db): string {
  const stamp = now().toISOString().slice(0, 10).replace(/-/g, "");
  for (;;) {
    const bytes = randomBytes(6);
    let suffix = "";
    for (const byte of bytes) suffix += ORDER_ALPHABET[byte % ORDER_ALPHABET.length];
    const candidate = `NS-${stamp}-${suffix}`;
    if (!db.orders.has(candidate)) return candidate;
  }
}

export function createEmptyDb(): Db {
  const stock = new Map<string, StockRow>();
  for (const [sku, onHand] of Object.entries(INITIAL_STOCK)) {
    stock.set(sku, {
      sku,
      onHand,
      reserved: 0,
      damaged: 0,
      safetyStock: 0,
      updatedAt: now().toISOString(),
    });
  }
  return {
    users: new Map(),
    usersByEmail: new Map(),
    sessions: new Map(),
    products: PRODUCTS,
    stock,
    stockMovements: [],
    orders: new Map(),
    idempotency: new Map(),
    paymentAttempts: new Map(),
    providerEvents: new Map(),
    paymentExceptions: [],
    refunds: new Map(),
    returns: new Map(),
    auditLog: [],
  };
}

export function addUser(db: Db, input: { email: string; name: string; phone: string | null; role: User["role"]; password: string }): User {
  const user: User = {
    id: newId(),
    email: input.email,
    name: input.name,
    phone: input.phone,
    role: input.role,
    passwordHash: hashPassword(input.password),
    createdAt: now().toISOString(),
  };
  db.users.set(user.id, user);
  db.usersByEmail.set(user.email, user.id);
  return user;
}

/**
 * Akun demo hanya dibuat di luar production. Kata sandi diambil dari NG_DEMO_PASSWORD
 * atau dibuat acak per proses (dicetak sekali ke log server). Tidak ada kredensial di source code.
 */
function seedDemoUsers(db: Db): void {
  if (process.env.NODE_ENV === "production") return;
  const password = process.env.NG_DEMO_PASSWORD ?? randomBytes(12).toString("base64url");
  if (!process.env.NG_DEMO_PASSWORD && process.env.NODE_ENV === "development") {
    console.info(`[demo] Kata sandi akun demo (sementara): ${password}`);
  }
  const demo: Array<{ email: string; name: string; role: User["role"] }> = [
    { email: "pelanggan@contoh.id", name: "Pelanggan Demo", role: "customer" },
    { email: "operator@contoh.id", name: "Operator Pesanan", role: "order_operator" },
    { email: "gudang@contoh.id", name: "Operator Gudang", role: "warehouse" },
    { email: "finance@contoh.id", name: "Finance Demo", role: "finance" },
    { email: "manajer@contoh.id", name: "Manajer Demo", role: "manager" },
    { email: "admin@contoh.id", name: "Admin Demo", role: "admin" },
  ];
  for (const account of demo) {
    addUser(db, { ...account, phone: null, password });
  }
}

export function createDb(options: { seedDemo?: boolean } = {}): Db {
  const db = createEmptyDb();
  if (options.seedDemo ?? true) seedDemoUsers(db);
  return db;
}

const globalForDb = globalThis as unknown as { __ngStoreDb__?: Db };

export function getDb(): Db {
  if (!globalForDb.__ngStoreDb__) globalForDb.__ngStoreDb__ = createDb();
  return globalForDb.__ngStoreDb__;
}

export function resetDb(options: { seedDemo?: boolean } = {}): Db {
  globalForDb.__ngStoreDb__ = createDb(options);
  return globalForDb.__ngStoreDb__;
}

export function audit(
  actorId: string | null,
  action: string,
  target: string,
  details: AuditEntry["details"] = {},
): void {
  getDb().auditLog.push({
    id: newId(),
    at: now().toISOString(),
    actorId,
    action,
    target,
    details,
  });
}

export function toAuthUser(user: User): AuthUser {
  const rest: AuthUser = { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, createdAt: user.createdAt };
  return rest;
}
