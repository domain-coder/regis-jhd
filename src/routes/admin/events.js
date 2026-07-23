const express = require('express');
const { z } = require('zod');
const eventModel = require('../../models/eventModel');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

const eventSchema = z.object({
  nama: z.string().trim().min(1, 'Nama event wajib diisi'),
  deskripsi: z.string().trim().optional(),
  tanggal_mulai: z.string().trim().optional(),
  tanggal_selesai: z.string().trim().optional(),
  lokasi: z.string().trim().optional(),
});

router.get('/event', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = eventModel.getActive();
  res.render('admin/event', { title: 'Event', event, error: null });
});

router.post('/event', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = eventModel.getActive();
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/event', {
      title: 'Event',
      event: { ...event, ...req.body },
      error: parsed.error.issues[0].message,
    });
  }
  eventModel.update(event.id, parsed.data);
  res.redirect('/admin/event');
});

module.exports = router;
