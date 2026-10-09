# NOVA STORE – E-commerce B2C (ndre.gstore)

Toko online single-merchant untuk pasar Indonesia (IDR, id-ID). Nama brand NOVA STORE adalah placeholder.

- Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Vitest.
- Sumber kebutuhan: `Blueprint_Ecommerce_Enterprise.pdf` (bisnis & teknis) dan `design_e_commercial_nya.pdf` (UI/UX).
- Skema database: `db/migrations/0001_init.sql` (PostgreSQL/Supabase-ready; belum diuji terhadap Postgres).

## Status

Fitur yang berjalan dengan adapter mock: katalog, pencarian, filter & sort, detail produk dengan varian, keranjang, checkout tamu & akun, pesanan & pelacakan, retur, refund dengan maker-checker, webhook pembayaran (dedup & verifikasi nominal), admin dashboard, pesanan, inventaris (ledger), dan produk (read-only).

Storage in-memory dan sesi in-memory. Pembayaran dan pengiriman adalah simulasi; belum ada kredensial penyedia.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest
npm run typecheck
npm run lint
npm run build
```

Akun demo (hanya non-production): `pelanggan@contoh.id`, `operator@contoh.id`, `gudang@contoh.id`, `finance@contoh.id`, `manajer@contoh.id`, `admin@contoh.id`. Kata sandi diambil dari `NG_DEMO_PASSWORD` atau dibuat acak per proses dan dicetak ke log development.

## Variabel lingkungan

Lihat `.env.example`. Secret tidak boleh masuk repository.

- `PAYMENT_WEBHOOK_SECRET`: secret verifikasi tanda tangan webhook. Tanpa ini endpoint menolak semua permintaan (503).
- `NG_DEMO_PASSWORD` (opsional): kata sandi akun demo non-production.

## Belum production-ready

Lihat daftar lengkap di laporan pengerjaan. Ringkasnya: integrasi Postgres/Supabase, penyedia pembayaran & kurir sungguhan, keputusan PPN, verifikasi legal (PSE/PMSE/PDP), audit aksesibilitas, dan uji visual.
