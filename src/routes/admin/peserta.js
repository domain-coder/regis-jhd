const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { z } = require('zod');

const eventModel = require('../../models/eventModel');
const sesiModel = require('../../models/sesiModel');
const pesertaModel = require('../../models/pesertaModel');
const { labelSesi } = require('../../services/tanggal');
const { generateQrDataUrl } = require('../../services/qr');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function currentEvent() {
  return eventModel.getActive();
}

function sesiUntukForm(eventId) {
  return sesiModel.listByEvent(eventId).map((s) => ({
    ...s,
    ...labelSesi(s),
    sisa: sesiModel.sisaKuota(s),
  }));
}

router.get('/peserta', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = currentEvent();
  const { sesi_id, q } = req.query;
  const pesertaList = pesertaModel
    .list({ eventId: event.id, sesiId: sesi_id || null, q: q || null })
    .map((p) => ({ ...p, sesiList: pesertaModel.sesiUntukPeserta(p.id) }));

  res.render('admin/peserta/index', {
    title: 'Peserta',
    pesertaList,
    sesiList: sesiModel.listByEvent(event.id),
    filter: { sesi_id: sesi_id || '', q: q || '' },
    error: null,
    info: null,
  });
});

router.get('/peserta/tambah', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = currentEvent();
  res.render('admin/peserta/tambah', {
    title: 'Tambah Peserta',
    sesiList: sesiUntukForm(event.id),
    error: null,
    form: {},
  });
});

const manualSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  no_hp: z.string().trim().min(8, 'Nomor HP tidak valid'),
  email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')),
  institusi: z.string().trim().optional(),
  sesi_id: z
    .preprocess((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()))
    .refine((arr) => arr.length > 0, 'Pilih minimal satu sesi')
    .transform((arr) => arr.map(Number)),
});

router.post('/peserta', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = currentEvent();
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/peserta/tambah', {
      title: 'Tambah Peserta',
      sesiList: sesiUntukForm(event.id),
      error: parsed.error.issues[0].message,
      form: req.body,
    });
  }
  try {
    pesertaModel.register(event.id, {
      nama: parsed.data.nama,
      no_hp: parsed.data.no_hp,
      email: parsed.data.email,
      institusi: parsed.data.institusi,
      sesi_ids: parsed.data.sesi_id,
    });
    res.redirect('/admin/peserta');
  } catch (err) {
    if (
      err instanceof pesertaModel.DuplikatError ||
      err instanceof pesertaModel.SesiPenuhError ||
      err instanceof pesertaModel.SesiBentrokError
    ) {
      return res.status(400).render('admin/peserta/tambah', {
        title: 'Tambah Peserta',
        sesiList: sesiUntukForm(event.id),
        error: err.message,
        form: req.body,
      });
    }
    throw err;
  }
});

router.get('/peserta/export', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = currentEvent();
  const { sesi_id } = req.query;
  const pesertaList = pesertaModel
    .list({ eventId: event.id, sesiId: sesi_id || null })
    .map((p) => ({ ...p, sesiList: pesertaModel.sesiUntukPeserta(p.id) }));

  const csv = stringify(
    pesertaList.map((p) => ({
      id: p.id,
      nama: p.nama,
      no_hp: p.no_hp,
      email: p.email || '',
      institusi: p.institusi || '',
      sesi: p.sesiList.map((s) => s.nama).join(', '),
      status_kirim_qr: p.status_kirim_qr,
      created_at: p.created_at,
    })),
    { header: true }
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="peserta-jhd26.csv"');
  res.send(csv);
});

router.get('/peserta/:id/qr', requireRole('super_admin', 'admin_event'), async (req, res) => {
  const peserta = pesertaModel.findById(req.params.id);
  if (!peserta) return res.status(404).render('errors/404', { title: 'Tidak Ditemukan' });
  const sesiList = pesertaModel.sesiUntukPeserta(peserta.id);
  const qrDataUrl = await generateQrDataUrl(peserta.qr_token);
  res.render('admin/peserta/qr', { title: 'QR Peserta', peserta, sesiList, qrDataUrl });
});

