const db = require('../config/db');

function getActive() {
  return db.prepare("SELECT * FROM events WHERE status = 'active' ORDER BY id LIMIT 1").get();
}

function findById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

function update(id, { nama, deskripsi, tanggal_mulai, tanggal_selesai, lokasi }) {
  db.prepare(
    `UPDATE events SET nama = ?, deskripsi = ?, tanggal_mulai = ?, tanggal_selesai = ?, lokasi = ? WHERE id = ?`
  ).run(nama, deskripsi || null, tanggal_mulai || null, tanggal_selesai || null, lokasi || null, id);
  return findById(id);
}

module.exports = { getActive, findById, update };
