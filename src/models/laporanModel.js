const db = require('../config/db');

function rekapSesi(eventId) {
  return db
    .prepare(
      `SELECT
         sesi.id, sesi.nama, ruangan.nama AS ruangan_nama, ruangan.kapasitas,
         (SELECT COUNT(*) FROM peserta_sesi WHERE peserta_sesi.sesi_id = sesi.id) AS jumlah_daftar,
         (SELECT COUNT(*) FROM kehadiran WHERE kehadiran.sesi_id = sesi.id) AS jumlah_hadir
       FROM sesi
       JOIN ruangan ON ruangan.id = sesi.ruangan_id
       WHERE sesi.event_id = ?
       ORDER BY sesi.waktu_mulai`
    )
    .all(eventId)
    .map((s) => ({
      ...s,
      sisa_kuota: s.kapasitas - s.jumlah_daftar,
      persen_hadir: s.jumlah_daftar === 0 ? 0 : Math.round((s.jumlah_hadir / s.jumlah_daftar) * 100),
    }));
}

function rekapPeserta(eventId) {
  const peserta = db.prepare('SELECT * FROM peserta WHERE event_id = ? ORDER BY nama').all(eventId);
  const rows = db
    .prepare(
      `SELECT peserta_sesi.peserta_id, sesi.nama AS sesi_nama,
              EXISTS(SELECT 1 FROM kehadiran WHERE kehadiran.peserta_id = peserta_sesi.peserta_id AND kehadiran.sesi_id = sesi.id) AS hadir
       FROM peserta_sesi
       JOIN sesi ON sesi.id = peserta_sesi.sesi_id
       WHERE sesi.event_id = ?
       ORDER BY sesi.waktu_mulai`
    )
    .all(eventId);

  const sesiByPeserta = new Map();
  for (const row of rows) {
    if (!sesiByPeserta.has(row.peserta_id)) sesiByPeserta.set(row.peserta_id, []);
    sesiByPeserta.get(row.peserta_id).push({ nama: row.sesi_nama, hadir: !!row.hadir });
  }

  return peserta.map((p) => ({ ...p, sesi: sesiByPeserta.get(p.id) || [] }));
}

module.exports = { rekapSesi, rekapPeserta };
