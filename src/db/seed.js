const bcrypt = require('bcrypt');
const db = require('../config/db');
const env = require('../config/env');

const seed = db.transaction(() => {
  const eventCount = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  if (eventCount === 0) {
    db.prepare(
      `INSERT INTO events (nama, deskripsi, status) VALUES (?, ?, 'active')`
    ).run('JHD26', 'Event JHD26');
    console.log('Seed: event JHD26 dibuat.');
  } else {
    console.log('Seed: event sudah ada, dilewati.');
  }

  const ruanganCount = db.prepare('SELECT COUNT(*) AS n FROM ruangan').get().n;
  if (ruanganCount === 0) {
    const insertRuangan = db.prepare('INSERT INTO ruangan (nama, kapasitas) VALUES (?, ?)');
    insertRuangan.run('R1', 35);
    insertRuangan.run('R2', 30);
    insertRuangan.run('R3', 25);
    console.log('Seed: ruangan R1/R2/R3 dibuat.');
  } else {
    console.log('Seed: ruangan sudah ada, dilewati.');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount === 0) {
    const passwordHash = bcrypt.hashSync(env.seedAdmin.password, 10);
    db.prepare(
      `INSERT INTO users (nama, username, password_hash, role, active) VALUES (?, ?, ?, 'super_admin', 1)`
    ).run(env.seedAdmin.nama, env.seedAdmin.username, passwordHash);
    console.log(`Seed: user super_admin '${env.seedAdmin.username}' dibuat.`);
  } else {
    console.log('Seed: user sudah ada, dilewati.');
  }
});

seed();
console.log('Seeding selesai.');
