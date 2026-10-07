const { createPool } = require('../db');
const { backup } = require('../backend/backups');
(async () => {
  const pool = createPool();
  try {
    const file = await backup(pool, process.env.DB_NAME || 'travelms');
    console.log(
      file
        ? `Saved private backup: ${file}`
        : 'No business tables were found. Run npm run setup first.',
    );
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error('Backup failed:', error.message);
  process.exitCode = 1;
});
