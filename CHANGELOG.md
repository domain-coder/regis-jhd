# Changelog

Catatan aktivitas pengembangan & operasional sistem JHD26 Registrasi & Absensi.
Untuk detail per-commit, lihat `git log`.

## 2026-07-24 — Pembatalan mandiri via balasan WA

Peserta bisa membalas pesan QR-nya kapan saja untuk membatalkan registrasi
sendiri (mis. salah nomor terdaftar, atau tidak merasa mendaftar) —
dijadikan pengaman tambahan atas permintaan langsung.

- Kolom baru `nonaktif_at`/`catatan_nonaktif` di tabel `peserta` (migrasi
  `003_add_nonaktif.sql`) — **data tidak pernah dihapus**, cuma ditandai.
- `src/services/balasanWa.js` menangani balasan masuk (event
  `messages.upsert` dari Baileys): cocokkan nomor pengirim ke peserta di
  event ini, tandai nonaktif kalau cocok, balas konfirmasi WA. Nomor yang
  tidak dikenali diabaikan sepenuhnya (tidak ada reply, tidak ada perubahan).
- Peserta nonaktif otomatis dikecualikan dari hitungan kapasitas sesi
  (`sesiModel`, `pesertaModel._registerTx`, `laporanModel.rekapSesi`), ditolak
  saat scan QR (`tidak_terdaftar`), dan tidak muncul di pencarian walk-in
  petugas (`pesertaModel.list({ hanyaAktif: true })`) — tapi baris
  `peserta_sesi` tetap utuh untuk audit.
- Admin bisa nonaktifkan/reaktivasi manual dari `/admin/peserta` (badge
  status + tombol), tidak harus menunggu balasan WA peserta.
- Pesan QR yang dikirim sekarang menyertakan instruksi cara membatalkan.

## 2026-07-24 — Perubahan arsitektur: kirim WA langsung (tanpa Hermes)

**Keputusan produk:** integrasi WhatsApp yang semula dirancang model *pull*
lewat sistem eksternal "Hermes" (lihat PRD/master-prompt) diganti total —
sistem ini sekarang mengirim WA langsung, dikelola dari server yang sama.

- Endpoint `GET /api/hermes/queue` dan `POST /api/hermes/callback` **dihapus**
  (bukan lagi bagian dari sistem ini).
- `@whiskeysockets/baileys` (WhatsApp Web multi-device, tidak resmi dari Meta)
  digabung langsung ke proses aplikasi utama (`src/services/whatsapp.js`,
  `src/services/pengirimanWa.js`) — bukan proses/repo terpisah.
- Pola kirim: **trigger instan** (fire-and-forget) begitu registrasi sukses,
  supaya peserta dapat WA dalam hitungan detik, TANPA pernah menunda atau
  menggagalkan proses registrasi (prinsip non-fungsional dari PRD tetap
  dipertahankan meski arsitekturnya berubah). **Sweep berkala** (default tiap
  5 menit — sengaja tidak sering, karena hanya jaring pengaman untuk *flush*
  penumpukan sekaligus, bukan jalur utama) jadi jaring pengaman untuk kasus
  trigger gagal & hasil impor CSV massal (yang sengaja tidak di-trigger
  satu-satu).
- Pairing pakai kode 8 karakter (bukan scan QR) — cocok untuk server headless,
  lihat README bagian "Pengiriman WhatsApp".
- Sempat dibangun sebagai proyek terpisah (`hermes-gateway`, repo GitHub
  tersendiri) sebelum diputuskan untuk digabung jadi satu proses — repo
  tersebut sudah dihapus.

## 2026-07-23 — Build awal

- Implementasi awal lengkap sesuai `master-prompt.txt`: auth & role
  (super_admin/admin_event/petugas), CRUD event/ruangan/sesi/peserta/user,
  registrasi publik dengan validasi kapasitas real-time, generate QR
  on-the-fly, endpoint Hermes (`/api/hermes/queue`, `/api/hermes/callback`),
  absensi scan QR + manual walk-in, laporan rekap + export CSV.
- PWA installable (web app manifest + service worker ringan, cache asset
  statis saja — bukan offline-first).
- Fix: pesan error generik "Invalid input" saat tidak ada sesi dicentang
  saat registrasi → diganti pesan yang jelas.
- Fix: akses kamera di halaman scan gagal diam-diam kalau browser
  menganggap koneksi tidak aman (bukan HTTPS/localhost) — sekarang ada
  pesan error yang jelas.

## 2026-07-23 — Rebrand & UX registrasi

- Rebrand penuh sesuai brand guide JHD26: palet warna, font
  Bella/Mouldy Cheese (self-hosted, lisensi khusus JHD26) + Montserrat/Inter,
  logo & maskot dino di navbar/halaman publik, ikon PWA.
- Validasi bentrok waktu antar-sesi (server-side, dipakai bersama oleh
  registrasi publik & tambah peserta manual admin) + UI daftar sesi
  scrollable dikelompokkan per tanggal/jam, dengan sesi bentrok otomatis
  ter-disable saat sesi lain dipilih.
