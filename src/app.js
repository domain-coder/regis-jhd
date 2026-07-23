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
const hermesRoutes = require('./routes/hermes');
const absensiRoutes = require('./routes/absensi');
const { requireAuth } = require('./middleware/auth');
const eventModel = require('./models/eventModel');
const sesiModel = require('./models/sesiModel');
const pesertaModel = require('./models/pesertaModel');

const app = express();

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
    antrianHermes: pesertaModel.pendingQueue().length,
  };
  res.render('admin/dashboard', { title: 'Dashboard', event, stats });
});

app.use('/admin', requireAuth, adminEventRoutes);
app.use('/admin', requireAuth, adminRuanganRoutes);
app.use('/admin', requireAuth, adminSesiRoutes);
app.use('/admin', requireAuth, adminPesertaRoutes);
app.use('/admin', requireAuth, adminLaporanRoutes);
app.use('/admin', requireAuth, adminUsersRoutes);
app.use('/api/hermes', hermesRoutes);
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
