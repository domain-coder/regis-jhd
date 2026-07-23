const express = require('express');
const { stringify } = require('csv-stringify/sync');
const eventModel = require('../../models/eventModel');
const laporanModel = require('../../models/laporanModel');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

router.get('/laporan', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = eventModel.getActive();
  res.render('admin/laporan', {
    title: 'Laporan',
    rekapSesi: laporanModel.rekapSesi(event.id),
    rekapPeserta: laporanModel.rekapPeserta(event.id),
  });
});

router.get('/laporan/export', requireRole('super_admin', 'admin_event'), (req, res) => {
  const event = eventModel.getActive();
  const jenis = req.query.jenis === 'peserta' ? 'peserta' : 'sesi';

  let csv;
  if (jenis === 'sesi') {
    csv = stringify(
      laporanModel.rekapSesi(event.id).map((s) => ({
        sesi: s.nama,
        ruangan: s.ruangan_nama,
        kapasitas: s.kapasitas,
        jumlah_daftar: s.jumlah_daftar,
        jumlah_hadir: s.jumlah_hadir,
        persen_hadir: `${s.persen_hadir}%`,
        sisa_kuota: s.sisa_kuota,
      })),
      { header: true }
    );
  } else {
    csv = stringify(
      laporanModel.rekapPeserta(event.id).map((p) => ({
        nama: p.nama,
        no_hp: p.no_hp,
        sesi_diikuti: p.sesi.map((s) => s.nama).join(', '),
        sesi_dihadiri: p.sesi.filter((s) => s.hadir).map((s) => s.nama).join(', '),
      })),
      { header: true }
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${jenis}-jhd26.csv"`);
  res.send(csv);
});

module.exports = router;
