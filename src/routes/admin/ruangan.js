const express = require('express');
const { z } = require('zod');
const ruanganModel = require('../../models/ruanganModel');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

const ruanganSchema = z.object({
  nama: z.string().trim().min(1, 'Nama ruangan wajib diisi'),
  kapasitas: z.coerce.number().int().positive('Kapasitas harus angka positif'),
});

router.get('/ruangan', requireRole('super_admin', 'admin_event'), (req, res) => {
  res.render('admin/ruangan', { title: 'Ruangan', ruanganList: ruanganModel.list(), error: null });
});

router.post('/ruangan', requireRole('super_admin', 'admin_event'), (req, res) => {
  const parsed = ruanganSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/ruangan', {
      title: 'Ruangan',
      ruanganList: ruanganModel.list(),
      error: parsed.error.issues[0].message,
    });
  }
  ruanganModel.create(parsed.data);
  res.redirect('/admin/ruangan');
});

router.post('/ruangan/:id', requireRole('super_admin', 'admin_event'), (req, res) => {
  const parsed = ruanganSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/ruangan', {
      title: 'Ruangan',
      ruanganList: ruanganModel.list(),
      error: parsed.error.issues[0].message,
    });
  }
  ruanganModel.update(req.params.id, parsed.data);
  res.redirect('/admin/ruangan');
});

module.exports = router;
