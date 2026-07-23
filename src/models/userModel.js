const db = require('../config/db');

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function list() {
  return db
    .prepare('SELECT id, nama, username, role, active, created_at FROM users ORDER BY id')
    .all();
}

function create({ nama, username, passwordHash, role }) {
  const result = db
    .prepare(
      'INSERT INTO users (nama, username, password_hash, role, active) VALUES (?, ?, ?, ?, 1)'
    )
    .run(nama, username, passwordHash, role);
  return findById(result.lastInsertRowid);
}

function update(id, { nama, role, active }) {
  db.prepare('UPDATE users SET nama = ?, role = ?, active = ? WHERE id = ?').run(
    nama,
    role,
    active ? 1 : 0,
    id
  );
  return findById(id);
}

function updatePassword(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

module.exports = { findByUsername, findById, list, create, update, updatePassword };
