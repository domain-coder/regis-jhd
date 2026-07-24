const path = require('path');
require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Environment variable ${name} wajib diisi (lihat .env.example)`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || './data/jhd26.sqlite'),
  sessionSecret: required('SESSION_SECRET'),
  // TURNSTILE_DISABLED membekukan Turnstile tanpa menyentuh site/secret key asli
  // (lihat scripts/toggle-turnstile.sh) — berguna saat butuh testing lewat curl/skrip
  // yang tidak bisa menyelesaikan challenge widget di browser sungguhan.
  turnstile: {
    siteKey: process.env.TURNSTILE_DISABLED === 'true' ? '' : process.env.TURNSTILE_SITE_KEY || '',
    secretKey: process.env.TURNSTILE_DISABLED === 'true' ? '' : process.env.TURNSTILE_SECRET_KEY || '',
  },
  wa: {
    phoneNumber: process.env.WA_PHONE_NUMBER || '',
    pollIntervalMs: parseInt(process.env.WA_POLL_INTERVAL_MS || '300000', 10),
    sendDelayMs: parseInt(process.env.WA_SEND_DELAY_MS || '4000', 10),
    authDir: path.resolve(process.cwd(), process.env.WA_AUTH_DIR || './data/wa-auth'),
  },
  seedAdmin: {
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    nama: process.env.SEED_ADMIN_NAMA || 'Super Admin',
  },
};
