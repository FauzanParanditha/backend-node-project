# Panduan Integrasi Pembayaran — Payhub (PANDI)

Dokumen untuk merchant/client yang berintegrasi dengan Payment Aggregator (Payhub):
**QRIS** dan **Virtual Account SNAP**, termasuk pengaturan **masa berlaku (expiry)**,
**update**, dan **pembatalan**.

> Ringkas: saat ini yang didukung adalah **QRIS** dan **VA SNAP single‑use**.
> Masa berlaku diatur lewat `expire` (menit). VA multiple/static belum tersedia.

---

## 1. Base URL

| Environment | Base URL |
|---|---|
| Production | `https://api.payhub.pandi.id` |
| Development | `https://dev.api.pg.pandi.id` |

Semua endpoint di bawah relatif terhadap base URL (contoh: `POST {BASE_URL}/api/v1/order/create/qris`).

---

## 2. Autentikasi (tanda tangan / signature)

Setiap request **wajib** menyertakan header berikut:

| Header | Wajib | Keterangan |
|---|---|---|
| `Content-Type` | ya | `application/json` |
| `x-partner-id` | ya | **clientId** merchant Anda |
| `x-timestamp` | ya | Waktu request, ISO‑8601 WIB, contoh `2026-07-20T15:04:05.000+07:00`. **Maksimal 5 menit** dari waktu server; lebih dari itu ditolak. |
| `x-signature` | ya | Tanda tangan RSA‑SHA256 (base64) — lihat di bawah |

### Cara membuat `x-signature`
1. Susun **string** berikut:
   ```
   {METHOD}:{PATH}:{SHA256_HEX_LOWERCASE(minifiedBody)}:{x-timestamp}
   ```
   - `METHOD` = `POST` / `DELETE` (huruf besar)
   - `PATH` = path endpoint, mis. `/api/v1/order/create/qris`
   - `minifiedBody` = body JSON **tanpa spasi/enter** (untuk `DELETE` tanpa body, pakai `{}`)
   - `SHA256_HEX_LOWERCASE` = hash SHA‑256 dari minifiedBody, hex huruf kecil
2. **Tandatangani** string tsb dengan **private key RSA** Anda (algoritma RSA‑SHA256), lalu **encode base64** → itulah `x-signature`.
3. PANDI memverifikasi dengan **public key** Anda yang sudah didaftarkan.

> Penting: `minifiedBody` yang di‑hash **harus identik** dengan body yang dikirim. Beda 1 karakter → signature invalid (401).

---

## 3. Field request umum (semua metode)

