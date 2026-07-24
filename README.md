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
- `@whiskeysockets/baileys` untuk kirim QR via WhatsApp langsung dari aplikasi
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
- `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` — akun super_admin pertama (**wajib diganti** setelah instalasi awal)
- `WA_PHONE_NUMBER` — nomor WA untuk pairing pertama kali (lihat bagian
  **Pengiriman WhatsApp** di bawah); boleh dikosongkan dulu kalau belum siap pairing

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
   konfirmasi menampilkan QR code langsung (fallback jika WA belum sempat terkirim).
2. **Distribusi QR via WhatsApp**: begitu registrasi sukses, sistem langsung mengirim
   QR via WhatsApp (Baileys) secara asinkron — tidak menunda/menggagalkan registrasi
   kalau pengiriman WA lambat/gagal. Ada sweep berkala sebagai jaring pengaman untuk
   peserta yang belum terkirim (lihat bagian **Pengiriman WhatsApp** di bawah).
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

## Pengiriman WhatsApp (Baileys)

QR code dikirim ke peserta via WhatsApp menggunakan
[Baileys](https://github.com/WhiskeySockets/Baileys) — dijalankan langsung di
dalam proses aplikasi ini (`src/services/whatsapp.js` + `src/services/pengirimanWa.js`),
bukan sistem/proses terpisah.

**Cara kerja:**
1. Begitu registrasi sukses (dari form publik, tambah manual admin, atau resend),
   sistem langsung mencoba kirim WA saat itu juga (*fire-and-forget* — tidak
   ditunggu, tidak bisa menggagalkan/menunda registrasi).
2. Ada sweep berkala (`WA_POLL_INTERVAL_MS`, default 5 menit) yang memproses ulang
   peserta berstatus `pending` sebagai jaring pengaman — menangkap kasus trigger
   instan gagal (mis. app baru restart) dan hasil impor CSV massal (yang sengaja
   tidak di-trigger satu-satu, supaya tidak ada lonjakan kirim beruntun).
   Interval sengaja tidak terlalu sering — sweep ini untuk *flush* penumpukan
   sekaligus kalau ada kegagalan/keterlambatan, bukan jalur utama pengiriman
   (yang sudah ditangani trigger instan).
3. Ada jeda antar pengiriman (`WA_SEND_DELAY_MS`, default 4 detik) untuk
   mengurangi risiko nomor WA di-flag/dibatasi karena mengirim terlalu cepat.
4. Kalau gagal (WA belum terhubung, nomor tidak valid, dll), status ditandai
   `failed` dengan keterangan error — admin bisa klik **"Kirim Ulang"** di
   `/admin/peserta` untuk mencoba lagi.

### Pembatalan Mandiri via Balasan WA

Setiap pesan QR mencantumkan instruksi: peserta bisa membalas pesan itu kapan
saja kalau merasa tidak pernah mendaftar. Implementasinya di
`src/services/balasanWa.js`, di-trigger dari event `messages.upsert` Baileys
(`src/services/whatsapp.js`):

- Balasan apa pun (tidak ada pengecekan kata kunci) dari nomor yang cocok
  dengan peserta terdaftar → peserta ditandai **nonaktif** (`nonaktif_at`,
  **bukan dihapus**), sistem membalas WA konfirmasi.
- Peserta nonaktif tidak lagi dihitung ke kapasitas sesi (kuota otomatis
  bebas), QR-nya ditolak saat scan, dan tidak muncul di pencarian walk-in.
- Balasan dari nomor yang tidak dikenali diabaikan (tidak ada reply, tidak
  ada perubahan data).
- Admin bisa **reaktivasi** kapan saja dari `/admin/peserta` kalau balasan
  ternyata tidak sengaja — semua kembali normal (kuota, QR, kemampuan absen).
- Admin juga bisa menonaktifkan/reaktivasi manual dari halaman yang sama,
  tanpa perlu menunggu balasan WA peserta.

### Pairing Pertama Kali

Baileys butuh nomor WA yang di-*link* seperti WhatsApp Web (linked device),
lewat **kode pairing** (bukan scan QR — lebih praktis untuk server headless):

1. Isi `WA_PHONE_NUMBER` di `.env` (format `62xxxxxxxxxx`, tanpa `+`).
2. Restart aplikasi (`pm2 restart jhd26-registrasi-absensi`).
3. Setelah beberapa detik, **kode pairing 8 karakter** muncul di log
   (`pm2 logs jhd26-registrasi-absensi`).
4. Di HP nomor tersebut: WhatsApp → **Pengaturan** → **Perangkat Tertaut** →
   **Tautkan dengan nomor telepon** → masukkan kode tersebut.
5. Setelah berhasil, sesi tersimpan di `data/wa-auth/` (gitignored) — tidak perlu
   pairing ulang lagi selama folder itu tidak dihapus dan tidak logout dari HP.
   `WA_PHONE_NUMBER` boleh dikosongkan setelah ini.

### ⚠️ Catatan Baileys

Baileys **bukan API resmi WhatsApp** — meniru protokol WhatsApp Web, tidak
didukung resmi oleh Meta. Untuk skala kecil (~200 pesan/event) risikonya rendah,
tapi tetap perhatikan:
- Jangan turunkan `WA_SEND_DELAY_MS` terlalu rendah untuk volume besar (risiko
  nomor di-flag/restricted).
- Sebaiknya pakai nomor yang memang didedikasikan untuk event ini, bukan nomor
  pribadi utama panitia.
- Kalau WhatsApp di HP melakukan "Hapus semua perangkat tertaut", perlu
  pairing ulang dari awal (hapus `data/wa-auth/`, isi `WA_PHONE_NUMBER` lagi).

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
  dari `qr_token` (UUID v4), baik di halaman konfirmasi maupun saat dikirim WA.
- **npm audit**: beberapa advisory pada dependency `tar` (transitif dari
  `node-gyp`/`node-pre-gyp`, dipakai saat compile native module `bcrypt`/
  `better-sqlite3`) tidak dapat di-fix tanpa downgrade breaking. Advisory ini
  hanya relevan saat `npm install`, bukan pada kode yang berjalan di runtime.
