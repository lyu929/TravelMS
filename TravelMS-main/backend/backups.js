const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { databaseOptions, createPool } = require('../db');
const { migrate } = require('./schema');
const TABLES = {
  users: [
    'user_id',
    'first_name',
    'last_name',
    'email',
    'password_hash',
    'role',
    'phone_number',
    'avatar_key',
    'created_at',
  ],
  trips: [
    'trip_id',
    'user_id',
    'destination',
    'start_date',
    'end_date',
    'purpose',
    'status',
    'estimated_budget',
    'created_at',
  ],
  expenses: [
    'expense_id',
    'trip_id',
    'user_id',
    'category',
    'amount',
    'expense_date',
    'description',
    'receipt_url',
    'created_at',
  ],
  reports: [
    'report_id',
    'trip_id',
    'generated_by',
    'owner_id',
    'total_expenses',
    'report_status',
    'snapshot',
    'generated_at',
    'approved_at',
  ],
  itinerary_items: [
    'item_id',
    'trip_id',
    'item_date',
    'start_time',
    'kind',
    'title',
    'location',
    'notes',
    'created_at',
  ],
  trip_events: [
    'event_id',
    'trip_id',
    'actor_id',
    'actor_name',
    'actor_role',
    'event_type',
    'from_status',
    'to_status',
    'comment',
    'created_at',
  ],
  expense_receipts: [
    'receipt_id',
    'expense_id',
    'file_name',
    'media_type',
    'byte_size',
    'sha256',
    'content',
    'created_at',
  ],
};

async function backup(pool, database, directory = path.join(__dirname, '..', '.local', 'backups')) {
  const connection = await pool.getConnection();
  let snapshot;
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const [available] = await connection.query('SHOW TABLES');
    const names = new Set(available.map((row) => Object.values(row)[0]));
    snapshot = { format_version: 2, database, created_at: new Date().toISOString(), tables: {} };
    for (const name of Object.keys(TABLES)) {
      if (!names.has(name)) continue;
      const [[ddl]] = await connection.query('SHOW CREATE TABLE ??', [name]);
      const [rows] = await connection.query('SELECT * FROM ??', [name]);
      snapshot.tables[name] = { ddl: ddl['Create Table'], rows };
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (!Object.keys(snapshot.tables).length) return null;
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(
    directory,
    `${database}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.json`,
  );
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
  return file;
}

function validateSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.database !== 'string' ||
    !snapshot.tables ||
    typeof snapshot.tables !== 'object' ||
    !snapshot.tables.users ||
    !snapshot.tables.trips
  )
    throw new Error('This is not a Waypoint database backup.');
  if (snapshot.format_version !== undefined && snapshot.format_version !== 2)
    throw new Error('Unsupported backup version.');
  for (const [name, table] of Object.entries(snapshot.tables)) {
    if (!TABLES[name] || !Array.isArray(table?.rows))
      throw new Error('The backup contains unsupported tables or records.');
    const seen = new Set();
    for (const row of table.rows) {
      const primary = TABLES[name][0];
      if (
        !row ||
        typeof row !== 'object' ||
        !Number.isSafeInteger(row[primary]) ||
        row[primary] < 1 ||
        seen.has(row[primary])
      )
        throw new Error('The backup contains invalid or duplicate record identifiers.');
      seen.add(row[primary]);
      // Saved DDL is documentation only. Never execute SQL supplied by a backup file.
      if (name === 'expense_receipts') {
        if (
          !['image/png', 'image/jpeg', 'application/pdf'].includes(row.media_type) ||
          typeof row.file_name !== 'string' ||
          !row.file_name ||
          row.file_name.length > 100 ||
          /[\x00-\x1f/\\]/.test(row.file_name) ||
          !/^[a-f0-9]{64}$/.test(row.sha256)
        )
          throw new Error('A receipt metadata record is invalid.');
        const content = row.content;
        if (
          content?.type !== 'Buffer' ||
          !Array.isArray(content.data) ||
          content.data.length !== row.byte_size ||
          content.data.length > 5 * 1024 * 1024 ||
          content.data.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
        )
          throw new Error('A receipt in the backup is invalid.');
        if (
          crypto.createHash('sha256').update(Buffer.from(content.data)).digest('hex') !== row.sha256
        )
          throw new Error('A receipt checksum does not match the backup.');
      }
    }
  }
  return Object.fromEntries(
    Object.entries(snapshot.tables).map(([name, table]) => [name, table.rows.length]),
  );
}
async function readBackup(file) {
  const stat = await fs.stat(file);
  if (stat.size > 256 * 1024 * 1024)
    throw new Error('This backup exceeds the 256 MB restore limit.');
  const snapshot = JSON.parse(await fs.readFile(file, 'utf8'));
  validateSnapshot(snapshot);
  return snapshot;
}
async function restore(snapshot, target) {
  validateSnapshot(snapshot);
  if (
    typeof target !== 'string' ||
    !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(target) ||
    [
      'mysql',
      'sys',
      'information_schema',
      'performance_schema',
      process.env.DB_NAME || 'travelms',
      snapshot.database,
    ]
      .map((name) => name.toLowerCase())
      .includes(target.toLowerCase())
  )
    throw new Error('Choose a new database name different from your current and backup databases.');
  const admin = await mysql.createConnection(databaseOptions(null));
  let created = false,
    pool;
  try {
    const [[existing]] = await admin.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?',
      [target],
    );
    if (existing)
      throw new Error('The target database already exists. Restore only creates a new database.');
    await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [target]);
    created = true;
    pool = createPool(target);
    await migrate(pool);
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      for (const [name, allowed] of Object.entries(TABLES))
        for (const row of snapshot.tables[name]?.rows || []) {
          const fields = allowed.filter((field) => Object.hasOwn(row, field));
          const values = fields.map((field) => {
            const value = row[field];
            if (name === 'expense_receipts' && field === 'content') return Buffer.from(value.data);
            if (field === 'snapshot' && value !== null && typeof value === 'object')
              return JSON.stringify(value);
            return value;
          });
          await c.query(
            `INSERT INTO ?? (${fields.map(() => '??').join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
            [name, ...fields, ...values],
          );
        }
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
    await migrate(pool);
    const counts = {};
    for (const name of Object.keys(TABLES)) {
      const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM ??', [name]);
      counts[name] = row.total;
      if (row.total !== (snapshot.tables[name]?.rows.length || 0))
        throw new Error('Restored record count does not match the backup.');
    }
    // Sessions are deliberately absent: restored accounts must sign in again.
    return { database: target, counts };
  } catch (error) {
    if (pool) {
      await pool.end();
      pool = null;
    }
    if (created) await admin.query('DROP DATABASE ??', [target]);
    throw error;
  } finally {
    if (pool) await pool.end();
    await admin.end();
  }
}
module.exports = { backup, restore, readBackup, validateSnapshot, TABLES };
