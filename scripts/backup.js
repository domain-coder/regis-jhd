const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const RETAIN = 48; // ~2 hari kalau backup tiap jam

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(BACKUP_DIR, `jhd26-${stamp}.sqlite`);

db.backup(dest)
  .then(() => {
    console.log(`Backup tersimpan: ${dest}`);

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('jhd26-') && f.endsWith('.sqlite'))
      .sort();
    const toDelete = files.slice(0, Math.max(0, files.length - RETAIN));
    toDelete.forEach((f) => fs.unlinkSync(path.join(BACKUP_DIR, f)));
    if (toDelete.length) console.log(`${toDelete.length} backup lama dihapus (retensi ${RETAIN}).`);

    process.exit(0);
  })
  .catch((err) => {
    console.error('Backup gagal:', err);
    process.exit(1);
  });
