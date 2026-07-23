// Dipakai bersama oleh form registrasi publik (/register) dan form tambah
// peserta manual oleh admin (/admin/peserta/tambah) — keduanya butuh perilaku
// yang sama: daftar sesi scrollable, dan sesi yang bentrok waktu otomatis
// ter-disable begitu sesi lain yang tumpang tindih sudah dicentang.
function initSesiPicker(sesiList) {
  function overlaps(aMulai, aSelesai, bMulai, bSelesai) {
    return aMulai < bSelesai && bMulai < aSelesai;
  }

  function applyState() {
    const rows = Array.from(sesiList.querySelectorAll('[data-sesi-id]'));
    const checkedBoxes = rows
      .map((r) => r.querySelector('input[type=checkbox]'))
      .filter((cb) => cb.checked);

    rows.forEach((row) => {
      const cb = row.querySelector('input[type=checkbox]');
      const badge = row.querySelector('.sesi-badge');
      const full = row.dataset.full === '1';

      if (cb.checked) {
        cb.disabled = false;
        badge.textContent = 'Dipilih';
        badge.className = 'badge bg-primary sesi-badge';
        return;
      }

      const bentrok = checkedBoxes.some((other) =>
        overlaps(cb.dataset.mulai, cb.dataset.selesai, other.dataset.mulai, other.dataset.selesai)
      );

      if (full) {
        cb.disabled = true;
        badge.textContent = 'Penuh';
        badge.className = 'badge bg-danger sesi-badge';
      } else if (bentrok) {
        cb.disabled = true;
        badge.textContent = 'Bentrok';
        badge.className = 'badge bg-warning sesi-badge';
      } else {
        cb.disabled = false;
        badge.textContent = 'Sisa ' + row.dataset.sisa;
        badge.className = 'badge bg-success sesi-badge';
      }
    });
  }

  sesiList.addEventListener('change', (e) => {
    if (e.target.matches('input[type=checkbox]')) applyState();
  });

  // Refresh sisa kuota secara berkala agar user tahu jika sesi baru saja penuh.
  async function refreshKuota() {
    try {
      const res = await fetch('/api/public/sesi');
      const { data } = await res.json();
      data.forEach((s) => {
        const row = sesiList.querySelector(`[data-sesi-id="${s.id}"]`);
        if (!row) return;
        row.dataset.full = s.sisa <= 0 ? '1' : '0';
        row.dataset.sisa = s.sisa;
      });
      applyState();
    } catch (e) { /* abaikan kegagalan refresh, form tetap bisa submit */ }
  }

  sesiList.querySelectorAll('[data-sesi-id]').forEach((row) => {
    row.dataset.sisa = row.querySelector('.sesi-badge').textContent.replace(/\D/g, '');
  });
  applyState();
  setInterval(refreshKuota, 15000);
}

document.addEventListener('DOMContentLoaded', () => {
  const sesiList = document.getElementById('sesi-list');
  if (sesiList) initSesiPicker(sesiList);
});
