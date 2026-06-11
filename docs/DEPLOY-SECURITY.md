# Runbook Deploy Keamanan — payment-aggregator (dev)

Acuan untuk merilis perubahan keamanan dari branch `dev` ke cluster.

- **FE** (`payment-aggregator-frontend` / `dashboard-node`) → `dev.dashboard.pg.pandi.id`
- **BE** (`payment-aggregator-backend` / `backend-node-project`) → `api-dev-ppnd.pandi.id`
- **Namespace:** `dev` · **Deployment:** `d-payhub-fe`, `d-payhub-be`

> Manifest FE ada di repo frontend (`deploy/d-pa-fe.yml`), manifest BE ada di
> repo backend (`deploy/d-pa-be.yml`). Jalankan dari checkout yang memuat
> manifest yang relevan, atau sesuaikan path `-f`.

## Konteks perubahan

Enkripsi payment link kini dibaca **runtime** dari `process.env` di server
(bukan lagi di-inline ke bundle JS client). Karena itu cluster **wajib**
menyuplai `ENCRYPTION_KEY` / `HMAC_KEY`. Kedua kunci ini **dibagi dan harus
identik** antara FE dan BE: BE meng-encrypt order data ke dalam payment link,
FE men-decrypt-nya. Jika nilainya beda, payment link gagal di-decrypt.

## Pembagian tugas
- **DevOps:** generate kunci, buat Secret, apply manifest, roll, hapus ConfigMap lama, cek kesehatan pod.
- **Programmer/QA:** tes fungsional alur payment setelah rollout.

## ⚠️ Aturan urutan (penting)
**Buat Secret DULU, baru roll deployment.** Bila FE di-roll sebelum Secret
`d-payhub-fe-env` ada, pod FE crash (encryption.ts throw karena kunci kosong).

---

## Langkah 0 — Prasyarat
```bash
kubectl config current-context        # pastikan cluster benar
kubectl -n dev get deploy d-payhub-fe d-payhub-be
# Pastikan image baru sudah ter-build dari branch dev (cek tag/registry).
```
Nilai non-kunci (`PARTNER_ID`, `SERVER_API_URL`, `PRIVATE_KEY`) diambil dari
konfigurasi/secret manager yang sudah ada. **Hanya `ENCRYPTION_KEY`/`HMAC_KEY`
yang di-generate baru.**

## Langkah 1 — Generate kunci baru (sekali, dipakai FE & BE)
```bash
ENC=$(openssl rand -hex 32)
HMAC=$(openssl rand -hex 32)
# JANGAN echo / kirim nilai ini ke chat/email/tiket.
```

## Langkah 2 — Secret BACKEND (`d-payhub-be-env`)
```bash
# Turunkan .env dari ConfigMap lama
kubectl -n dev get configmap d-payhub-be-env -o jsonpath='{.data.\.env}' > be.env

# Timpa kunci + seeder
sed -i '/^ENCRYPTION_KEY=/d;/^HMAC_KEY=/d;/^SEED_ADMIN_EMAIL=/d;/^SEED_ADMIN_PASSWORD=/d' be.env
{
  echo "ENCRYPTION_KEY=$ENC"
  echo "HMAC_KEY=$HMAC"
  echo "SEED_ADMIN_EMAIL=<email-admin>"
  echo "SEED_ADMIN_PASSWORD=<password-kuat>"
} >> be.env

# Pastikan FRONTEND_URL ada (dipakai untuk bikin payment link)
grep -q '^FRONTEND_URL=' be.env || echo "FRONTEND_URL=https://dev.dashboard.pg.pandi.id" >> be.env

kubectl -n dev create secret generic d-payhub-be-env \
  --from-file=.env=./be.env --dry-run=client -o yaml | kubectl apply -f -
```

## Langkah 3 — Secret FRONTEND (`d-payhub-fe-env`) — kunci NILAI SAMA
```bash
kubectl -n dev create secret generic d-payhub-fe-env \
  --from-literal=ENCRYPTION_KEY="$ENC" \
  --from-literal=HMAC_KEY="$HMAC" \
  --from-literal=PARTNER_ID='<value>' \
  --from-literal=SERVER_API_URL='<value>' \
  --from-file=PRIVATE_KEY=./private-key.pem \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Langkah 4 — Apply manifest & roll (BE & FE berdekatan)
```bash
kubectl -n dev apply -f deploy/d-pa-be.yml
kubectl -n dev apply -f deploy/d-pa-fe.yml
kubectl -n dev rollout restart deploy/d-payhub-be deploy/d-payhub-fe
kubectl -n dev rollout status deploy/d-payhub-be --timeout=120s
kubectl -n dev rollout status deploy/d-payhub-fe --timeout=120s
```

## Langkah 5 — Verifikasi
```bash
kubectl -n dev get pods -l app=d-payhub-be
kubectl -n dev get pods -l app=d-payhub-fe
kubectl -n dev exec deploy/d-payhub-fe -- printenv ENCRYPTION_KEY      # harus terisi
kubectl -n dev exec deploy/d-payhub-be -- sh -c 'grep -c ENCRYPTION_KEY /app/.env'

# Endpoint enkripsi server FE hidup
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://dev.dashboard.pg.pandi.id/api/encrypt \
  -H 'Content-Type: application/json' -d '{"ping":1}'                  # harap 200

kubectl -n dev logs deploy/d-payhub-be --tail=50 | grep -iE 'error|ENCRYPTION_KEY'
kubectl -n dev logs deploy/d-payhub-fe --tail=50 | grep -iE 'error|ENCRYPTION_KEY'
```
Lalu programmer/QA tes alur payment: create order → `/payment` → process →
bayar (sandbox) → `/payment/success` → cancel. Semua mulus = lolos.

### Verifikasi BE auth-hardening (opsional)
```bash
# Rate limit: percobaan login ke-6 dalam 10 menit dari IP sama harus 429
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    https://api-dev-ppnd.pandi.id/api/v1/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"x@x.id","password":"salah"}'
done
```

## Langkah 6 — Bersih-bersih (setelah verifikasi OK)
```bash
kubectl -n dev delete configmap d-payhub-be-env
shred -u be.env
unset ENC HMAC
```

## Rollback (bila gagal)
```bash
kubectl -n dev rollout undo deploy/d-payhub-fe
kubectl -n dev rollout undo deploy/d-payhub-be
# Secret & ConfigMap lama jangan dihapus sampai rollout baru terbukti sehat.
```

## Catatan penting
- `ENCRYPTION_KEY`/`HMAC_KEY` **wajib identik** di kedua Secret.
- Payment link `?q=` lama (kunci lama) jadi invalid setelah rotate — wajar; lakukan saat trafik rendah.
- `NEXT_PUBLIC_*` di FE adalah **build-time** (di-inject CI saat build image), **bukan** dari Secret runtime ini.
- Secret k8s default hanya base64 (bukan enkripsi). Pertimbangkan encryption-at-rest / sealed-secrets / Vault untuk hardening.
- Kunci handoff: jangan lewat chat/email/tiket. Idealnya DevOps generate & apply langsung; bila programmer yang generate, lewat secret manager.
- Ini untuk **dev**. Untuk **prod**: generate **kunci berbeda** dengan proses sama; jangan pakai kunci dev di prod.
