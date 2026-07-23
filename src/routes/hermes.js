const express = require('express');
const { z } = require('zod');
const pesertaModel = require('../models/pesertaModel');
const { generateQrDataUrl } = require('../services/qr');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

router.get('/queue', requireApiKey, async (req, res) => {
  const antrian = pesertaModel.pendingQueue();

  const data = await Promise.all(
    antrian.map(async (p) => ({
      peserta_id: p.id,
      nama: p.nama,
      no_hp: p.no_hp,
      sesi: pesertaModel.sesiUntukPeserta(p.id).map((s) => ({
        nama: s.nama,
        waktu_mulai: s.waktu_mulai,
        ruangan: s.ruangan_nama,
      })),
      qr_token: p.qr_token,
      qr_image_base64: await generateQrDataUrl(p.qr_token),
    }))
  );

  res.json({ data });
});

const callbackSchema = z.object({
  peserta_id: z.coerce.number().int().positive(),
  status: z.enum(['sent', 'failed']),
  keterangan: z.string().trim().optional(),
});

router.post('/callback', requireApiKey, (req, res) => {
  const parsed = callbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const peserta = pesertaModel.findById(parsed.data.peserta_id);
  if (!peserta) {
    return res.status(404).json({ error: 'Peserta tidak ditemukan' });
  }

  pesertaModel.updateStatusKirim(parsed.data.peserta_id, parsed.data.status, parsed.data.keterangan);
  res.json({ ok: true });
});

module.exports = router;