```json
{
  "items": [
    { "id": "P001", "name": "Nama Produk", "price": "10000", "type": "domain", "quantity": 1 }
  ],
  "totalAmount": "10000",
  "phoneNumber": "081234567890",
  "paymentMethod": "paylabs",
  "paymentType": "QRIS",
  "expire": 60,
  "storeId": "SUBMERCHANT01"
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `items[]` | array | ya | Rincian produk. `price × quantity` **harus sama** dengan `totalAmount`. |
| `items[].id` | string | ya | ID produk |
| `items[].name` | string (≤32) | ya | Nama produk |
| `items[].price` | string | ya | Harga satuan (Rupiah) |
| `items[].type` | string (≤20) | ya | Tipe produk |
| `items[].quantity` | number ≥1 | ya | Jumlah |
| `totalAmount` | string | ya | Total = Σ(price × quantity) |
| `phoneNumber` | string | ya | No. HP pembayar |
| `paymentMethod` | string | ya | `"paylabs"` |
| `paymentType` | string | ya | Lihat tabel per metode |
| `expire` | number | tidak | **Masa berlaku dalam MENIT** (1–1440 / maks 24 jam). Default lihat §7. |
| `storeId` | string | tidak | ID sub‑merchant (opsional) |

---

## 4. QRIS

### Buat QRIS
`POST /api/v1/order/create/qris`

- `paymentType`: **`"QRIS"`**
- `expire`: menit (opsional; default **5 menit** bila tidak dikirim)

**Contoh response (200):**
```json
{
  "success": true,
  "qrCode": "00020101...UBE5...",
  "qrUrl": "https://payer.paylabs.co.id/payer-api/qr?...",
  "paymentExpired": "2026-07-20T12:31:03+07:00",
  "paymentId": "PL-xxxxxxxxxxxxxxxx",
  "totalAmount": "10071.00",
  "totalTransFee": "71.00",
  "orderId": "REG0012026...0001",
  "id": "6a5d..."
}
```
- Tampilkan **`qrUrl`** (gambar QR) atau render **`qrCode`** menjadi QRIS.
- **`paymentExpired`** = waktu kedaluwarsa QR (sesuai `expire`).

---

## 5. Virtual Account (SNAP)

### Buat VA
`POST /api/v1/order/create/va/snap`

- `paymentType`: kode bank VA **single‑use**, mis. `BCAVA`, `MandiriVA`, `BNIVA`, `BRIVA`, `PermataVA`, `CIMBVA`, `BSIVA`, `DanamonVA`, `MaybankVA`, `MuamalatVA`, `SinarmasVA`, `INAVA`, `BNCVA`, `OCBCVA`, `BTNVA`.
- `expire`: menit (opsional; default **1440 menit / 24 jam**).

**Contoh response (200):**
```json
{
  "responseCode": "2002700",
  "responseMessage": "Successful",
  "virtualAccountData": {
    "partnerServiceId": "  010454",
    "customerNo": "20260720...",
    "virtualAccountNo": "1467584246440264",
    "virtualAccountName": "Nama Merchant",
    "trxId": "PL-xxxxxxxxxxxxxxxx",
    "totalAmount": { "value": "10000.00", "currency": "IDR" },
    "virtualAccountTrxType": "C",
    "expiredDate": "2026-07-20T13:44:20+07:00",
    "additionalInfo": { "paymentType": "BCAVA", "storeId": "SUBMERCHANT01" }
  }
}
```
- **`virtualAccountNo`** = nomor VA yang dibayar customer.
- **`expiredDate`** = masa berlaku VA (sesuai `expire`).
- **`trxId`** = ID transaksi (paymentId) untuk pelacakan/update/delete.

> **Catatan penting:** saat ini hanya **VA single‑use** (sekali bayar lalu hangus).
> VA **multiple** (bisa dibayar berkali‑kali) dan **static** (nominal bebas) **belum tersedia** —
> hubungi kami bila dibutuhkan.

---

## 6. Update & Batalkan VA SNAP

### Update VA
`POST /api/v1/order/update/va/snap/{id}` — `{id}` = field **`id`** (atau order id) dari respons create.

**Yang bisa di‑update:**
| Field | Efek |
|---|---|
| `totalAmount` (+ `items` yang cocok) | Mengubah nominal VA |
| `expire` (menit) | **Mengatur ulang** masa berlaku → `expiredDate` baru = **sekarang + expire menit** |

**Perhatian pada RESPONSE update:**
- **`trxId`/`paymentId` BERUBAH** menjadi ID baru — simpan yang terbaru untuk pelacakan.
- **`virtualAccountNo` TETAP sama** (nomor VA tidak berubah).
- **`expiredDate` di‑reset** dari waktu sekarang (bukan menambah dari expiry lama).
- Update **hanya bisa** bila VA **belum kedaluwarsa** (kalau lewat → `408 payment expired`) dan **belum dibayar** (kalau sudah → `409`).

### Batalkan / invalidasi VA
`DELETE /api/v1/order/delete/va/snap/{id}`

- Menonaktifkan VA sebelum kedaluwarsa. Response sukses = `responseCode` diawali `2` (mis. `2003100 Successful`).

---

## 7. Ringkasan masa berlaku (expiry)

| Metode | Bisa atur `expire`? | Satuan | Default bila kosong | Batalkan |
|---|---|---|---|---|
| **QRIS** | ✅ | menit (1–1440) | **5 menit** | cancel tersedia |
| **VA SNAP (single)** | ✅ | menit (1–1440) | **1440 menit (24 jam)** | delete tersedia |
| VA reguler (non‑SNAP) | ❌ | — | default provider | — |

- `expire` **selalu dalam MENIT** untuk semua metode.
- Maksimal **1440 menit (24 jam)**.

---

## 8. Notifikasi pembayaran (callback)

Saat pembayaran berhasil (atau status berubah), Payhub mengirim **notifikasi** ke
**callback URL (notifyUrl)** merchant Anda yang terdaftar.

**Wajib diperhatikan:**
- Endpoint callback Anda **harus aktif & mengembalikan 2xx**. Bila balas 5xx/timeout,
  notifikasi dianggap gagal (akan di‑retry) — status di sisi Anda bisa tertunda.
- Selalu **verifikasi ulang** status via endpoint status (di bawah), jangan hanya
  mengandalkan callback.

### Cek status
| Metode | Endpoint |
|---|---|
| QRIS | `GET /api/v1/order/status/qris/{id}` |
| VA SNAP | `GET /api/v1/order/status/va/snap/{id}` |

---

## 9. Biaya (fee) & pajak (VAT)

Pada response terdapat rincian:
- `transFeeAmount` / `totalTransFee` — biaya layanan.
- `vatFee` — PPN atas biaya layanan (terpisah, **tidak** termasuk dalam `totalTransFee`).
- `amount` yang dikembalikan bisa = **produk + biaya layanan** (tergantung skema fee).

Rincian ini disimpan per order untuk rekonsiliasi.

---

## 10. Kode status & error umum

| HTTP | Arti |
|---|---|
| 200 | Sukses |
| 400 | Body/validasi salah (mis. `Total Amount is not match`, `Unsupported payment type`) |
| 401 | Signature/timestamp tidak valid (cek §2; timestamp maks 5 menit) |
| 403 | Origin/akses ditolak |
| 408 | (Update) VA sudah kedaluwarsa |
| 409 | (Update) VA sudah dibayar |

---

## 11. Batasan saat ini

- **VA**: hanya **single‑use** (BCAVA, MandiriVA, dst.). Multiple/Static belum tersedia.
- **QRIS & VA SNAP**: mendukung `expire` (menit) + pembatalan. VA reguler (non‑SNAP) tidak mendukung pengaturan expiry.
- **`expire`** maksimal 24 jam (1440 menit).

---

*Untuk pendaftaran clientId, public key, dan callback URL, hubungi tim PANDI/Payhub.*
