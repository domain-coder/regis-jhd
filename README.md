# JHD26 — Sistem Registrasi & Absensi

Aplikasi web sederhana untuk registrasi peserta, absensi via scan QR, dan administrasi
event JHD26. Dibangun khusus untuk event ini (single-event, bukan multi-tenant).
Lihat `master-prompt.txt` dan PRD terkait untuk detail requirement lengkap,
`WORKFLOW.md` untuk alur proses bisnis (registrasi, absensi, pelaporan), dan
`CHANGELOG.md` untuk riwayat aktivitas pengembangan & operasional server.

## Tech Stack

- Node.js + Express.js
- SQLite (`better-sqlite3`) — satu file database, tanpa server DB terpisah
- EJS (server-rendered) + vanilla JS pada halaman scan
- `qrcode` untuk generate QR, `html5-qrcode` (via CDN) untuk scan dari browser HP
- Session-based auth (`express-session`, in-memory store) + `bcrypt`
- PWA installable (web app manifest + service worker ringan) — lihat bagian PWA di bawah

## Instalasi

### 1. Prasyarat: Node.js

Jika `node`/`npm` belum tersedia, install via [nvm](https://github.com/nvm-sh/nvm):

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
```

`better-sqlite3` dan `bcrypt` adalah native module — pastikan `build-essential` dan
`python3` terpasang di server sebelum `npm install` (di Debian/Ubuntu:
`sudo apt-get install -y build-essential python3`).

### 2. Install dependencies

```bash
npm install
```

### 3. Konfigurasi environment

```bash
cp .env.example .env
```

Edit `.env` dan isi:
- `SESSION_SECRET` — string acak panjang (mis. `openssl rand -hex 32`)
- `HERMES_API_KEY` — API key acak untuk autentikasi Hermes (mis. `openssl rand -hex 24`)
- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` — akun super_admin pertama (**wajib diganti** setelah instalasi awal)

### 4. Migrasi & seed data

```bash
npm run migrate   # membuat skema tabel
npm run seed       # insert event JHD26, ruangan R1/R2/R3, user super_admin default
```

Migration & seed aman dijalankan ulang (idempotent) — baris yang sudah ada tidak akan diduplikasi.

### 5. Jalankan aplikasi

```bash
npm run dev    # development, auto-restart saat file berubah
npm start      # production
```

Buka `http://localhost:3000` — akan redirect ke form registrasi publik (`/register`).
Login admin di `/login` menggunakan kredensial dari `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`.

**Segera setelah instalasi pertama:** login sebagai super_admin → buka menu **User** →
ganti password akun default, atau buat akun super_admin baru dan nonaktifkan yang default.

### Reset database (opsional, untuk testing)

```bash
rm -f data/jhd26.sqlite data/jhd26.sqlite-wal data/jhd26.sqlite-shm
npm run migrate && npm run seed
```

## PWA (Installable ke Home Screen)

Aplikasi ini mendukung "Add to Home Screen" di HP (Android/iOS) lewat web app
manifest (`src/public/manifest.webmanifest`) dan service worker ringan
(`src/public/sw.js`). Ini **bukan** PWA offline-first — service worker hanya
meng-cache asset statis (CSS, ikon), semua halaman/form/API tetap butuh koneksi
internet aktif (sesuai asumsi PRD Bagian 4.2).

**Penting — butuh HTTPS:** browser (Chrome/Safari) hanya mengizinkan registrasi
service worker & prompt instalasi di atas HTTPS, kecuali di `localhost`. Selama
testing lewat IP LAN biasa (`http://192.168.x.x:3000`), tombol "Install app"
tidak akan muncul di HP — ini normal, bukan bug. Agar benar-benar installable
dari HP peserta/panitia, deploy dulu di belakang Nginx + TLS (mis. via
`certbot`), lihat `deploy/nginx.conf.example`.

Ikon aplikasi ada di `src/public/icons/` (di-generate dari `icon.svg` /
`icon-maskable.svg` via ImageMagick — edit SVG lalu render ulang jika ingin
mengganti branding: `convert -background none icon.svg -resize 512x512 icon-512.png`).

## Alur Utama

1. **Registrasi**: peserta mengisi form di `/register`, pilih 1+ sesi (kapasitas
   divalidasi real-time terhadap kapasitas ruangan). Setelah sukses, halaman
   konfirmasi menampilkan QR code langsung (fallback jika Hermes belum sempat kirim WA).
2. **Distribusi QR via Hermes**: Hermes memanggil `GET /api/hermes/queue` secara
   berkala untuk mengambil data peserta berstatus `pending`, mengirim WA sendiri,
   lalu melapor via `POST /api/hermes/callback`.
3. **Absensi**: petugas login → buka `/absensi/scan` → pilih sesi aktif → scan QR
   peserta dari kamera HP (atau cari manual untuk walk-in).
4. **Laporan**: admin melihat rekap pendaftar/kehadiran per sesi dan per peserta di
   `/admin/laporan`, dapat diekspor ke CSV.

## Role & Akses

| Role | Akses |
|---|---|
| `super_admin` | Semua modul, termasuk manajemen user |
| `admin_event` | Event, ruangan, sesi, peserta, laporan, absensi (tanpa manajemen user) |
| `petugas` | Halaman scan/absensi saja |

## Integrasi Hermes (untuk diteruskan ke tim Hermes)

Autentikasi: header `X-API-Key: <HERMES_API_KEY dari .env>` pada setiap request.

### `GET /api/hermes/queue`

Mengembalikan daftar peserta dengan status pengiriman QR = `pending`.

```json
{
  "data": [
    {
      "peserta_id": 12,
      "nama": "Budi Santoso",
      "no_hp": "6281234567890",
      "sesi": [
        { "nama": "Sesi Pembukaan", "waktu_mulai": "2026-08-10T08:00:00", "ruangan": "R1" }
      ],
      "qr_token": "a1b2c3d4-...",
      "qr_image_base64": "data:image/png;base64,...."
    }
  ]
}
```

- `no_hp` sudah dinormalisasi ke format `62xxxxxxxxxx` (tanpa `+`, tanpa `0` di depan).
- `qr_image_base64` digenerate on-the-fly per request (tidak disimpan di disk).

### `POST /api/hermes/callback`

Body:
```json
{ "peserta_id": 12, "status": "sent", "keterangan": "opsional, mis. pesan error" }
```

`status` harus `sent` atau `failed`. Field/skema ini adalah **asumsi awal** —
kontrak persis dengan Hermes belum final, silakan koordinasikan perubahan jika perlu.

## Deployment

Contoh konfigurasi tersedia sebagai referensi (tidak dijalankan otomatis):

- `ecosystem.config.js` — jalankan dengan `pm2 start ecosystem.config.js`
- `deploy/nginx.conf.example` — reverse proxy dasar

## Catatan Teknis

- **Session store**: in-memory (bawaan `express-session`), bukan `connect-sqlite3`.
  Ini pilihan yang cukup untuk skala event ini (1-3 admin/panitia, ~200 peserta,
  2 hari) — sesi login akan hilang jika proses Node di-restart, yang dapat diterima
  untuk skala ini. Jika ke depan butuh persistensi sesi lintas restart, ganti ke
  session store berbasis file/DB.
- **Validasi kapasitas sesi**: menggunakan transaksi `BEGIN IMMEDIATE`
  (`db.transaction(...).immediate()` di better-sqlite3) untuk mencegah overbooking
  saat beberapa peserta mendaftar bersamaan ke sesi yang hampir penuh.
- **QR code**: tidak pernah disimpan sebagai file — selalu digenerate on-the-fly
  dari `qr_token` (UUID v4), baik di halaman konfirmasi maupun endpoint Hermes.
- **npm audit**: beberapa advisory pada dependency `tar` (transitif dari
  `node-gyp`/`node-pre-gyp`, dipakai saat compile native module `bcrypt`/
  `better-sqlite3`) tidak dapat di-fix tanpa downgrade breaking. Advisory ini
  hanya relevan saat `npm install`, bukan pada kode yang berjalan di runtime.
