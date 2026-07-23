const express = require('express');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const userModel = require('../../models/userModel');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

router.get('/users', requireRole('super_admin'), (req, res) => {
  res.render('admin/users/index', { title: 'User', userList: userModel.list(), error: null });
});

router.get('/users/tambah', requireRole('super_admin'), (req, res) => {
  res.render('admin/users/tambah', { title: 'Tambah User', error: null, form: {} });
});

const createSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  username: z.string().trim().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['super_admin', 'admin_event', 'petugas']),
});

router.post('/users', requireRole('super_admin'), (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/users/tambah', {
      title: 'Tambah User',
      error: parsed.error.issues[0].message,
      form: req.body,
    });
  }
  if (userModel.findByUsername(parsed.data.username)) {
    return res.status(400).render('admin/users/tambah', {
      title: 'Tambah User',
      error: 'Username sudah dipakai.',
      form: req.body,
    });
  }
  const passwordHash = bcrypt.hashSync(parsed.data.password, 10);
  userModel.create({
    nama: parsed.data.nama,
    username: parsed.data.username,
    passwordHash,
    role: parsed.data.role,
  });
  res.redirect('/admin/users');
});

const updateSchema = z.object({
  nama: z.string().trim().min(1, 'Nama wajib diisi'),
  role: z.enum(['super_admin', 'admin_event', 'petugas']),
  active: z.coerce.boolean().optional(),
});

router.post('/users/:id', requireRole('super_admin'), (req, res) => {
  const parsed = updateSchema.safeParse({ ...req.body, active: req.body.active === 'on' });
  if (!parsed.success) {
    return res.status(400).render('admin/users/index', {
      title: 'User',
      userList: userModel.list(),
      error: parsed.error.issues[0].message,
    });
  }
  userModel.update(req.params.id, parsed.data);
  res.redirect('/admin/users');
});

const passwordSchema = z.object({ password: z.string().min(6, 'Password minimal 6 karakter') });

router.post('/users/:id/reset-password', requireRole('super_admin'), (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).render('admin/users/index', {
      title: 'User',
      userList: userModel.list(),
      error: parsed.error.issues[0].message,
    });
  }
  userModel.updatePassword(req.params.id, bcrypt.hashSync(parsed.data.password, 10));
  res.redirect('/admin/users');
});

module.exports = router;
