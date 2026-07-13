# Payhub On-Call Runbook

Panduan cepat untuk menangani insiden umum pada Payment Aggregator (Payhub)
saat pemilik utama tidak tersedia. Fokus: **diagnosa mandiri** tanpa harus
menunggu engineer inti.

- Backend (BE) repo: `payment-aggregator-backend` (Node/Express + MongoDB)
- Frontend (FE) repo: `payment-aggregator-frontend` (Next.js)
- Provider pembayaran: **Paylabs**
- Namespace k8s: `dev` dan `prod`
- Deployment: BE `d-payhub-be`, FE `d-payhub-fe`

## 0. Cek kesehatan cepat (mulai dari sini)

```bash
# Ganti d-payhub-be / namespace sesuai environment (dev|prod)
kubectl -n prod get pods -l app=d-payhub-be
kubectl -n prod exec deploy/d-payhub-be -- wget -qO- localhost:$PORT/healthz ; echo
```

Endpoint `/healthz` (juga `/readyz`) mengembalikan:

```json
{ "status": "ok|degraded", "db": "up|down",
  "config": { "envOk": true, "keysOk": true, "checkedAt": "..." },
  "uptimeSeconds": 123 }
```

- `status: degraded` + `keysOk: false` → key Paylabs rusak/hilang (lihat §2).
- `status: degraded` + `db: down` → MongoDB tidak tersambung.
- `envOk: false` → env wajib hilang; pod seharusnya **tidak start** (lihat §3).

## Channel alert Discord

Env webhook (di Secret/ConfigMap BE): `DISCORD_WEBHOOK_URL_API_ERROR` (error
partner/Paylabs), `_SECURITY` (serangan/IP block), `_AUTH`, `_ERROR`,
`_REPORT`, `_REVENUE`. Cek channel API_ERROR lebih dulu saat ada keluhan bayar.

---

## 1. Merchant: "Failed to process payment, please try again"

**Gejala:** customer memilih QRIS/VA, klik bayar, muncul toast generik.

**Diagnosa:**
1. Buka DevTools browser → tab **XHR/Network**, klik Process Payment.
   - **Tidak ada** request `order/create/*` → error di FE sebelum kirim.
     Cek **Console**: `Payment config missing: NEXT_PUBLIC_SECRET_KEY set? false`
     → build FE tidak membawa secret (lihat fix di bawah).
   - **Ada** request tapi 4xx/5xx → lanjut cek log BE.
2. Log BE:
   ```bash
   kubectl -n dev logs deploy/d-payhub-be --since=30m | \
     grep -iE "Error in createVa|createQris|Paylabs error|Total Amount|Unsupported|va/create|qris/create"
   ```

**Penyebab & fix:**
- `NEXT_PUBLIC_SECRET_KEY set? false` → CI variable `devNEXT_PUBLIC_SECRET_KEY`
  (atau `prod...`) belum ada / build FE lama. Set variable di GitLab
  (Settings → CI/CD → Variables), nilai **sama dengan `SECRET_KEY` BE** env yang
  sama, lalu re-run pipeline `build-*-fe`. Sejak hardening, build FE **gagal**
  bila secret kosong — jadi ini tidak bisa lolos diam-diam lagi.
- `Total Amount is not match` → data item vs totalAmount dari merchant tidak
  cocok. Masalah payload merchant, bukan sistem.
- `error: <kode>` dari Paylabs → mapping kode di dashboard Paylabs; cek channel
  Discord API_ERROR untuk detail.

---

## 2. Callback Paylabs 500 / `DECODER routines::unsupported` / key rusak

**Gejala:** webhook Paylabs balas 500; `/healthz` `keysOk: false`; log:
`Failed to read public key` atau `does NOT parse as a valid ... key`.

**Akar umum:** file PEM (`private-key.pem` / `public.pem`) kehilangan baris
`-----BEGIN/END-----` atau newline saat dipindah (base64 ter-flatten). Cek:

