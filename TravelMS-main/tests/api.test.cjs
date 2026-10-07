const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { databaseOptions, createPool } = require('../db');
const { migrate } = require('../backend/schema');
const { createApp } = require('../backend/app');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PDFDocument, PDFName } = require('pdf-lib');
const { PNG_RECEIPT } = require('./fixtures.cjs');
const { backup, readBackup, restore, validateSnapshot } = require('../backend/backups');

const database = `waypoint_test_${process.pid}_${Date.now()}`;
let connection, pool, server, base, alice, bob, admin;
const account = (email) => ({
  first_name: 'Test',
  last_name: 'Traveler',
  email,
  phone_number: '',
  password: 'Testing2026!',
  role: 'USER',
});
const tripData = (overrides) => ({
  destination: 'Test destination',
  start_date: '2027-05-01',
  end_date: '2027-05-05',
  purpose: 'API verification',
  estimated_budget: 500,
  status: 'PLANNED',
  ...overrides,
});
async function request(path, method = 'GET', body, actor, extra = {}) {
  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
    ...extra,
  };
  const response = await fetch(base + path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    headers: response.headers,
  };
}
async function createTrip(actor, overrides = {}, approved = false) {
  const created = await request('/trips', 'POST', tripData(overrides), actor);
  assert.equal(created.status, 201);
  if (approved)
    assert.equal(
      (
        await request(
          `/trips/${created.data.trip_id}/status`,
          'PATCH',
          { status: 'APPROVED' },
          admin,
        )
      ).status,
      200,
    );
  return created.data.trip_id;
}
async function uploadReceipt(
  id,
  actor,
  content = PNG_RECEIPT,
  name = 'receipt.png',
  type = 'image/png',
) {
  const form = new FormData();
  form.append('receipt', new Blob([content], { type }), name);
  const response = await fetch(`${base}/expenses/${id}/receipt`, {
    method: 'PUT',
    headers: actor?.cookie ? { Cookie: actor.cookie } : {},
    body: form,
  });
  return { status: response.status, data: await response.json() };
}
const expenseData = (trip_id) => ({
  trip_id,
  category: 'FLIGHT',
  amount: 12.5,
  expense_date: '2027-05-02',
  description: 'Test expense',
  receipt_url: '',
});
before(async () => {
  connection = await mysql.createConnection(databaseOptions(null));
  await connection.query(`CREATE DATABASE \`${database}\``);
  pool = createPool(database);
  await migrate(pool);
  await pool.query(
    "INSERT INTO users (first_name,last_name,email,role,password_hash) VALUES ('Test','Owner','admin@example.invalid','ADMIN',?)",
    [await bcrypt.hash('Testing2026!', 10)],
  );
  server = createApp(pool, { rateLimit: false, logErrors: false }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  admin = await request('/auth/login', 'POST', {
    email: 'admin@example.invalid',
    password: 'Testing2026!',
  });
  alice = await request('/auth/register', 'POST', account('alice@example.invalid'));
  bob = await request('/auth/register', 'POST', account('bob@example.invalid'));
  assert.equal(admin.status, 200);
  assert.equal(alice.status, 201);
  assert.equal(bob.status, 201);
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (connection) {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.query(`DROP DATABASE IF EXISTS \`${database}_legacy\``);
    await connection.end();
  }
});

test('all business data and writes require a valid server session', async () => {
  for (const path of ['/users', '/trips', '/expenses', '/reports', '/reports/1/export', '/auth/me'])
    assert.equal((await request(path)).status, 401, path);
  for (const path of ['/users', '/trips', '/expenses', '/reports'])
    assert.equal((await request(path, 'POST', {})).status, 401, path);
  assert.equal((await request('/trips/1/status', 'PATCH', { status: 'APPROVED' })).status, 401);
  assert.equal((await request('/health')).data.status, 'ok');
});
test('registration cannot escalate roles, validates passwords and handles duplicate emails', async () => {
  assert.equal(
    (await request('/auth/register', 'POST', { ...account('evil@example.invalid'), role: 'ADMIN' }))
      .status,
    403,
  );
  assert.equal(
    (
      await request('/auth/register', 'POST', {
        ...account('short@example.invalid'),
        password: '123',
      })
    ).status,
    400,
  );
  const duplicate = await request('/auth/register', 'POST', account('alice@example.invalid'));
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.data.error, /already exists/);
  assert.equal(alice.data.role, 'USER');
  assert.equal('password_hash' in alice.data, false);
  assert.match(alice.headers.get('set-cookie'), /HttpOnly/);
  assert.match(alice.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal(
    (await request('/auth/me', 'GET', undefined, alice)).data.user_id,
    alice.data.user_id,
  );
  assert.equal(
    (await request('/auth/login', 'POST', { email: alice.data.email, password: 'wrong' })).status,
    401,
  );
});
test('traveler cannot access user administration or forged ownership', async () => {
  assert.equal((await request('/users', 'GET', undefined, alice)).status, 403);
  assert.equal(
    (
      await request(
        '/users',
        'POST',
        { ...account('fake-admin@example.invalid'), role: 'ADMIN' },
        alice,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request('/trips', 'POST', tripData({ user_id: bob.data.user_id }), alice)).status,
    403,
  );
  assert.equal(
    (await request('/trips', 'POST', tripData({ status: 'APPROVED' }), alice)).status,
    403,
  );
});
test('trip validation rejects missing dates, reversed dates, negative budgets and excessive precision', async () => {
  for (const invalid of [
    { start_date: '' },
    { start_date: '2027-02-30' },
    { end_date: '2027-04-01' },
    { estimated_budget: -1 },
    { estimated_budget: 1.005 },
    { destination: '' },
  ]) {
    assert.equal(
      (await request('/trips', 'POST', tripData(invalid), alice)).status,
      400,
      JSON.stringify(invalid),
    );
  }
});
test('trips support pending edit, secure approval, revision and valid transitions', async () => {
  const id = await createTrip(alice);
  assert.equal(
    (await request(`/trips/${id}`, 'PUT', tripData({ destination: 'Updated destination' }), alice))
      .status,
    200,
  );
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'APPROVED' }, alice)).status,
    403,
  );
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'Approved' }, admin)).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/status`,
        'PATCH',
        { status: 'REJECTED', comment: 'Please adjust the plan.' },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(`/trips/${id}`, 'PUT', tripData({ status: 'REJECTED' }), alice)).status,
    200,
  );
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'APPROVED' }, admin)).status,
    200,
  );
  assert.equal((await request(`/trips/${id}`, 'PUT', tripData(), alice)).status, 403);
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'COMPLETED' }, admin)).status,
    200,
  );
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'APPROVED' }, admin)).status,
    409,
  );
});
test('data lists and writes isolate travelers on the server', async () => {
  const id = await createTrip(bob, { destination: 'Private Bob journey' }, true);
  const expense = await request('/expenses', 'POST', expenseData(id), bob);
  const report = await request('/reports', 'POST', { trip_id: id }, bob);
  assert.equal(expense.status, 201);
  assert.equal(report.status, 201);
  assert.equal(
    (await request('/trips', 'GET', undefined, alice)).data.some((t) => t.trip_id === id),
    false,
  );
  assert.equal(
    (await request('/expenses', 'GET', undefined, alice)).data.some(
      (e) => e.expense_id === expense.data.expense_id,
    ),
    false,
  );
  assert.equal(
    (await request('/reports', 'GET', undefined, alice)).data.some(
      (r) => r.report_id === report.data.report_id,
    ),
    false,
  );
  assert.equal(
    (await request(`/trips?user_id=${bob.data.user_id}`, 'GET', undefined, alice)).status,
    403,
  );
  assert.equal((await request(`/trips/${id}`, 'PUT', tripData(), alice)).status, 403);
  assert.equal((await request(`/trips/${id}`, 'DELETE', undefined, alice)).status, 403);
  assert.equal(
    (await request(`/expenses/${expense.data.expense_id}`, 'PUT', expenseData(id), alice)).status,
    403,
  );
  assert.equal(
    (await request(`/expenses/${expense.data.expense_id}`, 'DELETE', undefined, alice)).status,
    403,
  );
  assert.equal((await request('/reports', 'POST', { trip_id: id }, alice)).status, 403);
  assert.equal(
    (await request(`/reports/${report.data.report_id}/export`, 'GET', undefined, alice)).status,
    403,
  );
  assert.equal(
    (await request(`/reports/${report.data.report_id}`, 'DELETE', undefined, alice)).status,
    403,
  );
});
test('all five expense categories work and invalid money, dates, ownership and links are rejected', async () => {
  const id = await createTrip(alice, {}, true);
  for (const category of ['FLIGHT', 'LODGING', 'FOOD', 'TRANSPORT', 'OTHER']) {
    assert.equal(
      (await request('/expenses', 'POST', { ...expenseData(id), category }, alice)).status,
      201,
      category,
    );
  }
  for (const invalid of [
    { amount: -1 },
    { amount: 0 },
    { amount: 1.234 },
    { expense_date: '' },
    { expense_date: '2027-05-06' },
    { category: 'Hotel' },
    { user_id: bob.data.user_id },
    { receipt_url: 'javascript:alert(1)' },
  ]) {
    assert.equal(
      (await request('/expenses', 'POST', { ...expenseData(id), ...invalid }, alice)).status,
      400,
      JSON.stringify(invalid),
    );
  }
  const pending = await createTrip(alice);
  assert.equal((await request('/expenses', 'POST', expenseData(pending), alice)).status, 409);
});
test('report generation, snapshot totals, CSV formula escaping and approval workflow work end to end', async () => {
  const id = await createTrip(alice, { destination: 'Report verification' }, true);
  const first = await request(
    '/expenses',
    'POST',
    { ...expenseData(id), description: '=SUM(A1:A9)' },
    alice,
  );
  await request('/expenses', 'POST', { ...expenseData(id), category: 'FOOD' }, alice);
  assert.equal(
    (await request('/reports', 'POST', { trip_id: id, generated_by: admin.data.user_id }, alice))
      .status,
    403,
  );
  const generated = await request('/reports', 'POST', { trip_id: id }, alice);
  assert.equal(generated.status, 201);
  assert.equal(generated.data.total_expenses, 25);
  assert.equal(generated.data.report_status, 'GENERATED');
  assert.equal(
    (
      await request(
        `/expenses/${first.data.expense_id}`,
        'PUT',
        { ...expenseData(id), amount: 20 },
        alice,
      )
    ).status,
    200,
  );
  const reports = (await request('/reports', 'GET', undefined, alice)).data;
  const saved = reports.find((r) => r.report_id === generated.data.report_id);
  assert.equal(saved.total_expenses, 25);
  assert.equal(saved.snapshot.expenses[0].amount, 12.5);
  const exported = await request(
    `/reports/${generated.data.report_id}/export`,
    'GET',
    undefined,
    alice,
  );
  assert.equal(exported.status, 200);
  assert.match(exported.data, /25\.00/);
  assert.match(exported.data, /'=SUM/);
  assert.match(exported.headers.get('content-disposition'), /attachment/);
  assert.equal(
    (
      await request(
        `/reports/${generated.data.report_id}/status`,
        'PATCH',
        { status: 'SUBMITTED' },
        alice,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/reports/${generated.data.report_id}/status`,
        'PATCH',
        { status: 'APPROVED' },
        alice,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/reports/${generated.data.report_id}/status`,
        'PATCH',
        { status: 'APPROVED' },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(`/reports/${generated.data.report_id}`, 'DELETE', undefined, alice)).status,
    403,
  );
  assert.equal((await request(`/trips/${id}`, 'DELETE', undefined, admin)).status, 409);
});
test('missing records return 404 and cross-site mutations return 403', async () => {
  for (const [path, method, body] of [
    ['/trips/999999/status', 'PATCH', { status: 'APPROVED' }],
    ['/trips/999999', 'PUT', tripData()],
    ['/expenses/999999', 'DELETE'],
    ['/reports/999999/export', 'GET'],
    ['/reports/999999', 'DELETE'],
    ['/users/999999', 'DELETE'],
  ])
    assert.equal((await request(path, method, body, admin)).status, 404, path);
  assert.equal(
    (await request('/trips', 'POST', tripData(), alice, { Origin: 'https://attacker.example' }))
      .status,
    403,
  );
  assert.equal((await request('/missing-endpoint')).status, 404);
  assert.equal(
    (await request('/trips/bad-id/status', 'PATCH', { status: 'APPROVED' }, admin)).status,
    400,
  );
});
test('self-service profiles cannot change identity or role and persist avatar choices', async () => {
  const profile = {
    first_name: 'Profile',
    last_name: 'Traveler',
    phone_number: '555-0100',
    avatar_key: 'leaf',
  };
  assert.equal((await request('/profile', 'PUT', profile)).status, 401);
  for (const extra of [
    { role: 'ADMIN' },
    { user_id: bob.data.user_id },
    { email: 'other@example.invalid' },
    { avatar_key: 'https://example.invalid/avatar.svg' },
  ]) {
    assert.equal((await request('/profile', 'PUT', { ...profile, ...extra }, alice)).status, 400);
  }
  const saved = await request('/profile', 'PUT', profile, alice);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.role, 'USER');
  assert.equal(saved.data.email, alice.data.email);
  assert.equal(saved.data.avatar_key, 'leaf');
  assert.equal('password_hash' in saved.data, false);
  alice.data = saved.data;
  assert.equal((await request('/auth/me', 'GET', undefined, alice)).data.first_name, 'Profile');
  assert.equal((await request('/auth/me', 'GET', undefined, bob)).data.first_name, 'Test');
});

test('password changes validate the current password, rotate the session and revoke other sessions', async () => {
  const other = await request('/auth/login', 'POST', {
    email: alice.data.email,
    password: 'Testing2026!',
  });
  const input = {
    current_password: 'Testing2026!',
    new_password: 'Changed2026!',
    confirm_password: 'Changed2026!',
  };
  assert.equal((await request('/auth/change-password', 'POST', input)).status, 401);
  assert.equal(
    (await request('/auth/change-password', 'POST', { ...input, current_password: 'wrong' }, alice))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        '/auth/change-password',
        'POST',
        { ...input, confirm_password: 'different' },
        alice,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        '/auth/change-password',
        'POST',
        { ...input, new_password: 'short', confirm_password: 'short' },
        alice,
      )
    ).status,
    400,
  );
  assert.equal((await request('/auth/me', 'GET', undefined, other)).status, 200);
  const old = { ...alice };
  const changed = await request('/auth/change-password', 'POST', input, alice);
  assert.equal(changed.status, 200);
  assert.notEqual(changed.cookie, old.cookie);
  assert.match(changed.headers.get('set-cookie'), /HttpOnly/);
  alice.cookie = changed.cookie;
  assert.equal((await request('/auth/me', 'GET', undefined, alice)).status, 200);
  assert.equal((await request('/auth/me', 'GET', undefined, old)).status, 401);
  assert.equal((await request('/auth/me', 'GET', undefined, other)).status, 401);
  assert.equal(
    (await request('/auth/login', 'POST', { email: alice.data.email, password: 'Testing2026!' }))
      .status,
    401,
  );
  assert.equal(
    (await request('/auth/login', 'POST', { email: alice.data.email, password: 'Changed2026!' }))
      .status,
    200,
  );
});

test('trip details and itinerary enforce ownership, dates and read-only completed trips', async () => {
  const id = await createTrip(alice, {}, true);
  const input = {
    item_date: '2027-05-03',
    start_time: '09:30',
    kind: 'ACTIVITY',
    title: 'Design workshop',
    location: 'Conference center',
    notes: 'Bring a notebook.',
  };
  assert.equal((await request(`/trips/${id}`)).status, 401);
  assert.equal((await request(`/trips/${id}`, 'GET', undefined, bob)).status, 403);
  assert.equal((await request(`/trips/${id}/itinerary`, 'POST', input, bob)).status, 403);
  for (const invalid of [
    { item_date: '2027-05-06' },
    { start_time: '24:30' },
    { kind: 'BAD' },
    { title: '' },
    { notes: 'x'.repeat(2001) },
  ]) {
    assert.equal(
      (await request(`/trips/${id}/itinerary`, 'POST', { ...input, ...invalid }, alice)).status,
      400,
    );
  }
  const created = await request(`/trips/${id}/itinerary`, 'POST', input, alice);
  assert.equal(created.status, 201);
  const itemId = created.data.item_id;
  const detail = (await request(`/trips/${id}`, 'GET', undefined, alice)).data;
  assert.equal(detail.itinerary[0].title, input.title);
  assert.equal(detail.trip.user_id, alice.data.user_id);
  assert.equal(detail.history[0].event_type, 'ITINERARY_CREATED');
  assert.equal(
    (await request(`/trips/${id}`, 'PUT', tripData({ end_date: '2027-05-02' }), admin)).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/itinerary/${itemId}`,
        'PUT',
        { ...input, title: 'Updated workshop' },
        bob,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/itinerary/${itemId}`,
        'PUT',
        { ...input, title: 'Updated workshop' },
        alice,
      )
    ).status,
    200,
  );
  assert.equal((await request(`/trips/${id}/itinerary/999999`, 'PUT', input, alice)).status, 404);
  assert.equal(
    (await request(`/trips/${id}/itinerary/${itemId}`, 'DELETE', undefined, alice)).status,
    200,
  );
  const after = (await request(`/trips/${id}`, 'GET', undefined, alice)).data;
  assert.equal(after.itinerary.length, 0);
  assert.equal(after.history[0].event_type, 'ITINERARY_DELETED');
  await request(`/trips/${id}/status`, 'PATCH', { status: 'COMPLETED' }, admin);
  assert.equal((await request(`/trips/${id}/itinerary`, 'POST', input, alice)).status, 409);
});

test('review comments are required for revisions and history records verified actors and resubmission', async () => {
  const id = await createTrip(alice);
  assert.equal(
    (await request(`/trips/${id}/status`, 'PATCH', { status: 'REJECTED' }, admin)).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/status`,
        'PATCH',
        { status: 'REJECTED', comment: 'x'.repeat(1001) },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/status`,
        'PATCH',
        { status: 'REJECTED', comment: 'Change the dates.' },
        alice,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        `/trips/${id}/status`,
        'PATCH',
        {
          status: 'REJECTED',
          comment: 'Explain the workshop purpose.',
          actor_id: alice.data.user_id,
        },
        admin,
      )
    ).status,
    200,
  );
  const review = (await request(`/trips/${id}`, 'GET', undefined, alice)).data.history;
  assert.equal(review.length, 2);
  assert.equal(review[0].comment, 'Explain the workshop purpose.');
  assert.equal(review[0].actor_id, admin.data.user_id);
  assert.equal(review[0].actor_role, 'ADMIN');
  assert.equal(review[0].from_status, 'PLANNED');
  assert.equal(review[0].to_status, 'REJECTED');
  assert.equal(
    (
      await request(
        `/trips/${id}`,
        'PUT',
        tripData({ status: 'REJECTED', purpose: 'Workshop learning goals' }),
        alice,
      )
    ).status,
    200,
  );
  await request(
    `/trips/${id}/status`,
    'PATCH',
    { status: 'APPROVED', comment: 'Approved with the updated purpose.' },
    admin,
  );
  const history = (await request(`/trips/${id}`, 'GET', undefined, alice)).data.history;
  assert.deepEqual(
    history.map((e) => e.event_type),
    ['STATUS_CHANGED', 'RESUBMITTED', 'STATUS_CHANGED', 'CREATED'],
  );
  assert.equal(history[1].actor_id, alice.data.user_id);
  assert.equal(history[1].actor_name, 'Profile Traveler');
});

test('budget alerts use exact cent thresholds and never divide by zero', async () => {
  const id = await createTrip(alice, { estimated_budget: 100 }, true);
  const expense = await request('/expenses', 'POST', { ...expenseData(id), amount: 79.99 }, alice);
  async function summary() {
    return (await request(`/trips/${id}`, 'GET', undefined, alice)).data.trip.budget;
  }
  assert.equal((await summary()).state, 'ON_TRACK');
  assert.equal((await summary()).used_percent, 79.99);
  for (const [amount, state, remaining] of [
    [80, 'NEAR', 20],
    [100, 'NEAR', 0],
    [100.01, 'OVER', -0.01],
  ]) {
    assert.equal(
      (
        await request(
          `/expenses/${expense.data.expense_id}`,
          'PUT',
          { ...expenseData(id), amount },
          alice,
        )
      ).status,
      200,
    );
    const budget = await summary();
    assert.equal(budget.state, state);
    assert.equal(budget.remaining, remaining);
  }
  assert.equal((await summary()).overrun, 0.01);
  const listed = (await request('/trips', 'GET', undefined, alice)).data.find(
    (t) => t.trip_id === id,
  );
  assert.equal(listed.budget.state, 'OVER');
  const zero = await createTrip(alice, { estimated_budget: 0 }, true);
  let budget = (await request(`/trips/${zero}`, 'GET', undefined, alice)).data.trip.budget;
  assert.equal(budget.state, 'UNSET');
  assert.equal(budget.used_percent, null);
  await request('/expenses', 'POST', expenseData(zero), alice);
  budget = (await request(`/trips/${zero}`, 'GET', undefined, alice)).data.trip.budget;
  assert.equal(budget.state, 'OVER');
  assert.equal(budget.used_percent, null);
});

test('private receipts validate image content and enforce ownership before uploads and downloads', async () => {
  const id = await createTrip(alice, {}, true);
  const expense = (await request('/expenses', 'POST', expenseData(id), alice)).data.expense_id;
  assert.equal((await uploadReceipt(expense, undefined)).status, 401);
  assert.equal((await uploadReceipt(expense, bob)).status, 403);
  assert.equal(
    (await uploadReceipt(expense, alice, Buffer.from('<html>not an image</html>'))).status,
    400,
  );
  assert.equal(
    (await uploadReceipt(expense, alice, PNG_RECEIPT, 'file.svg', 'image/svg+xml')).status,
    400,
  );
  assert.equal(
    (await uploadReceipt(expense, alice, PNG_RECEIPT, 'file.jpg', 'image/jpeg')).status,
    400,
  );
  assert.equal(
    (await uploadReceipt(expense, alice, Buffer.alloc(5 * 1024 * 1024 + 1))).status,
    413,
  );
  const saved = await uploadReceipt(expense, alice);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.receipt_type, 'image/png');
  const rows = (await request('/expenses', 'GET', undefined, alice)).data;
  assert.equal(rows.find((row) => row.expense_id === expense).receipt_name, 'receipt.png');
  assert.equal(
    rows.some((row) => Object.hasOwn(row, 'content')),
    false,
  );
  for (const actor of [alice, admin]) {
    const response = await fetch(`${base}/expenses/${expense}/receipt`, {
      headers: { Cookie: actor.cookie },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /image\/png/);
    assert.match(response.headers.get('content-security-policy'), /sandbox/);
    assert.match(response.headers.get('content-disposition'), /^inline/);
    assert.equal(
      Buffer.from(await response.arrayBuffer())
        .subarray(1, 4)
        .toString(),
      'PNG',
    );
  }
  assert.equal((await request(`/expenses/${expense}/receipt`, 'GET', undefined, bob)).status, 403);
  assert.equal(
    (await request(`/expenses/${expense}/receipt`, 'DELETE', undefined, bob)).status,
    403,
  );
  const downloaded = await fetch(`${base}/expenses/${expense}/receipt?download=1`, {
    headers: { Cookie: alice.cookie },
  });
  assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
  await downloaded.arrayBuffer();
  assert.equal(
    (await request(`/expenses/${expense}/receipt`, 'DELETE', undefined, alice)).status,
    200,
  );
  assert.equal(
    (await request(`/expenses/${expense}/receipt`, 'GET', undefined, alice)).status,
    404,
  );
});
test('PDF receipts reject malformed and active documents, can be replaced and cascade with expenses', async () => {
  const id = await createTrip(alice, {}, true);
  const expense = (await request('/expenses', 'POST', expenseData(id), alice)).data.expense_id;
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const plain = Buffer.from(await pdf.save());
  assert.equal(
    (
      await uploadReceipt(
        expense,
        alice,
        Buffer.from('%PDF-not-valid'),
        'receipt.pdf',
        'application/pdf',
      )
    ).status,
    400,
  );
  pdf.catalog.set(
    PDFName.of('OpenAction'),
    pdf.context.obj({ S: PDFName.of('JavaScript'), JS: pdf.context.obj('alert(1)') }),
  );
  assert.equal(
    (
      await uploadReceipt(
        expense,
        alice,
        Buffer.from(await pdf.save()),
        'active.pdf',
        'application/pdf',
      )
    ).status,
    400,
  );
  assert.equal(
    (await uploadReceipt(expense, alice, plain, 'receipt.pdf', 'application/pdf')).status,
    200,
  );
  assert.equal((await uploadReceipt(expense, alice)).status, 200);
  const [[count]] = await pool.query(
    'SELECT COUNT(*) AS total FROM expense_receipts WHERE expense_id=?',
    [expense],
  );
  assert.equal(count.total, 1);
  assert.equal((await request(`/expenses/${expense}`, 'DELETE', undefined, alice)).status, 200);
  const [[deleted]] = await pool.query(
    'SELECT COUNT(*) AS total FROM expense_receipts WHERE expense_id=?',
    [expense],
  );
  assert.equal(deleted.total, 0);
});
test('PDF exports preserve saved report values, paginate and enforce access', async () => {
  // Escaped non-Latin text preserves international font coverage in an English source file.
  const unicodeDestination = '\u8bfe\u7a0b\u5c55\u793a - Montreal';
  const id = await createTrip(
    alice,
    { destination: unicodeDestination, purpose: 'A saved report with Unicode names' },
    true,
  );
  for (let n = 0; n < 28; n++)
    await request(
      '/expenses',
      'POST',
      {
        ...expenseData(id),
        description:
          'A detailed expense description with enough text to wrap into several lines. '.repeat(2),
        amount: 10,
      },
      alice,
    );
  const created = await request('/reports', 'POST', { trip_id: id }, alice);
  const reportId = created.data.report_id;
  assert.equal((await request(`/reports/${reportId}/pdf`, 'GET', undefined, bob)).status, 403);
  assert.equal((await request(`/reports/${reportId}/pdf`)).status, 401);
  const response = await fetch(`${base}/reports/${reportId}/pdf`, {
    headers: { Cookie: alice.cookie },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.match(response.headers.get('content-disposition'), /waypoint-report-\d+\.pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  const pages = (await PDFDocument.load(bytes)).getPageCount();
  assert.ok(
    pages >= 2 && pages <= 4,
    'Expected useful pagination without trailing footer-only pages',
  );
  const [[report]] = await pool.query('SELECT * FROM reports WHERE report_id=?', [reportId]);
  assert.equal(report.total_expenses, 280);
  assert.equal(report.snapshot.trip.destination, unicodeDestination);
  await request('/expenses', 'POST', expenseData(id), alice);
  const [[unchanged]] = await pool.query(
    'SELECT total_expenses,snapshot FROM reports WHERE report_id=?',
    [reportId],
  );
  assert.equal(unchanged.total_expenses, 280);
  assert.equal(unchanged.snapshot.expenses.length, 28);
});
test('backup and recovery preserve records, hashes and receipt bytes without overwriting databases', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'waypoint-backup-test-'));
  const target = database + '_recovered';
  let recovered;
  try {
    const id = await createTrip(alice, {}, true);
    const expense = (await request('/expenses', 'POST', expenseData(id), alice)).data.expense_id;
    assert.equal((await uploadReceipt(expense, alice)).status, 200);
    const file = await backup(pool, database, directory);
    assert.equal((await fs.stat(file)).mode & 0o077, 0);
    const snapshot = await readBackup(file);
    assert.equal(Object.hasOwn(snapshot.tables, 'auth_sessions'), false);
    assert.throws(() =>
      validateSnapshot({ ...snapshot, tables: { ...snapshot.tables, unexpected: { rows: [] } } }),
    );
    const corrupt = structuredClone(snapshot);
    corrupt.tables.expense_receipts.rows[0].content.data[0] ^= 1;
    assert.throws(() => validateSnapshot(corrupt), /checksum/);
    // Arbitrary backup DDL must never be executed by recovery.
    snapshot.tables.users.ddl = 'DROP DATABASE travelms';
    const result = await restore(snapshot, target);
    assert.equal(result.counts.users, snapshot.tables.users.rows.length);
    recovered = createPool(target);
    const [[user]] = await recovered.query('SELECT password_hash FROM users WHERE user_id=?', [
      alice.data.user_id,
    ]);
    assert.equal(
      user.password_hash,
      snapshot.tables.users.rows.find((row) => row.user_id === alice.data.user_id).password_hash,
    );
    const [[receipt]] = await recovered.query(
      'SELECT content,sha256 FROM expense_receipts WHERE expense_id=?',
      [expense],
    );
    const saved = snapshot.tables.expense_receipts.rows.find((row) => row.expense_id === expense);
    assert.deepEqual(receipt.content, Buffer.from(saved.content.data));
    assert.equal(receipt.sha256, saved.sha256);
    const [[sessions]] = await recovered.query('SELECT COUNT(*) AS total FROM auth_sessions');
    assert.equal(sessions.total, 0);
    await assert.rejects(restore(snapshot, target), /already exists/);
    await assert.rejects(restore(snapshot, database), /new database/);
    await assert.rejects(restore(snapshot, 'travelms'), /new database/);
    const [[source]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    assert.equal(source.total, snapshot.tables.users.rows.length);
  } finally {
    if (recovered) await recovered.end();
    await connection.query('DROP DATABASE IF EXISTS ??', [target]);
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('admin updates revoke stale sessions and self-deletion is prevented', async () => {
  assert.equal(
    (await request(`/users/${admin.data.user_id}`, 'DELETE', undefined, admin)).status,
    409,
  );
  assert.equal(
    (
      await request(
        `/users/${bob.data.user_id}`,
        'PUT',
        { ...account(bob.data.email), role: 'ADMIN', password: '' },
        admin,
      )
    ).status,
    200,
  );
  assert.equal((await request('/auth/me', 'GET', undefined, bob)).status, 401);
  const login = await request('/auth/login', 'POST', {
    email: bob.data.email,
    password: 'Testing2026!',
  });
  assert.equal(login.status, 200);
  assert.equal((await request('/auth/logout', 'POST', {}, login)).status, 200);
  assert.equal((await request('/auth/me', 'GET', undefined, login)).status, 401);
});
test('legacy database migration preserves records, normalizes values and disables default-password fallback', async () => {
  await connection.query(`CREATE DATABASE \`${database}_legacy\``);
  const legacy = createPool(database + '_legacy');
  let legacyServer;
  try {
    await legacy.query(
      'CREATE TABLE users (user_id INT AUTO_INCREMENT PRIMARY KEY,first_name VARCHAR(50),last_name VARCHAR(50),email VARCHAR(100) UNIQUE,role VARCHAR(50),phone_number VARCHAR(20))',
    );
    await legacy.query(
      "INSERT INTO users (first_name,last_name,email,role) VALUES ('Original','Record','legacy@example.invalid','Employee')",
    );
    await migrate(legacy);
    await legacy.query(
      "INSERT INTO trips (user_id,destination,start_date,end_date,purpose,status,estimated_budget) VALUES (1,'Preserved place','2027-05-01','2027-05-05','Original record','Pending',100)",
    );
    await legacy.query(
      "INSERT INTO expenses (trip_id,user_id,category,amount,expense_date) VALUES (1,1,'Hotel',10,'2027-05-02')",
    );
    await migrate(legacy);
    const [[user]] = await legacy.query('SELECT * FROM users WHERE user_id=1');
    const [[trip]] = await legacy.query('SELECT * FROM trips WHERE trip_id=1');
    const [[expense]] = await legacy.query('SELECT * FROM expenses WHERE expense_id=1');
    assert.equal(user.first_name, 'Original');
    assert.equal(user.role, 'USER');
    assert.equal(user.password_hash, null);
    assert.equal(trip.destination, 'Preserved place');
    assert.equal(trip.status, 'PLANNED');
    assert.equal(expense.category, 'LODGING');
    assert.equal(expense.amount, 10);
    legacyServer = createApp(legacy, { rateLimit: false, logErrors: false }).listen(0, '127.0.0.1');
    await new Promise((resolve) => legacyServer.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${legacyServer.address().port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'legacy@example.invalid', password: 'admin' }),
    });
    assert.equal(response.status, 401);
  } finally {
    if (legacyServer) await new Promise((resolve) => legacyServer.close(resolve));
    await legacy.end();
  }
});
