const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db.prepare('SELECT filename FROM schema_migrations').all().map((row) => row.filename)
);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  const runMigration = db.transaction(() => {
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
  });
  runMigration();
  console.log(`Migrated: ${file}`);
  count += 1;
}

console.log(count === 0 ? 'Tidak ada migration baru.' : `${count} migration berhasil dijalankan.`);