```bash
kubectl -n prod exec deploy/d-payhub-be -- sh -c 'wc -l /app/public.pem /app/private-key.pem'
# PEM valid biasanya banyak baris; kalau cuma 1-3 baris → curiga rusak
```

**Fix (JANGAN paste PEM ke YAML — newline hilang):**
```bash
# Muat ulang dari file asli yang utuh, lewat Secret --from-file lalu mount,
# atau kalau lewat PVC, cp file utuh ke path /app:
kubectl -n prod cp ./public.pem d-payhub-be-XXXX:/app/public.pem
# Pastikan parse OK:
kubectl -n prod exec deploy/d-payhub-be -- node -e \
  'require("crypto").createPublicKey(require("fs").readFileSync("public.pem","utf8"));console.log("PARSE OK")'
```
Key ada di **root `/app`**, bukan subfolder. Setelah benar, `/healthz` → `keysOk: true`.

---

## 3. Pod BE tidak mau start / crash-loop

**Gejala:** pod `CrashLoopBackOff`; log memuat `[startup-check] FATAL`.

Ini **disengaja** — aplikasi menolak start bila env wajib hilang atau key tidak
parse, agar tidak melayani 500 senyap. Baca daftar masalahnya:

```bash
kubectl -n prod logs deploy/d-payhub-be --previous | grep "\[startup-check\]"
```

Perbaiki item yang disebut (env hilang di Secret/ConfigMap, atau key rusak §2),
lalu rollout ulang. Env wajib: `MONGODB_URI, SECRET_KEY,
ACCESS_TOKEN_PRIVATE_KEY, ACCESS_TOKEN_ADMIN_PRIVATE_KEY, HMAC_VERIFICATION_CODE,
PAYLABS_API_URL, PAYLABS_MERCHANT_ID, NOTIFY_URL, FRONTEND_URL`.

---

## 4. Order sudah dibayar tapi berstatus expired

**Gejala:** merchant klaim sudah bayar, order `expired`.

- Sejak perbaikan, callback `02`/`00` (paid) yang datang setelah expiry akan
  tetap menandai **paid** dengan flag `paymentActions.correctedFromExpired`.
- Kalau ada order lama yang terlanjur salah: verifikasi status SUCCESS di
  dashboard Paylabs, lalu koreksi manual status order → `paid`, dan beri tahu
  merchant. Cari lewat CallbackLog (`status:"error"`) + `paymentId`.

---

## 5. Serangan / IP diblokir / login gagal beruntun

- IP auto-block berbasis skor (channel Discord SECURITY). Lihat & kelola di
  dashboard menu **Blocked IP** (ada search by IP).
- Akun terkunci setelah gagal login berulang (15 menit → 1 jam → permanen).
- Blokir/lockout **fail-open** pada error internal (tidak memblokir trafik sah
  bila sistem block bermasalah).

---

## Perintah yang sering dipakai

```bash
# Log terbaru
kubectl -n <ns> logs deploy/d-payhub-be --since=1h --tail=200
# Status rollout & image aktif
kubectl -n <ns> rollout status deploy/d-payhub-fe
kubectl -n <ns> get pod -l app=d-payhub-fe -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}'
# Restart (rolling)
kubectl -n <ns> rollout restart deploy/d-payhub-be
```

Pipeline (GitLab): branch `dev` → build+deploy dev otomatis; `main`/tag → prod.
NEXT_PUBLIC_* di FE di-bake saat build via `--build-arg` (nilai dari CI/CD
Variables `dev*` / `prod*`).

---

## Eskalasi

Bila `/healthz` sehat tapi transaksi tetap gagal, atau menyangkut dana/rekonsiliasi,
kumpulkan: paymentId/orderId, waktu, screenshot error, potongan log terkait, lalu
eskalasi ke engineer inti / PIC Paylabs. Jangan melakukan koreksi status dana
tanpa verifikasi SUCCESS di sisi Paylabs.
