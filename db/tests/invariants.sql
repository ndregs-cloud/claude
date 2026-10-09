-- Tes invarian skema (blueprint 6, 7, 12). Jalankan setelah migrasi 0001 pada database kosong.
-- Setiap blok harus GAGAL dengan constraint yang diharapkan; jika tidak, skrip berhenti dengan error.
BEGIN;

INSERT INTO categories (slug, name) VALUES ('fashion', 'Fashion');
INSERT INTO products (id, slug, name, brand, category_slug, base_price_idr, status)
  VALUES ('00000000-0000-0000-0000-000000000001', 'uji', 'Uji', 'NOVA', 'fashion', 100000, 'active');
INSERT INTO product_variants (sku, product_id, label) VALUES ('UJI-1', '00000000-0000-0000-0000-000000000001', 'Satu');
INSERT INTO inventory_balances (sku, on_hand, reserved) VALUES ('UJI-1', 5, 0);
INSERT INTO users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000000a1', 'a@uji.id', 'A', 'customer');
INSERT INTO users (id, email, name, role) VALUES ('00000000-0000-0000-0000-0000000000b2', 'b@uji.id', 'B', 'finance');

INSERT INTO orders (id, order_number, contact_name, contact_email, contact_phone, shipping_address,
  shipping_service_id, shipping_service_name, shipping_estimate, subtotal_idr, discount_idr, shipping_idr, tax_idr, total_idr,
  idempotency_key)
VALUES ('00000000-0000-0000-0000-0000000000c3', 'NS-20261010-AAAAAA', 'A', 'a@uji.id', '+6281200000000', '{}',
  'reguler', 'Reguler', '1-2 hari', 100000, 0, 15000, 0, 115000, 'key-uji-0001');

INSERT INTO payment_attempts (id, order_number, amount_idr, provider_ref)
  VALUES ('00000000-0000-0000-0000-0000000000d4', 'NS-20261010-AAAAAA', 115000, 'mock_pay_1');

-- 1. Total harus sama dengan komponennya
DO $$ BEGIN
  INSERT INTO orders (id, order_number, contact_name, contact_email, contact_phone, shipping_address,
    shipping_service_id, shipping_service_name, shipping_estimate, subtotal_idr, discount_idr, shipping_idr, tax_idr, total_idr, idempotency_key)
  VALUES (gen_random_uuid(), 'NS-20261010-BBBBBB', 'A', 'a@uji.id', '+6281200000000', '{}', 'reguler', 'R', 'x', 100000, 0, 15000, 0, 999999, 'k2');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: total tidak sesuai';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK total tidak sesuai ditolak'; END $$;

-- 2. Dua pesanan tidak boleh memakai idempotency key yang sama oleh pengguna yang sama
DO $$ BEGIN
  INSERT INTO orders (id, order_number, user_id, contact_name, contact_email, contact_phone, shipping_address,
    shipping_service_id, shipping_service_name, shipping_estimate, subtotal_idr, discount_idr, shipping_idr, tax_idr, total_idr, idempotency_key)
  VALUES (gen_random_uuid(), 'NS-20261010-CCCCCC', '00000000-0000-0000-0000-0000000000a1', 'A', 'a@uji.id', '+6281200000000', '{}', 'r', 'R', 'x', 1, 0, 0, 0, 1, 'dup');
  INSERT INTO orders (id, order_number, user_id, contact_name, contact_email, contact_phone, shipping_address,
    shipping_service_id, shipping_service_name, shipping_estimate, subtotal_idr, discount_idr, shipping_idr, tax_idr, total_idr, idempotency_key)
  VALUES (gen_random_uuid(), 'NS-20261010-DDDDDD', '00000000-0000-0000-0000-0000000000a1', 'A', 'a@uji.id', '+6281200000000', '{}', 'r', 'R', 'x', 1, 0, 0, 0, 1, 'dup');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: idempotency';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK idempotensi terjaga'; END $$;

-- 3. Reservasi tidak boleh melebihi stok fisik
DO $$ BEGIN
  UPDATE inventory_balances SET reserved = 6 WHERE sku = 'UJI-1';
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: reserved > on_hand';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK reservasi > fisik ditolak'; END $$;

-- 4. Webhook duplikat (provider, event_id) ditolak
DO $$ BEGIN
  INSERT INTO payment_webhook_events (provider, event_id, event_type, outcome) VALUES ('mock', 'evt-1', 'payment.succeeded', 'processed');
  INSERT INTO payment_webhook_events (provider, event_id, event_type, outcome) VALUES ('mock', 'evt-1', 'payment.succeeded', 'processed');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: webhook duplikat';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK webhook duplikat ditolak'; END $$;

-- 5. Provider ref attempt harus unik
DO $$ BEGIN
  INSERT INTO payment_attempts (id, order_number, amount_idr, provider_ref) VALUES (gen_random_uuid(), 'NS-20261010-AAAAAA', 1, 'mock_pay_1');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: provider_ref';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK provider_ref unik'; END $$;

-- 6. Maker-checker: approver tidak boleh sama dengan pengaju
DO $$ BEGIN
  INSERT INTO refunds (id, order_number, amount_idr, reason, status, requested_by, approved_by)
  VALUES (gen_random_uuid(), 'NS-20261010-AAAAAA', 1000, 'uji', 'approved', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: maker-checker';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK maker-checker dijaga'; END $$;

-- 7. Jumlah per baris pesanan 1..10
DO $$ BEGIN
  INSERT INTO order_lines (id, order_number, sku, product_name, variant_label, unit_price_idr, quantity, line_total_idr)
  VALUES (gen_random_uuid(), 'NS-20261010-AAAAAA', 'UJI-1', 'Uji', 'Satu', 100000, 11, 1100000);
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: quantity';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK quantity > 10 ditolak'; END $$;

-- 8. Mata uang selain IDR ditolak
DO $$ BEGIN
  INSERT INTO payment_attempts (id, order_number, amount_idr, currency, provider_ref) VALUES (gen_random_uuid(), 'NS-20261010-AAAAAA', 1, 'USD', 'mock_usd');
  RAISE EXCEPTION 'TIDAK_TERDETEKSI: currency';
EXCEPTION WHEN check_violation OR string_data_right_truncation OR invalid_text_representation THEN RAISE NOTICE 'OK mata uang non-IDR tidak tersimpan'; END $$;

ROLLBACK;
\echo SEMUA INVARIAN TERVERIFIKASI
