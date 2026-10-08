const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { databaseOptions, createPool } = require('../db');
const { migrate } = require('../backend/schema');
const { backup } = require('../backend/backups');
const { assertDemoSeedingAllowed } = require('../backend/production-safety');

async function seedDemo(pool) {
  const accounts = [
    ['Project', 'Owner', 'owner@waypoint.local', 'ADMIN'],
    ['Alex', 'Taylor', 'traveler@waypoint.local', 'USER'],
  ];
  const ids = [];
  for (const [first, last, email, role] of accounts) {
    let [[user]] = await pool.query('SELECT user_id FROM users WHERE email=?', [email]);
    if (!user) {
      const [created] = await pool.query(
        'INSERT INTO users (first_name,last_name,email,role,password_hash,phone_number) VALUES (?,?,?,?,?,?)',
        [first, last, email, role, await bcrypt.hash('Waypoint2026!', 10), ''],
      );
      user = { user_id: created.insertId };
    }
    ids.push(user.user_id);
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  function day(offset) {
    const d = new Date(today + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  const trips = [
    ['San Francisco', 7, 10, 'Demo: Product design summit', 'APPROVED', 2400, 685],
    ['Seattle', 15, 18, 'Demo: Technology conference', 'PLANNED', 1800, 0],
    ['New York', 24, 28, 'Demo: Client workshop', 'APPROVED', 3600, 1120],
    ['Austin', -12, -9, 'Demo: Team offsite', 'COMPLETED', 1600, 890],
  ];
  for (const [destination, start, end, purpose, status, budget, spent] of trips) {
    const [[exists]] = await pool.query('SELECT trip_id FROM trips WHERE user_id=? AND purpose=?', [
      ids[1],
      purpose,
    ]);
    if (exists) continue;
    const [trip] = await pool.query(
      'INSERT INTO trips (user_id,destination,start_date,end_date,purpose,status,estimated_budget) VALUES (?,?,?,?,?,?,?)',
      [ids[1], destination, day(start), day(end), purpose, status, budget],
    );
    if (spent) {
      for (const [category, amount, description] of [
        ['FLIGHT', spent * 0.6, 'Round-trip airfare'],
        ['LODGING', spent * 0.3, 'Hotel reservation'],
        ['FOOD', spent * 0.1, 'Meals and coffee'],
      ]) {
        await pool.query(
          'INSERT INTO expenses (trip_id,user_id,category,amount,expense_date,description,receipt_url) VALUES (?,?,?,?,?,?,?)',
          [
            trip.insertId,
            ids[1],
            category,
            Math.round(amount * 100) / 100,
            day(start),
            description,
            '',
          ],
        );
      }
    }
  }
  console.log('Demo accounts: owner@waypoint.local / traveler@waypoint.local');
  console.log(
    'Password for newly created demo accounts: Waypoint2026! (existing passwords are unchanged).',
  );
}
async function main() {
  if (process.argv.includes('--demo')) assertDemoSeedingAllowed();
  const database = process.env.DB_NAME || 'travelms';
  if (!/^[a-zA-Z0-9_]+$/.test(database))
    throw new Error('DB_NAME must contain only letters, digits or underscores.');
  const connection = await mysql.createConnection(databaseOptions(null));
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
  } finally {
    await connection.end();
  }
  const pool = createPool(database);
  try {
    if (await backup(pool, database))
      console.log('Saved a private local database backup in .local/backups.');
    await migrate(pool);
    if (process.argv.includes('--demo')) await seedDemo(pool);
    console.log(`Waypoint database ${database} is ready. Existing records were preserved.`);
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  console.error('Setup failed:', error.message);
  process.exitCode = 1;
});
