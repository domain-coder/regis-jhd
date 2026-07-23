const express = require('express');
const { z } = require('zod');
const eventModel = require('../models/eventModel');
const sesiModel = require('../models/sesiModel');
const pesertaModel = require('../models/pesertaModel');
const { generateQrDataUrl } = require('../services/qr');
const { labelSesi } = require('../services/tanggal');

const router = express.Router();

function sesiPublikList() {
  const event = eventModel.getActive();
  return sesiModel.listByEvent(event.id).map((s) => ({
    id: s.id,
    nama: s.nama,
    ruangan_nama: s.ruangan_nama,
    waktu_mulai: s.waktu_mulai,
    waktu_selesai: s.waktu_selesai,
    ...labelSesi(s),
    kapasitas: s.kapasitas,
    jumlah_daftar: s.jumlah_daftar,
    sisa: sesiModel.sisaKuota(s),
  }));
}

router.get('/register', (req, res) => {
  res.render('public/register', { title: 'Registrasi', sesiList: sesiPublikList(), error: null, form: {} });
});

router.get('/api/public/sesi', (req, res) => {
  res.json({ data: sesiPublikList() });
});

const registerSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  no_hp: z.string().trim().min(8, 'Nomor HP tidak valid'),
  email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')),
  institusi: z.string().trim().optional(),
  sesi_id: z
    .preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()))
    .refine((arr) => arr.length > 0, 'Pilih minimal satu sesi')
    .transform((arr) => arr.map(Number)),
});

router.post('/api/public/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('public/register', {
      title: 'Registrasi',
      sesiList: sesiPublikList(),
      error: parsed.error.issues[0].message,
      form: req.body,
    });
  }

  const event = eventModel.getActive();
  try {
    const peserta = pesertaModel.register(event.id, {
      nama: parsed.data.nama,
      no_hp: parsed.data.no_hp,
      email: parsed.data.email,
      institusi: parsed.data.institusi,
      sesi_ids: parsed.data.sesi_id,
    });
    res.redirect(`/register/konfirmasi/${peserta.qr_token}`);
  } catch (err) {
    if (
      err instanceof pesertaModel.DuplikatError ||
      err instanceof pesertaModel.SesiPenuhError ||
      err instanceof pesertaModel.SesiBentrokError
    ) {
      return res.status(400).render('public/register', {
        title: 'Registrasi',
        sesiList: sesiPublikList(),
        error: err.message,
        form: req.body,
      });
    }
    throw err;
  }
});

router.get('/register/konfirmasi/:token', async (req, res) => {
  const peserta = pesertaModel.findByToken(req.params.token);
  if (!peserta) {
    return res.status(404).render('errors/404', { title: 'Tidak Ditemukan' });
  }
  const sesiList = pesertaModel.sesiUntukPeserta(peserta.id);
  const qrDataUrl = await generateQrDataUrl(peserta.qr_token);
  res.render('public/konfirmasi', { title: 'Konfirmasi Registrasi', peserta, sesiList, qrDataUrl });
});

module.exports = router;
