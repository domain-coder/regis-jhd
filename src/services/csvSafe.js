// Mitigasi CSV/formula injection (OWASP): jika sebuah sel diawali karakter
// yang bisa ditafsirkan sebagai formula oleh Excel/Google Sheets (=, +, -, @,
// atau tab/CR), beri prefix kutip tunggal agar dibaca sebagai teks biasa.
// Perlu karena nama/institusi berasal dari input publik yang tidak terpercaya.
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return value;
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function sanitizeCsvRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = sanitizeCsvCell(value);
  }
  return out;
}

module.exports = { sanitizeCsvCell, sanitizeCsvRow };
