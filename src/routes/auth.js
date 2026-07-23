const express = require('express');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const { verifyTurnstile } = require('../services/turnstile');
const env = require('../config/env');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('auth/login', { error: null, turnstileSiteKey: env.turnstile.siteKey });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const turnstileOk = await verifyTurnstile(req.body['cf-turnstile-response'], req.ip);
  if (!turnstileOk) {
    return res.status(400).render('auth/login', {
      error: 'Verifikasi keamanan gagal, silakan coba lagi.',
      turnstileSiteKey: env.turnstile.siteKey,
    });
  }

  const user = userModel.findByUsername(String(username || '').trim());

  if (!user || !user.active || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).render('auth/login', {
      error: 'Username atau password salah.',
      turnstileSiteKey: env.turnstile.siteKey,
    });
  }

  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = {
      id: user.id,
      nama: user.nama,
      username: user.username,
      role: user.role,
    };
    const redirectTo = user.role === 'petugas' ? '/absensi/scan' : '/admin';
    res.redirect(redirectTo);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
