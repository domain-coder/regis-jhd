const path = require('path');
const express = require('express');
const session = require('express-session');

const env = require('./config/env');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminEventRoutes = require('./routes/admin/events');
const adminRuanganRoutes = require('./routes/admin/ruangan');
const adminSesiRoutes = require('./routes/admin/sesi');
const adminPesertaRoutes = require('./routes/admin/peserta');
const adminLaporanRoutes = require('./routes/admin/laporan');
const adminUsersRoutes = require('./routes/admin/users');
const absensiRoutes = require('./routes/absensi');
const { requireAuth } = require('./middleware/auth');
const eventModel = require('./models/eventModel');
const sesiModel = require('./models/sesiModel');
const pesertaModel = require('./models/pesertaModel');
const whatsapp = require('./services/whatsapp');
const pengirimanWa = require('./services/pengirimanWa');

const app = express();

// Diperlukan agar cookie session `secure: true` berfungsi di balik reverse proxy/tunnel
// (mis. Cloudflare Tunnel) — proxy menerima HTTPS dari klien lalu meneruskan sebagai HTTP
// biasa ke app ini; trust proxy membuat Express membaca header X-Forwarded-Proto agar tetap
// tahu request aslinya HTTPS.
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    // In-memory session store: cukup untuk skala kecil (1-3 admin/panitia, event 2 hari).
    // Sesi akan hilang jika proses Node di-restart — dapat diterima untuk skala ini (lihat README).
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
      httpOnly: true,
      secure: env.nodeEnv === 'production',
    },
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.get('/', (req, res) => res.redirect('/register'));

app.use('/', authRoutes);
app.use('/', publicRoutes);

app.get('/admin', requireAuth, (req, res) => {
  const event = eventModel.getActive();
  const sesiList = sesiModel.listByEvent(event.id);
  const stats = {
    totalSesi: sesiList.length,
    totalPeserta: pesertaModel.list({ eventId: event.id }).length,
    antrianKirimWa: pesertaModel.pendingQueue().length,
  };
  res.render('admin/dashboard', { title: 'Dashboard', event, stats });
});

app.use('/admin', requireAuth, adminEventRoutes);
app.use('/admin', requireAuth, adminRuanganRoutes);
app.use('/admin', requireAuth, adminSesiRoutes);
app.use('/admin', requireAuth, adminPesertaRoutes);
app.use('/admin', requireAuth, adminLaporanRoutes);
app.use('/admin', requireAuth, adminUsersRoutes);
app.use('/', absensiRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Tidak Ditemukan' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('errors/500', {
    title: 'Error',
    message: env.nodeEnv === 'production' ? null : err.message,
  });
});

app.listen(env.port, () => {
  console.log(`JHD26 app berjalan di http://localhost:${env.port}`);
});

// Koneksi WA dimulai di background — server tetap menerima request HTTP
// walau WhatsApp masih connecting/pairing. Sweep berkala jadi jaring
// pengaman untuk peserta yang gagal ter-trigger instan (mis. saat app baru
// restart) dan untuk hasil impor CSV massal.
whatsapp.connect().catch((err) => console.error('[WA] Gagal konek:', err.message));
pengirimanWa.mulaiSweepBerkala();
