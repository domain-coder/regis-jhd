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
  hermesApiKey: required('HERMES_API_KEY'),
  seedAdmin: {
    username: process.env.SEED_ADMIN_USERNAME || 'admin',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    nama: process.env.SEED_ADMIN_NAMA || 'Super Admin',
  },
};
