# Security — Next Steps (pasca-deploy dev)

Checklist lanjutan setelah perubahan keamanan di `dev` ter-deploy & terverifikasi.
Prasyarat: jalankan dulu **`docs/DEPLOY-SECURITY.md`** dan lulus semua verifikasinya.

Legenda: `[BE]` backend repo · `[FE]` frontend repo · `[OPS]` DevOps/infra.

---

## 0. Gerbang prasyarat (harus hijau dulu)
- [ ] `dev` ter-deploy lewat runbook; payment flow, cookie-auth, middleware, seeder, rate-limit semua lolos.
- [ ] `ENCRYPTION_KEY`/`HMAC_KEY` sudah **di-rotate** & identik di Secret FE/BE.
- [ ] `COOKIE_DOMAIN=.pandi.id` terpasang; login set cookie HttpOnly dan token TIDAK ada di localStorage.
- [ ] Password `fauzan@pandi.id` (atau `SEED_ADMIN_EMAIL`) sudah diganti dari nilai seeder.

---

## 1. CSRF protection (prioritas tertinggi berikutnya)
Cookie-auth (#5) membuat request mutating rentan CSRF; `SameSite=Lax` memitigasi
lintas-site tapi tidak lintas-subdomain `pandi.id`. Tambahkan double-submit token.

- [ ] `[BE]` Saat login, set cookie **non-HttpOnly** `csrf_token` (random 32 byte), `SameSite=Lax`, `Domain=.pandi.id`.
- [ ] `[BE]` Middleware CSRF untuk method mutating (POST/PUT/PATCH/DELETE): bandingkan header `X-CSRF-Token` dengan cookie `csrf_token` (constant-time). Tolak 403 bila tak cocok.
- [ ] `[BE]` Kecualikan endpoint server-to-server (webhook Paylabs/Xendit — sudah pakai signature) dari proteksi CSRF.
- [ ] `[FE]` Axios request interceptor: baca cookie `csrf_token`, pasang header `X-CSRF-Token` untuk method mutating.
- [ ] Tes: POST tanpa header → 403; POST dari UI normal → sukses; webhook tetap jalan.
- [ ] Rollout dual-phase bila perlu (log-only dulu) agar tak ada request sah yang 403 mendadak.

## 2. CSP — promote dari Report-Only ke Enforced
Header `Content-Security-Policy-Report-Only` sudah aktif di `next.config`.

- [ ] `[FE]` Kumpulkan pelanggaran dari console DevTools di semua halaman (dashboard, payment, developers, login) selama beberapa hari di dev.
- [ ] `[FE]` Persempit `script-src` (ganti `'unsafe-inline'`/`'unsafe-eval'` dengan **nonce** bila memungkinkan di Pages Router), `connect-src` ke domain API/WS spesifik, `img-src` ke domain gambar nyata.
- [ ] `[FE]` Setelah nol pelanggaran sah, **pindahkan** policy dari `Content-Security-Policy-Report-Only` ke `Content-Security-Policy` (enforce).
- [ ] Tes ulang seluruh halaman (terutama Quill editor & payment) setelah enforce.

## 3. API reference ter-scope klien (fitur)
Integrator eksternal butuh referensi endpoint **klien saja** (tanpa admin/internal).

- [ ] `[BE]` Hasilkan spec OpenAPI **ter-filter** (hanya endpoint client-facing: order, payment, available-payment, dst). Putuskan daftar endpoint bersama produk.
- [ ] `[FE]` Halaman baru di `/dashboard/developers/api-reference` yang render Redoc dari spec ter-scope, behind `developer_docs:read`.
- [ ] Pastikan spec penuh (Swagger mentah) tetap internal-only (sudah dikunci di BE).

## 4. Manajemen Secret (infra)
- [ ] `[OPS]` Evaluasi pindah dari k8s `Secret` (base64) ke **sealed-secrets** atau **Vault** (encryption-at-rest / akses terkontrol).
- [ ] `[OPS]` Aktifkan encryption-at-rest etcd (EncryptionConfiguration) bila belum.

## 5. Rate limit & hardening lain (perlu data)
- [ ] `[BE]` Tinjau limiter global (kini 1000/menit) dengan **metrik trafik nyata**; turunkan bila aman.
- [ ] `[BE]` (opsional) Tinjau apakah perlu memperketat limiter per-endpoint sensitif lain.
- [ ] `[FE]` (opsional, nilai rendah) Kurangi detail model RBAC yang terkirim ke client bila memungkinkan tanpa memecah UI.

## 5b. Dependency audit `[BE]`
- [x] Non-breaking patches diterapkan **dengan npm 10.8.2** (cocok CI) — minimatch
      (HIGH), ajv, brace-expansion, yaml — diverifikasi `npx npm@10.8.2 ci --dry-run`.
- [ ] **Aturan:** selalu jalankan `npm audit fix`/edit lockfile dengan npm versi
      CI (10.x). npm 11 menulis lock yang ditolak `npm ci` npm 10. Pertimbangkan
      standarkan via `packageManager`/`engines` atau naikkan npm CI ke 11.

Sisa yang butuh breaking change & pengujian:
- [ ] `joi` 17 → 18 (advisory: RangeError pada input recursive `link()`). Cek validator (`authValidator`, dll) tak pakai `link()`; upgrade + tes seluruh validasi.
- [ ] `uuid` (via `exceljs`): `audit fix --force` malah **men-downgrade** exceljs 4→3 — jangan. Opsi: tunggu exceljs rilis dengan uuid baru, atau `overrides` uuid (uji kompat). Risiko nyata rendah (vuln hanya saat `buf` di-pass ke uuid v3/v5/v6).
- [ ] (kebersihan) Hapus `yarn.lock` yang stale di BE — deploy pakai `npm ci` (package-lock.json), yarn.lock cuma bikin bingung/drift.

## 6. Pengulangan untuk PRODUCTION
Setelah `dev` terbukti & di-merge ke `master`:
- [ ] `[OPS]` Ulangi seluruh `DEPLOY-SECURITY.md` untuk prod dengan **kunci & COOKIE_DOMAIN prod sendiri** (jangan pakai nilai dev).
- [ ] `[OPS]` Pastikan `NODE_ENV=production` di prod → Swagger mati otomatis.
- [ ] Verifikasi ulang seluruh alur di prod.

---

## Sudah selesai (referensi — jangan diulang)
- P0: enkripsi payload pindah server-side (kunci lepas dari bundle); seeder admin dari env.
- BE: ConfigMap→Secret; auth-hardening (rate-limit login IP+email, anti timing-enumeration, alert Discord teragregasi); `.env.example` lengkap.
- P1: Swagger dikunci (mati di prod + Basic Auth opsional); token → HttpOnly cookie; `middleware.ts` proteksi route; security headers; CSP report-only.