router.get('/peserta/:id/edit', requireRole('super_admin', 'admin_event'), (req, res) => {
  const peserta = pesertaModel.findById(req.params.id);
  if (!peserta) return res.status(404).render('errors/404', { title: 'Tidak Ditemukan' });
  const sesiList = pesertaModel.sesiUntukPeserta(peserta.id);
  const kehadiran = require('../../models/kehadiranModel').riwayatPeserta(peserta.id);
  res.render('admin/peserta/edit', { title: 'Edit Peserta', peserta, sesiList, kehadiran, error: null });
});

const editSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  email: z.string().trim().email('Email tidak valid').optional().or(z.literal('')),
  institusi: z.string().trim().optional(),
});

router.post(
  '/peserta/import',
  requireRole('super_admin', 'admin_event'),
  upload.single('file'),
  (req, res) => {
    const event = currentEvent();
    if (!req.file) {
      return res.status(400).render('admin/peserta/index', {
        title: 'Peserta',
        pesertaList: pesertaModel
          .list({ eventId: event.id })
          .map((p) => ({ ...p, sesiList: pesertaModel.sesiUntukPeserta(p.id) })),
        sesiList: sesiModel.listByEvent(event.id),
        filter: { sesi_id: '', q: '' },
        error: 'File CSV wajib diupload.',
        info: null,
      });
    }

    let rows;
    try {
      rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (e) {
      rows = [];
    }

    const hasil = { berhasil: 0, gagal: [] };
    for (const [idx, row] of rows.entries()) {
      const baris = idx + 2; // +1 header, +1 index-to-line
      const namaSesi = String(row.sesi || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const sesiIds = [];
      let sesiTidakDitemukan = null;
      for (const nama of namaSesi) {
        const sesi = sesiModel.findByNama(event.id, nama);
        if (!sesi) {
          sesiTidakDitemukan = nama;
          break;
        }
        sesiIds.push(sesi.id);
      }
      if (sesiTidakDitemukan) {
        hasil.gagal.push(`Baris ${baris}: sesi "${sesiTidakDitemukan}" tidak ditemukan`);
        continue;
      }
      if (sesiIds.length === 0) {
        hasil.gagal.push(`Baris ${baris}: kolom sesi kosong`);
        continue;
      }
      try {
        pesertaModel.register(event.id, {
          nama: row.nama,
          no_hp: row.no_hp,
          email: row.email,
          institusi: row.institusi,
          sesi_ids: sesiIds,
        });
        hasil.berhasil += 1;
      } catch (err) {
        hasil.gagal.push(`Baris ${baris}: ${err.message}`);
      }
    }

    const pesertaList = pesertaModel
      .list({ eventId: event.id })
      .map((p) => ({ ...p, sesiList: pesertaModel.sesiUntukPeserta(p.id) }));
    res.render('admin/peserta/index', {
      title: 'Peserta',
      pesertaList,
      sesiList: sesiModel.listByEvent(event.id),
      filter: { sesi_id: '', q: '' },
      error: hasil.gagal.length ? hasil.gagal.join('; ') : null,
      info: `${hasil.berhasil} peserta berhasil diimpor.`,
    });
  }
);

router.post('/peserta/:id', requireRole('super_admin', 'admin_event'), (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  const peserta = pesertaModel.findById(req.params.id);
  if (!peserta) return res.status(404).render('errors/404', { title: 'Tidak Ditemukan' });
  if (!parsed.success) {
    return res.status(400).render('admin/peserta/edit', {
      title: 'Edit Peserta',
      peserta: { ...peserta, ...req.body },
      sesiList: pesertaModel.sesiUntukPeserta(peserta.id),
      kehadiran: require('../../models/kehadiranModel').riwayatPeserta(peserta.id),
      error: parsed.error.issues[0].message,
    });
  }
  pesertaModel.update(req.params.id, parsed.data);
  res.redirect('/admin/peserta');
});

router.post('/peserta/:id/hapus', requireRole('super_admin', 'admin_event'), (req, res) => {
  pesertaModel.remove(req.params.id);
  res.redirect('/admin/peserta');
});

router.post('/peserta/:id/resend-qr', requireRole('super_admin', 'admin_event'), (req, res) => {
  pesertaModel.markResend(req.params.id);
  res.redirect('/admin/peserta');
});

module.exports = router;
