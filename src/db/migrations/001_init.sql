CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL DEFAULT 'JHD26',
  deskripsi TEXT,
  tanggal_mulai TEXT,
  tanggal_selesai TEXT,
  lokasi TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active/archived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ruangan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,            -- R1, R2, R3
  kapasitas INTEGER NOT NULL,    -- 35, 30, 25 (seed default, admin bisa edit)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  ruangan_id INTEGER NOT NULL REFERENCES ruangan(id),
  nama TEXT NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,   -- super_admin / admin_event / petugas
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE peserta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  nama TEXT NOT NULL,
  no_hp TEXT NOT NULL,
  email TEXT,
  institusi TEXT,
  qr_token TEXT NOT NULL UNIQUE,       -- UUID v4
  status_kirim_qr TEXT NOT NULL DEFAULT 'pending', -- pending/sent/failed
  catatan_kirim TEXT,                  -- keterangan dari Hermes saat status = failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, no_hp)              -- cegah duplikasi berdasar no. HP dalam event yang sama
);

-- peserta_sesi (relasi many-to-many, TANPA status waitlist — lihat PRD Bagian 9.2)
CREATE TABLE peserta_sesi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peserta_id INTEGER NOT NULL REFERENCES peserta(id),
  sesi_id INTEGER NOT NULL REFERENCES sesi(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(peserta_id, sesi_id)
);

CREATE TABLE kehadiran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peserta_id INTEGER NOT NULL REFERENCES peserta(id),
  sesi_id INTEGER NOT NULL REFERENCES sesi(id),
  waktu_hadir TEXT NOT NULL DEFAULT (datetime('now')),
  dicatat_oleh INTEGER REFERENCES users(id),
  metode TEXT NOT NULL DEFAULT 'qr_scan', -- qr_scan/manual
  UNIQUE(peserta_id, sesi_id)              -- satu peserta hanya sekali absen per sesi
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  aksi TEXT NOT NULL,
  target_table TEXT,
  target_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sesi_event ON sesi(event_id);
CREATE INDEX idx_sesi_ruangan ON sesi(ruangan_id);
CREATE INDEX idx_peserta_event ON peserta(event_id);
CREATE INDEX idx_peserta_status_kirim ON peserta(status_kirim_qr);
CREATE INDEX idx_peserta_sesi_sesi ON peserta_sesi(sesi_id);
CREATE INDEX idx_kehadiran_sesi ON kehadiran(sesi_id);
