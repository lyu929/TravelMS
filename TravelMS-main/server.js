const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { createPool } = require('./db');
const { createApp } = require('./backend/app');
const { assertNoDemoAccounts } = require('./backend/production-safety');

async function start() {
  const pool = createPool();
  try {
    await assertNoDemoAccounts(pool);
    await pool.query('SELECT 1 FROM auth_sessions LIMIT 1');
    await pool.query('SELECT avatar_key FROM users LIMIT 1');
    await pool.query('SELECT 1 FROM itinerary_items LIMIT 1');
    await pool.query('SELECT 1 FROM trip_events LIMIT 1');
    await pool.query('SELECT 1 FROM expense_receipts LIMIT 1');
  } catch (error) {
    console.error(
      error.code === 'DEMO_ACCOUNTS_IN_PRODUCTION'
        ? error.message
        : 'Database is unavailable or needs setup. Check .env and run: npm run setup',
    );
    await pool.end();
    process.exitCode = 1;
    return;
  }
  const app = createApp(pool);
  const built = path.join(__dirname, 'dist', 'Waypoint', 'browser');
  if (fs.existsSync(path.join(built, 'index.html'))) {
    app.use(express.static(built));
    app.get('*', (req, res) => res.sendFile(path.join(built, 'index.html')));
  }
  const port = Number(process.env.PORT || 3000),
    host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () =>
    console.log(`Waypoint API ready at http://${host}:${port}`),
  );
  server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use.` : error.message);
    await pool.end();
    process.exitCode = 1;
  });
  let closing = false;
  function stop() {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
if (require.main === module)
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { start };
