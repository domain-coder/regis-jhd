const { z } = require('zod');

// Skema input dasar dipakai bersama oleh registrasi publik & tambah peserta
// manual admin — batas panjang untuk mencegah abuse, dan no_hp dibatasi
// ketat hanya angka (mencegah karakter/skrip disisipkan lewat field ini).
const namaSchema = z
  .string()
  .trim()
  .min(1, 'Nama wajib diisi')
  .max(150, 'Nama maksimal 150 karakter');

const noHpSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, '')) // izinkan spasi/tanda hubung umum saat mengetik
  .refine((v) => /^\+?[0-9]{8,15}$/.test(v), 'Nomor HP hanya boleh berisi angka (8-15 digit)');

const emailSchema = z
  .string()
  .trim()
  .max(200, 'Email maksimal 200 karakter')
  .email('Email tidak valid')
  .optional()
  .or(z.literal(''));

const institusiSchema = z
  .string()
  .trim()
  .max(200, 'Institusi maksimal 200 karakter')
  .optional();

module.exports = { namaSchema, noHpSchema, emailSchema, institusiSchema };
