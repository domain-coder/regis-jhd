const express = require('express');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('auth/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = userModel.findByUsername(String(username || '').trim());

  if (!user || !user.active || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).render('auth/login', { error: 'Username atau password salah.' });
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
