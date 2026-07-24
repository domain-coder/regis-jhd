-- Penonaktifan mandiri via balasan WA (bukan hapus data — lihat
-- src/services/balasanWa.js). Peserta nonaktif tidak dihitung ke kapasitas
-- sesi dan tidak muncul di pencarian/scan absensi, tapi baris peserta &
-- peserta_sesi tetap utuh sehingga bisa direaktivasi admin kalau balasan
-- ternyata tidak disengaja.
ALTER TABLE peserta ADD COLUMN nonaktif_at TEXT;
ALTER TABLE peserta ADD COLUMN catatan_nonaktif TEXT;
