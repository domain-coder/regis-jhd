const env = require('../config/env');
const pesertaModel = require('../models/pesertaModel');
const { generateQrDataUrl } = require('./qr');
const whatsapp = require('./whatsapp');

const sedangDikirim = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatPesan(peserta, sesiList) {
  const daftarSesi = sesiList
    .map((s, i) => `${i + 1}. ${s.nama} — ${s.ruangan_nama}, ${s.waktu_mulai}`)
    .join('\n');
  return (
    `Halo *${peserta.nama}*! 👋\n\n` +
    `Terima kasih telah mendaftar di *Jagongan Hak Digital 2026*.\n\n` +
    `Berikut QR code Anda untuk absensi. Mohon simpan pesan ini dan ` +
    `tunjukkan QR ke petugas saat masuk sesi.\n\n` +
    `📅 Sesi yang diikuti:\n${daftarSesi}\n\n` +
    `Sampai jumpa di acara! 🎉\n\n` +
    `_Jika Anda tidak merasa melakukan registrasi ini, balas pesan ini kapan saja ` +
    `untuk membatalkan otomatis (kuota sesi akan dibebaskan)._`
  );
}

// Kirim QR ke satu peserta dan perbarui status_kirim_qr. Aman dipanggil
// berkali-kali untuk peserta yang sama — dilewati kalau sedang diproses
// (mencegah kirim dobel kalau trigger instan & sweep berkala kebetulan
// menyentuh peserta yang sama secara bersamaan).
async function kirimKePeserta(pesertaId) {
  if (sedangDikirim.has(pesertaId)) return;
  sedangDikirim.add(pesertaId);

  try {
    const peserta = pesertaModel.findById(pesertaId);
    if (!peserta || peserta.status_kirim_qr !== 'pending' || peserta.nonaktif_at) return;

    const sesiList = pesertaModel.sesiUntukPeserta(pesertaId);
    const qrDataUrl = await generateQrDataUrl(peserta.qr_token);
    const caption = formatPesan(peserta, sesiList);

    await whatsapp.sendQr(peserta.no_hp, caption, qrDataUrl);
    pesertaModel.updateStatusKirim(pesertaId, 'sent');
    console.log(`[WA] Terkirim ke ${peserta.nama} (${peserta.no_hp})`);
  } catch (err) {
    console.error(`[WA] Gagal kirim untuk peserta ${pesertaId}:`, err.message);
    pesertaModel.updateStatusKirim(pesertaId, 'failed', err.message);
  } finally {
    sedangDikirim.delete(pesertaId);
  }
}

// Fire-and-forget: dipanggil setelah registrasi sukses agar WA terkirim
// hampir instan, TANPA membuat request registrasi menunggu (sesuai prinsip
// PRD bahwa pengiriman WA tidak boleh menghambat/menggagalkan registrasi).
function triggerKirim(pesertaId) {
  kirimKePeserta(pesertaId).catch(() => {
    // kirimKePeserta sudah menangani error di dalam (update status ke failed);
    // catch di sini murni jaga-jaga agar rejection tidak jadi unhandled.
  });
}

// Jaring pengaman: proses semua peserta yang masih pending secara berkala,
// jalan lambat (ada jeda antar-kirim) untuk hindari rate-limit WhatsApp.
// Menangkap kasus yang gagal di-trigger instan (mis. app baru restart) dan
// import CSV massal (yang sengaja tidak di-trigger satu-satu).
async function prosesAntrianPending() {
  const antrian = pesertaModel.pendingQueue();
  if (antrian.length === 0) return;
  console.log(`[WA] ${antrian.length} peserta dalam antrian pending.`);
  for (const peserta of antrian) {
    await kirimKePeserta(peserta.id);
    await sleep(env.wa.sendDelayMs);
  }
}

function mulaiSweepBerkala() {
  setInterval(() => {
    prosesAntrianPending().catch((err) => console.error('[WA] Gagal proses antrian:', err.message));
  }, env.wa.pollIntervalMs);
}

module.exports = { kirimKePeserta, triggerKirim, prosesAntrianPending, mulaiSweepBerkala };
