const db = require('../config/db');

function sudahAbsen(pesertaId, sesiId) {
  return !!db
    .prepare('SELECT 1 FROM kehadiran WHERE peserta_id = ? AND sesi_id = ?')
    .get(pesertaId, sesiId);
}

function catat({ pesertaId, sesiId, dicatatOleh, metode }) {
  return db
    .prepare(
      'INSERT INTO kehadiran (peserta_id, sesi_id, dicatat_oleh, metode) VALUES (?, ?, ?, ?)'
    )
    .run(pesertaId, sesiId, dicatatOleh, metode);
}

function forSesi(sesiId) {
  return db
    .prepare(
      `SELECT kehadiran.*, peserta.nama, peserta.no_hp
       FROM kehadiran
       JOIN peserta ON peserta.id = kehadiran.peserta_id
       WHERE kehadiran.sesi_id = ?
       ORDER BY kehadiran.waktu_hadir DESC`
    )
    .all(sesiId);
}

function riwayatPeserta(pesertaId) {
  return db
    .prepare(
      `SELECT kehadiran.*, sesi.nama AS sesi_nama
       FROM kehadiran
       JOIN sesi ON sesi.id = kehadiran.sesi_id
       WHERE kehadiran.peserta_id = ?
       ORDER BY kehadiran.waktu_hadir`
    )
    .all(pesertaId);
}

module.exports = { sudahAbsen, catat, forSesi, riwayatPeserta };
