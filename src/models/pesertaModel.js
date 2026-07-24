const crypto = require('crypto');
const db = require('../config/db');
const { normalizePhone } = require('../services/phone');

class DuplikatError extends Error {}
class SesiPenuhError extends Error {}
class SesiBentrokError extends Error {}
class ConsentError extends Error {}

function findByToken(token) {
  return db.prepare('SELECT * FROM peserta WHERE qr_token = ?').get(token);
}

function findById(id) {
  return db.prepare('SELECT * FROM peserta WHERE id = ?').get(id);
}

function findByNoHp(eventId, noHp) {
  return db.prepare('SELECT * FROM peserta WHERE event_id = ? AND no_hp = ?').get(eventId, noHp);
}

function isTerdaftarDiSesi(pesertaId, sesiId) {
  return !!db
    .prepare('SELECT 1 FROM peserta_sesi WHERE peserta_id = ? AND sesi_id = ?')
    .get(pesertaId, sesiId);
}

function sesiUntukPeserta(pesertaId) {
  return db
    .prepare(
      `SELECT sesi.id, sesi.nama, sesi.waktu_mulai, sesi.waktu_selesai, ruangan.nama AS ruangan_nama
       FROM peserta_sesi
       JOIN sesi ON sesi.id = peserta_sesi.sesi_id
       JOIN ruangan ON ruangan.id = sesi.ruangan_id
       WHERE peserta_sesi.peserta_id = ?
       ORDER BY sesi.waktu_mulai`
    )
    .all(pesertaId);
}

const _registerTx = db.transaction((eventId, data) => {
  if (!data.consent) {
    throw new ConsentError('Persetujuan pemrosesan data pribadi wajib dicentang.');
  }

  const noHp = normalizePhone(data.no_hp);

  const dup = db
    .prepare('SELECT id FROM peserta WHERE event_id = ? AND no_hp = ?')
    .get(eventId, noHp);
  if (dup) {
    throw new DuplikatError('Nomor HP ini sudah terdaftar pada event ini.');
  }

  const sesiTerpilih = [];
  for (const sesiId of data.sesi_ids) {
    const sesi = db
      .prepare(
        `SELECT sesi.id, sesi.nama, sesi.waktu_mulai, sesi.waktu_selesai, ruangan.kapasitas,
                (SELECT COUNT(*) FROM peserta_sesi
                 JOIN peserta ON peserta.id = peserta_sesi.peserta_id
                 WHERE peserta_sesi.sesi_id = sesi.id AND peserta.nonaktif_at IS NULL) AS jumlah_daftar
         FROM sesi JOIN ruangan ON ruangan.id = sesi.ruangan_id
         WHERE sesi.id = ?`
      )
      .get(sesiId);
    if (!sesi) {
      throw new SesiPenuhError('Sesi yang dipilih tidak ditemukan.');
    }
    if (sesi.jumlah_daftar >= sesi.kapasitas) {
      throw new SesiPenuhError(`Sesi "${sesi.nama}" sudah penuh.`);
    }
    sesiTerpilih.push(sesi);
  }

  for (let i = 0; i < sesiTerpilih.length; i += 1) {
    for (let j = i + 1; j < sesiTerpilih.length; j += 1) {
      const a = sesiTerpilih[i];
      const b = sesiTerpilih[j];
      if (a.waktu_mulai < b.waktu_selesai && b.waktu_mulai < a.waktu_selesai) {
        throw new SesiBentrokError(`Sesi "${a.nama}" dan "${b.nama}" waktunya bentrok.`);
      }
    }
  }

  const qrToken = crypto.randomUUID();
  const result = db
    .prepare(
      `INSERT INTO peserta (event_id, nama, no_hp, email, institusi, qr_token, consent_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(eventId, data.nama, noHp, data.email || null, data.institusi || null, qrToken);

  const pesertaId = result.lastInsertRowid;
  const insertPesertaSesi = db.prepare(
    'INSERT INTO peserta_sesi (peserta_id, sesi_id) VALUES (?, ?)'
  );
  for (const sesiId of data.sesi_ids) {
    insertPesertaSesi.run(pesertaId, sesiId);
  }

  return findById(pesertaId);
});

function register(eventId, data) {
  return _registerTx.immediate(eventId, data);
}

function list({ eventId, sesiId, q, hanyaAktif }) {
  let sql = `
    SELECT DISTINCT peserta.* FROM peserta
    LEFT JOIN peserta_sesi ON peserta_sesi.peserta_id = peserta.id
    WHERE peserta.event_id = ?
  `;
  const params = [eventId];
  if (hanyaAktif) {
    sql += ' AND peserta.nonaktif_at IS NULL';
  }
  if (sesiId) {
    sql += ' AND peserta_sesi.sesi_id = ?';
    params.push(sesiId);
  }
  if (q) {
    sql += ' AND (peserta.nama LIKE ? OR peserta.no_hp LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY peserta.created_at DESC';
  return db.prepare(sql).all(...params);
}

function update(id, { nama, email, institusi }) {
  db.prepare('UPDATE peserta SET nama = ?, email = ?, institusi = ? WHERE id = ?').run(
    nama,
    email || null,
    institusi || null,
    id
  );
  return findById(id);
}

function remove(id) {
  db.prepare('DELETE FROM kehadiran WHERE peserta_id = ?').run(id);
  db.prepare('DELETE FROM peserta_sesi WHERE peserta_id = ?').run(id);
  db.prepare('DELETE FROM peserta WHERE id = ?').run(id);
}

function nonaktifkan(id, catatan) {
  db.prepare(
    "UPDATE peserta SET nonaktif_at = datetime('now'), catatan_nonaktif = ? WHERE id = ?"
  ).run(catatan || null, id);
}

function reaktivasi(id) {
  db.prepare('UPDATE peserta SET nonaktif_at = NULL, catatan_nonaktif = NULL WHERE id = ?').run(id);
}

function markResend(id) {
  db.prepare("UPDATE peserta SET status_kirim_qr = 'pending', catatan_kirim = NULL WHERE id = ?").run(id);
}

function pendingQueue() {
  return db.prepare("SELECT * FROM peserta WHERE status_kirim_qr = 'pending' ORDER BY created_at").all();
}

function updateStatusKirim(id, status, keterangan) {
  db.prepare('UPDATE peserta SET status_kirim_qr = ?, catatan_kirim = ? WHERE id = ?').run(
    status,
    keterangan || null,
    id
  );
}

module.exports = {
  DuplikatError,
  SesiPenuhError,
  SesiBentrokError,
  ConsentError,
  findByToken,
  findById,
  findByNoHp,
  isTerdaftarDiSesi,
  sesiUntukPeserta,
  register,
  list,
  update,
  remove,
  nonaktifkan,
  reaktivasi,
  markResend,
  pendingQueue,
  updateStatusKirim,
};
