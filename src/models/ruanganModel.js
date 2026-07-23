const db = require('../config/db');

function list() {
  return db.prepare('SELECT * FROM ruangan ORDER BY nama').all();
}

function findById(id) {
  return db.prepare('SELECT * FROM ruangan WHERE id = ?').get(id);
}

function create({ nama, kapasitas }) {
  const result = db.prepare('INSERT INTO ruangan (nama, kapasitas) VALUES (?, ?)').run(nama, kapasitas);
  return findById(result.lastInsertRowid);
}

function update(id, { nama, kapasitas }) {
  db.prepare('UPDATE ruangan SET nama = ?, kapasitas = ? WHERE id = ?').run(nama, kapasitas, id);
  return findById(id);
}

module.exports = { list, findById, create, update };
