const db = require('../config/db');

const SELECT_WITH_JOIN = `
  SELECT
    sesi.*,
    ruangan.nama AS ruangan_nama,
    ruangan.kapasitas AS kapasitas,
    (SELECT COUNT(*) FROM peserta_sesi
     JOIN peserta ON peserta.id = peserta_sesi.peserta_id
     WHERE peserta_sesi.sesi_id = sesi.id AND peserta.nonaktif_at IS NULL) AS jumlah_daftar
  FROM sesi
  JOIN ruangan ON ruangan.id = sesi.ruangan_id
`;

function listByEvent(eventId) {
  return db
    .prepare(`${SELECT_WITH_JOIN} WHERE sesi.event_id = ? ORDER BY sesi.waktu_mulai`)
    .all(eventId);
}

function findById(id) {
  return db.prepare(`${SELECT_WITH_JOIN} WHERE sesi.id = ?`).get(id);
}

function create({ event_id, ruangan_id, nama, waktu_mulai, waktu_selesai }) {
  const result = db
    .prepare(
      'INSERT INTO sesi (event_id, ruangan_id, nama, waktu_mulai, waktu_selesai) VALUES (?, ?, ?, ?, ?)'
    )
    .run(event_id, ruangan_id, nama, waktu_mulai, waktu_selesai);
  return findById(result.lastInsertRowid);
}

function update(id, { ruangan_id, nama, waktu_mulai, waktu_selesai }) {
  db.prepare(
    'UPDATE sesi SET ruangan_id = ?, nama = ?, waktu_mulai = ?, waktu_selesai = ? WHERE id = ?'
  ).run(ruangan_id, nama, waktu_mulai, waktu_selesai, id);
  return findById(id);
}

function sisaKuota(sesi) {
  return sesi.kapasitas - sesi.jumlah_daftar;
}

function findByNama(eventId, nama) {
  return db
    .prepare('SELECT * FROM sesi WHERE event_id = ? AND LOWER(nama) = LOWER(?)')
    .get(eventId, nama.trim());
}

module.exports = { listByEvent, findById, create, update, sisaKuota, findByNama };
