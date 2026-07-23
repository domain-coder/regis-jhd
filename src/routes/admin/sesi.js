const express = require('express');
const { z } = require('zod');
const sesiModel = require('../../models/sesiModel');
const ruanganModel = require('../../models/ruanganModel');
const eventModel = require('../../models/eventModel');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

const sesiSchema = z.object({
  ruangan_id: z.coerce.number().int().positive('Ruangan wajib dipilih'),
  nama: z.string().trim().min(1, 'Nama sesi wajib diisi'),
  waktu_mulai: z.string().trim().min(1, 'Waktu mulai wajib diisi'),
  waktu_selesai: z.string().trim().min(1, 'Waktu selesai wajib diisi'),
});

function renderForm(res, extra = {}) {
  const event = eventModel.getActive();
  res.render('admin/sesi', {
    title: 'Sesi',
    sesiList: sesiModel.listByEvent(event.id),
    ruanganList: ruanganModel.list(),
    sisaKuota: sesiModel.sisaKuota,
    error: null,
    ...extra,
  });
}

router.get('/sesi', requireRole('super_admin', 'admin_event'), (req, res) => {
  renderForm(res);
});

router.post('/sesi', requireRole('super_admin', 'admin_event'), (req, res) => {
  const parsed = sesiSchema.safeParse(req.body);
  if (!parsed.success) {
    return renderForm(res.status(400), { error: parsed.error.issues[0].message });
  }
  const event = eventModel.getActive();
  sesiModel.create({ ...parsed.data, event_id: event.id });
  res.redirect('/admin/sesi');
});

router.post('/sesi/:id', requireRole('super_admin', 'admin_event'), (req, res) => {
  const parsed = sesiSchema.safeParse(req.body);
  if (!parsed.success) {
    return renderForm(res.status(400), { error: parsed.error.issues[0].message });
  }
  sesiModel.update(req.params.id, parsed.data);
  res.redirect('/admin/sesi');
});

module.exports = router;
