function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('errors/403', { user: req.session.user });
    }
    next();
  };
}

function requireApiKey(req, res, next) {
  const env = require('../config/env');
  const key = req.header('X-API-Key');
  if (!key || key !== env.hermesApiKey) {
    return res.status(401).json({ error: 'Unauthorized: X-API-Key tidak valid' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireApiKey };
