const fs = require('node:fs/promises');
const path = require('node:path');

async function migrate(pool) {
  const sql = await fs.readFile(path.join(__dirname, '..', 'setup.sql'), 'utf8');
  for (const statement of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  async function add(table, column, definition) {
    const [columns] = await pool.query('SHOW COLUMNS FROM ?? LIKE ?', [table, column]);
    if (!columns.length)
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
  await add('users', 'password_hash', 'VARCHAR(255) NULL');
  await add('users', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await add('users', 'avatar_key', "VARCHAR(20) NOT NULL DEFAULT 'initials'");
  await add('trips', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await add('expenses', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await add('reports', 'generated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await add('reports', 'approved_at', 'DATETIME NULL');
  await add('reports', 'owner_id', 'INT NULL');
  await add('reports', 'snapshot', 'JSON NULL');
  // Widen before translating legacy enums; never drop tables or records.
  await pool.query("ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL DEFAULT 'USER'");
  await pool.query("ALTER TABLE trips MODIFY status VARCHAR(32) NOT NULL DEFAULT 'PLANNED'");
  await pool.query('ALTER TABLE expenses MODIFY category VARCHAR(32) NULL');
  await pool.query('ALTER TABLE expenses MODIFY receipt_url VARCHAR(500) NULL');
  await pool.query(
    "ALTER TABLE reports MODIFY report_status VARCHAR(32) NOT NULL DEFAULT 'GENERATED'",
  );
  await pool.query(
    "UPDATE users SET role = CASE WHEN UPPER(role) = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END",
  );
  await pool.query(`UPDATE trips SET status = CASE UPPER(status)
    WHEN 'PENDING' THEN 'PLANNED' WHEN 'PLANNED' THEN 'PLANNED'
    WHEN 'IN PROGRESS' THEN 'APPROVED' ELSE UPPER(status) END`);
  await pool.query(`UPDATE expenses SET category = CASE UPPER(category)
    WHEN 'HOTEL' THEN 'LODGING' WHEN 'MEALS' THEN 'FOOD'
    ELSE COALESCE(UPPER(category), 'OTHER') END`);
  await pool.query(
    "UPDATE reports SET report_status = CASE WHEN UPPER(report_status) = 'PENDING' THEN 'GENERATED' ELSE UPPER(report_status) END",
  );
  await pool.query(
    'UPDATE reports r LEFT JOIN trips t ON r.trip_id=t.trip_id SET r.owner_id=COALESCE(t.user_id,r.generated_by) WHERE r.owner_id IS NULL',
  );
}
module.exports = { migrate };
