const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatTanggal(iso) {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

function formatJam(iso) {
  return (iso.split('T')[1] || '').slice(0, 5);
}

function labelSesi(s) {
  return {
    tanggal_label: formatTanggal(s.waktu_mulai),
    jam_label: `${formatJam(s.waktu_mulai)}–${formatJam(s.waktu_selesai)} WIB`,
  };
}

module.exports = { formatTanggal, formatJam, labelSesi };
