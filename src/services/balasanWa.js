const eventModel = require('../models/eventModel');
const pesertaModel = require('../models/pesertaModel');
const whatsapp = require('./whatsapp');

// Peserta yang membalas pesan WA (apa pun isinya — sesuai instruksi di pesan
// QR) dianggap ingin membatalkan registrasinya. Data TIDAK dihapus, cuma
// ditandai nonaktif (lihat pesertaModel.nonaktifkan) supaya kuota sesi bebas
// tapi tetap bisa direaktivasi admin kalau balasan ternyata tidak disengaja.
async function tanganiBalasan({ noHp, text }) {
  try {
    const event = eventModel.getActive();
    const peserta = pesertaModel.findByNoHp(event.id, noHp);
    if (!peserta) return; // bukan nomor peserta terdaftar, abaikan

    if (peserta.nonaktif_at) {
      await whatsapp.kirimTeks(
        noHp,
        'Registrasi Anda memang sudah dinonaktifkan sebelumnya. Kalau ini keliru, ' +
          'hubungi panitia JHD26 untuk diaktifkan kembali.'
      );
      return;
    }

    pesertaModel.nonaktifkan(peserta.id, `Balasan WA: "${text.slice(0, 200)}"`);
    console.log(`[WA] Peserta ${peserta.nama} (${noHp}) menonaktifkan diri via balasan WA.`);

    await whatsapp.kirimTeks(
      noHp,
      `Baik, registrasi Anda (*${peserta.nama}*) sudah kami nonaktifkan dan kuota ` +
        `sesi sudah dibebaskan untuk peserta lain.\n\n` +
        `Kalau ini KELIRU / Anda memang mendaftar, segera hubungi panitia JHD26 agar ` +
        `diaktifkan kembali — data Anda tidak dihapus.`
    );
  } catch (err) {
    console.error('[WA] Gagal proses balasan:', err.message);
  }
}

module.exports = { tanganiBalasan };
