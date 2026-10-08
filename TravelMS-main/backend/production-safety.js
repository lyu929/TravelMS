const DEMO_EMAILS = ['owner@waypoint.local', 'traveler@waypoint.local'];

function assertDemoSeedingAllowed(env = process.env) {
  if (env.NODE_ENV === 'production')
    throw new Error(
      'Demo accounts cannot be seeded in production. Use independently provisioned accounts.',
    );
}

async function assertNoDemoAccounts(pool, env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const [accounts] = await pool.query(
    'SELECT user_id FROM users WHERE email IN (?,?) LIMIT 1',
    DEMO_EMAILS,
  );
  if (accounts.length) {
    const error = new Error(
      'Production startup refused: local demo accounts are present. Review their data and replace them before deployment.',
    );
    error.code = 'DEMO_ACCOUNTS_IN_PRODUCTION';
    throw error;
  }
}

module.exports = { assertDemoSeedingAllowed, assertNoDemoAccounts };
