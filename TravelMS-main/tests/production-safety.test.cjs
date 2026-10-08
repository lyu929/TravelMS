const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertDemoSeedingAllowed, assertNoDemoAccounts } = require('../backend/production-safety');

test('production refuses demo seeding before database setup', () => {
  assert.throws(() => assertDemoSeedingAllowed({ NODE_ENV: 'production' }), /cannot be seeded/);
  assert.doesNotThrow(() => assertDemoSeedingAllowed({ NODE_ENV: 'development' }));
});

test('production refuses a database containing either local demo account', async () => {
  for (const email of ['owner@waypoint.local', 'traveler@waypoint.local']) {
    const pool = {
      query: async (_sql, emails) => [emails.includes(email) ? [{ user_id: 1 }] : []],
    };
    await assert.rejects(
      assertNoDemoAccounts(pool, { NODE_ENV: 'production' }),
      /demo accounts are present/,
    );
  }
});

test('production accepts a database without local demo accounts and never changes it', async () => {
  const statements = [];
  const pool = {
    query: async (sql) => {
      statements.push(sql);
      return [[]];
    },
  };
  await assertNoDemoAccounts(pool, { NODE_ENV: 'production' });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /^SELECT /);
});

test('development startup does not restrict local demonstration accounts', async () => {
  const pool = {
    query: async () => assert.fail('Development must not query for production accounts'),
  };
  await assertNoDemoAccounts(pool, { NODE_ENV: 'development' });
});
