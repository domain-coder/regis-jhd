const env = require('../config/env');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstile(token, remoteIp) {
  if (!env.turnstile.secretKey) return true; // fitur nonaktif jika belum dikonfigurasi
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.turnstile.secretKey,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Verifikasi Turnstile gagal (network):', err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