- Form registrasi didesain ulang: card rounded, maskot dino mengapit form
  di layar lebar (disembunyikan di mobile).
- Fix: session cookie (`secure: true`) tidak ter-set saat aplikasi diakses
  lewat reverse proxy/tunnel (Cloudflare Tunnel) karena Express tidak tahu
  request asli HTTPS → ditambahkan `app.set('trust proxy', 1)`.
- Fix: kamera scan tidak reliable pilih kamera belakang lewat
  `facingMode: 'environment'` di semua device → diganti dropdown pilih
  kamera eksplisit (`Html5Qrcode.getCameras()`), auto-default ke kamera
  yang labelnya mengandung "back"/"belakang"/"rear".
- Halaman admin baru: lihat & cetak QR peserta langsung dari
  `/admin/peserta` (berguna kalau ada kendala pengiriman WA di lapangan).

## 2026-07-23/24 — Kepatuhan data & keamanan

- Consent wajib: checkbox persetujuan pemrosesan data pribadi (rujukan
  UU No. 27/2022 PDP) di registrasi publik, tambah manual admin, dan
  impor CSV — dicatat dengan timestamp (`consent_at`), registrasi ditolak
  kalau tidak dicentang.
- Cloudflare Turnstile dipasang di form registrasi publik **dan** halaman
  login panitia, diverifikasi ke Cloudflare `siteverify` API di
  server-side (bukan cuma cek client-side).
- `scripts/toggle-turnstile.sh on|off` — cara aman menonaktifkan Turnstile
  sementara (utk testing lewat curl/skrip) tanpa menyentuh site/secret key
  asli di `.env`.
- **Audit keamanan input form registrasi:**
  - Fix stored-XSS: hasil pencarian walk-in di halaman scan dirender pakai
    `innerHTML` tanpa escaping — nama peserta yang berisi `<script>` bisa
    tereksekusi di browser petugas saat dicari. Diganti pakai
    `textContent`/`createElement`.
  - Nomor HP kini divalidasi ketat hanya angka (8-15 digit, boleh `+` di
    depan), menolak huruf/simbol/markup — sebelumnya cuma dicek panjang
    minimal tanpa cek karakter.
  - CSV export (daftar peserta & laporan) dinetralkan dari formula
    injection (`=`, `+`, `-`, `@` di awal sel diberi prefix kutip) —
    mencegah payload berbahaya tereksekusi kalau file dibuka di Excel.
  - Nama/institusi/email dibatasi panjang maksimalnya (services/validators.js,
    dipakai bersama oleh registrasi publik, tambah manual, dan edit admin).
  - Dikonfirmasi SQL injection bukan risiko — seluruh query pakai
    parameterized statement (`better-sqlite3`), tidak ada string
    concatenation dari input user ke SQL.

## Operasional server (perubahan langsung di server, di luar git)

- Node.js LTS via `nvm`, dependency native (`better-sqlite3`, `bcrypt`)
  di-build dengan `build-essential`.
- Aplikasi dipindah dari proses background manual ke **PM2**, didaftarkan
  sebagai systemd service (`pm2 startup` + `pm2 save`) — otomatis nyala
  lagi saat server reboot.
- **Cloudflare Tunnel** (`cloudflared`, systemd service `enabled`) untuk
  HTTPS + akses publik ke `registrasi.jhd26.online`, tanpa perlu buka
  port apa pun di firewall (port 3000 ditutup dari akses luar, hanya bisa
  diakses via tunnel atau localhost).
- **Backup database otomatis**: `scripts/backup.js` (pakai backup API
  `better-sqlite3`, aman meski DB sedang aktif ditulis/WAL mode),
  dijadwalkan tiap jam via cron, retensi 48 file (~2 hari), disimpan di
  `/opt/jhd/backups/`.
- Kapasitas ruangan disesuaikan dari asumsi awal PRD (R1=35/R2=30/R3=25)
  ke denah asli venue: **R1=30, R2=20, R3=20, R4=20, R5=20** (5 ruangan).
- Akun test dibuat: 1 super_admin (`admin`, dari seed awal), 1 admin_event
  (`admin_event1`), 3 petugas/operator (`operator1`, `operator2`,
  `operator3`) — kredensial dikirim terpisah, tidak dicatat di sini.
- Data uji coba (peserta & registrasi dummy) dibersihkan sebelum staging
  test dengan data sungguhan.

## Belum diputuskan / masih perlu tindak lanjut

- Flow setelah halaman konfirmasi registrasi (tombol atau auto-redirect
  ke situs utama `jhd26.online`) — masih pending, lihat memory proyek.
- Review final sesi & penempatan ruangan (15 sesi demo saat ini punya
  judul asli dari jadwal event, tapi penempatan ruangan diacak untuk
  testing, belum tentu sesuai rencana asli per-sesi).
- Rotasi kredensial test sebelum hari-H kalau akan dipakai orang banyak.
