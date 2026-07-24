const express = require('express');
const { z } = require('zod');

const eventModel = require('../models/eventModel');
const sesiModel = require('../models/sesiModel');
const pesertaModel = require('../models/pesertaModel');
const kehadiranModel = require('../models/kehadiranModel');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const petugasRoles = ['super_admin', 'admin_event', 'petugas'];

router.get('/absensi/scan', requireRole(...petugasRoles), (req, res) => {
  const event = eventModel.getActive();
  res.render('absensi/scan', { title: 'Scan Absensi', sesiList: sesiModel.listByEvent(event.id) });
});

const scanSchema = z.object({
  qr_token: z.string().trim().min(1),
  sesi_id: z.coerce.number().int().positive(),
});

function prosesAbsensi({ peserta, sesiId, dicatatOleh, metode }) {
  if (!peserta) {
    return { status: 'tidak_terdaftar', message: 'QR tidak dikenali / peserta tidak ditemukan.' };
  }
  if (peserta.nonaktif_at) {
    return { status: 'tidak_terdaftar', message: `${peserta.nama} sudah menonaktifkan registrasinya.` };
  }
  if (!pesertaModel.isTerdaftarDiSesi(peserta.id, sesiId)) {
    return { status: 'tidak_terdaftar', message: `${peserta.nama} tidak terdaftar pada sesi ini.` };
  }
  if (kehadiranModel.sudahAbsen(peserta.id, sesiId)) {
    return { status: 'gagal', message: `${peserta.nama} sudah tercatat hadir di sesi ini.` };
  }
  kehadiranModel.catat({ pesertaId: peserta.id, sesiId, dicatatOleh, metode });
  return { status: 'sukses', message: `${peserta.nama} berhasil dicatat hadir.`, nama: peserta.nama };
}

router.post('/api/absensi/scan', requireRole(...petugasRoles), (req, res) => {
  const parsed = scanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: 'gagal', message: 'Data scan tidak valid.' });
  }
  const peserta = pesertaModel.findByToken(parsed.data.qr_token);
  const hasil = prosesAbsensi({
    peserta,
    sesiId: parsed.data.sesi_id,
    dicatatOleh: req.session.user.id,
    metode: 'qr_scan',
  });
  res.json(hasil);
});

router.get('/api/absensi/cari', requireRole(...petugasRoles), (req, res) => {
  const event = eventModel.getActive();
  const { sesi_id, q } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.json({ data: [] });
  }
  const hasil = pesertaModel
    .list({ eventId: event.id, sesiId: sesi_id || null, q, hanyaAktif: true })
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      no_hp: p.no_hp,
      sudah_absen: sesi_id ? kehadiranModel.sudahAbsen(p.id, sesi_id) : false,
    }));
  res.json({ data: hasil });
});

const manualSchema = z.object({
  peserta_id: z.coerce.number().int().positive(),
  sesi_id: z.coerce.number().int().positive(),
});

router.post('/api/absensi/manual', requireRole(...petugasRoles), (req, res) => {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ status: 'gagal', message: 'Data tidak valid.' });
  }
  const peserta = pesertaModel.findById(parsed.data.peserta_id);
  const hasil = prosesAbsensi({
    peserta,
    sesiId: parsed.data.sesi_id,
    dicatatOleh: req.session.user.id,
    metode: 'manual',
  });
  res.json(hasil);
});

router.get('/api/absensi', requireRole(...petugasRoles), (req, res) => {
  const { sesi_id } = req.query;
  if (!sesi_id) return res.status(400).json({ error: 'sesi_id wajib diisi' });
  res.json({ data: kehadiranModel.forSesi(sesi_id) });
});

module.exports = router;
