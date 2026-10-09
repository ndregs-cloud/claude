-- NOVA STORE / ndre.gstore - skema awal (PostgreSQL / Supabase-ready)
-- Sesuai blueprint section 12. Semua uang disimpan sebagai BIGINT rupiah (integer minor units, IDR).
-- Jalankan migrasi secara versi (tidak diedit manual di produksi).

BEGIN;

CREATE TYPE user_role AS ENUM ('customer','catalog_editor','order_operator','warehouse','finance','manager','admin','auditor');
CREATE TYPE product_status AS ENUM ('active','draft','archived');
CREATE TYPE order_status AS ENUM (
  'pending_payment','paid','processing','shipped','delivered','completed','cancelled',
  'return_requested','return_approved','returned','partially_refunded','refunded');
CREATE TYPE payment_attempt_status AS ENUM ('created','pending','requires_action','succeeded','failed','expired');
CREATE TYPE refund_status AS ENUM ('requested','approved','submitted','succeeded','failed','rejected');
CREATE TYPE return_status AS ENUM ('requested','approved','rejected','received');
CREATE TYPE stock_movement_type AS ENUM ('reserve','release','ship','adjust','return_to_stock','damage');

CREATE TABLE users (
  id            UUID PRIMARY KEY,               -- diselaraskan dengan auth.users pada Supabase
  email         TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  name          TEXT NOT NULL,
  phone         TEXT,
  role          user_role NOT NULL DEFAULT 'customer',
  password_hash TEXT,                           -- kosong jika memakai Supabase Auth
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE products (
  id           UUID PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  brand        TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  description  TEXT NOT NULL DEFAULT '',
  highlights   TEXT[] NOT NULL DEFAULT '{}',
  base_price_idr BIGINT NOT NULL CHECK (base_price_idr >= 0),
  compare_at_idr BIGINT CHECK (compare_at_idr IS NULL OR compare_at_idr >= 0),
  status       product_status NOT NULL DEFAULT 'draft',  -- produk draft tidak tampil publik (AT-01)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_variants (
  sku                  TEXT PRIMARY KEY CHECK (sku ~ '^[A-Z0-9-]+$'),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  label                TEXT NOT NULL,
  attributes           JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_adjustment_idr BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE inventory_locations (
  code      TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  timezone  TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE inventory_balances (
  sku           TEXT PRIMARY KEY REFERENCES product_variants(sku),
  on_hand       INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved      INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  damaged       INTEGER NOT NULL DEFAULT 0 CHECK (damaged >= 0),
  safety_stock  INTEGER NOT NULL DEFAULT 0 CHECK (safety_stock >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reserved_within_on_hand CHECK (reserved <= on_hand)
);

CREATE TABLE inventory_movements (
  id              UUID PRIMARY KEY,
  sku             TEXT NOT NULL REFERENCES product_variants(sku),
  movement_type   stock_movement_type NOT NULL,
  on_hand_delta   INTEGER NOT NULL DEFAULT 0,
  reserved_delta  INTEGER NOT NULL DEFAULT 0,
  damaged_delta   INTEGER NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL,
  order_number    TEXT,
  actor_id        UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);  -- append-only: revoke UPDATE/DELETE dari role aplikasi

CREATE TABLE orders (
  id                   UUID PRIMARY KEY,
  order_number         TEXT NOT NULL UNIQUE,
  user_id              UUID REFERENCES users(id),
  contact_name         TEXT NOT NULL,
  contact_email        TEXT NOT NULL,
  contact_phone        TEXT NOT NULL,
  shipping_address     JSONB NOT NULL,            -- snapshot alamat (blueprint 6.1)
  shipping_service_id  TEXT NOT NULL,
  shipping_service_name TEXT NOT NULL,
  shipping_estimate    TEXT NOT NULL,
  subtotal_idr         BIGINT NOT NULL CHECK (subtotal_idr >= 0),
  discount_idr         BIGINT NOT NULL DEFAULT 0 CHECK (discount_idr >= 0),
  shipping_idr         BIGINT NOT NULL DEFAULT 0 CHECK (shipping_idr >= 0),
  tax_idr              BIGINT NOT NULL DEFAULT 0 CHECK (tax_idr >= 0),
  total_idr            BIGINT NOT NULL CHECK (total_idr >= 0),
  currency             CHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  promo_code           TEXT,
  status               order_status NOT NULL DEFAULT 'pending_payment',
  payment_status       TEXT NOT NULL DEFAULT 'unpaid',
  reserved_until       TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  shipped_at           TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  carrier              TEXT,
  tracking_number      TEXT,
  idempotency_key      TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_matches CHECK (total_idr = subtotal_idr - discount_idr + shipping_idr + tax_idr),
  CONSTRAINT orders_idempotency UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_status_created_idx ON orders (status, created_at);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at);

CREATE TABLE order_lines (
  id                UUID PRIMARY KEY,
  order_number      TEXT NOT NULL REFERENCES orders(order_number),
  sku               TEXT NOT NULL REFERENCES product_variants(sku),
  product_name      TEXT NOT NULL,              -- snapshot (CAT-05)
  variant_label     TEXT NOT NULL,
  unit_price_idr    BIGINT NOT NULL CHECK (unit_price_idr >= 0),
  quantity          INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  discount_idr      BIGINT NOT NULL DEFAULT 0 CHECK (discount_idr >= 0),
  line_total_idr    BIGINT NOT NULL CHECK (line_total_idr >= 0),
  returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0)
);

CREATE TABLE order_events (                 -- append-only timeline
  id           UUID PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  from_status  order_status,
  to_status    order_status NOT NULL,
  actor_id     UUID,
  reason       TEXT NOT NULL,
  visibility   TEXT NOT NULL CHECK (visibility IN ('customer','internal')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_attempts (
  id           UUID PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  amount_idr   BIGINT NOT NULL CHECK (amount_idr >= 0),
  currency     CHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency = 'IDR'),
  status       payment_attempt_status NOT NULL DEFAULT 'created',
  provider_ref TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_webhook_events (
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)            -- deduplikasi webhook (blueprint 6.3)
);

CREATE TABLE payment_exceptions (
  id           UUID PRIMARY KEY,
  kind         TEXT NOT NULL,
  order_number TEXT REFERENCES orders(order_number),
  detail       TEXT NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id           UUID PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  amount_idr   BIGINT NOT NULL CHECK (amount_idr > 0),
  reason       TEXT NOT NULL,
  status       refund_status NOT NULL DEFAULT 'requested',
  requested_by UUID NOT NULL,
  approved_by  UUID,
  provider_ref TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT refund_maker_checker CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE TABLE return_cases (
  id           UUID PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES orders(order_number),
  items        JSONB NOT NULL,
  reason       TEXT NOT NULL,
  status       return_status NOT NULL DEFAULT 'requested',
  requested_by TEXT NOT NULL,
  decided_by   UUID,
  received_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (                   -- append-only
  id         UUID PRIMARY KEY,
  actor_id   UUID,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security: akses langsung dari klien wajib dibatasi per pemilik.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Policy hanya dibuat jika schema auth tersedia (Supabase). Di Postgres biasa, akses hanya lewat server.
DO $$
BEGIN
  IF to_regnamespace('auth') IS NOT NULL THEN
    CREATE POLICY orders_owner_select ON orders FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

COMMIT;
