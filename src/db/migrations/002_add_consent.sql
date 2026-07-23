-- Catatan waktu persetujuan pemrosesan data pribadi (UU No. 27 Tahun 2022
-- tentang Pelindungan Data Pribadi). Wajib diisi saat registrasi — lihat
-- validasi di pesertaModel.register().
ALTER TABLE peserta ADD COLUMN consent_at TEXT;
