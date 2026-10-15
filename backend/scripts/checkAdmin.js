// Checks the admin panel features: live rides board, student suspension, safety
// reports, broadcast notices and the audit log — including that students can
// reach only their own two endpoints.
//   node scripts/checkAdmin.js http://localhost:4000
// Start that server with EXPOSE_DEV_OTP=true, no SMTP, ADMIN_EMAILS containing
// CHECK_ADMIN_EMAIL, and a FRESH MOCK_DB_FILE.
const assert = require('assert');

const BASE = (process.argv[2] || 'http://localhost:4000') + '/api';
const ADMIN_EMAIL = process.env.CHECK_ADMIN_EMAIL || 'vehicle.admin@spit.ac.in';

// The admin password is never hardcoded here - pass it in the environment.
function requiredPassword() {
  const pw = process.env.CHECK_ADMIN_PASSWORD;
  if (!pw) throw new Error('Set CHECK_ADMIN_PASSWORD to the admin password before running this check');
  return pw;
}

const run = Date.now().toString(36);

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function login(name) {
  const email = `${name}.${run}@spit.ac.in`;
  const { data } = await call('POST', '/auth/send-otp', { email });
  assert.ok(data.devCode, 'run the server with EXPOSE_DEV_OTP=true and no SMTP');
  return (await call('POST', '/auth/verify-otp', { email, code: data.devCode })).data;
}

const at = (min) => new Date(Date.now() + min * 60000).toISOString();
const slot = 120 + Math.floor(Math.random() * 900);

(async () => {
  // Staff sign in with a password, never a code.
  const adminRes = await call('POST', '/auth/admin-login', { email: ADMIN_EMAIL, password: requiredPassword() });
  assert.equal(adminRes.status, 200, `admin login failed: ${JSON.stringify(adminRes.data)}`);
  const admin = adminRes.data;
  assert.equal(admin.user.isAdmin, true);

  const [rider, other] = await Promise.all([login('a.rider'), login('a.other')]);

  // --- students can't reach the panel -------------------------------------
  for (const path of ['/admin/rides', '/admin/students', '/admin/reports', '/admin/notices', '/admin/audit']) {
    assert.equal((await call('GET', path, null, rider.token)).status, 403, `${path} must be staff-only`);
  }

  // --- a real ride to work with -------------------------------------------
  const req1 = (await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText: 'Ghatkopar', pickupTime: at(slot) }, rider.token)).data;
  const group = (await call('POST', '/groups/join', { rideRequestId: req1.id, memberRideRequestIds: [req1.id] }, rider.token)).data;
  const req2 = (await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText: 'Andheri', pickupTime: at(slot + 2) }, other.token)).data;
  const match = (await call('GET', `/rides/matches?rideRequestId=${req2.id}&kind=auto`, null, other.token)).data.groups.find((g) => g.id === group.id);
  assert.ok(match, 'second rider should be offered the open group');
  assert.equal((await call('POST', '/groups/join', { rideRequestId: req2.id, memberRideRequestIds: match.memberRideRequestIds }, other.token)).status, 201);

  // --- live rides board ----------------------------------------------------
  const board = (await call('GET', '/admin/rides', null, admin.token)).data.rides;
  const row = board.find((r) => r.id === group.id);
  assert.ok(row, 'the new ride shows on the board');
  assert.equal(row.members.length, 2);
  assert.equal(row.members.every((m) => m.boarded === false && m.paid === false), true, 'board shows boarded/paid state');
  assert.ok(row.pickupName && row.dropName && row.pickupTime, 'board rows carry route and time');

  // Unassigning a driver frees the auto for another ride.
  assert.equal((await call('GET', `/groups/${group.id}/driver`, null, rider.token)).status, 200);
  const withDriver = (await call('GET', '/admin/rides', null, admin.token)).data.rides.find((r) => r.id === group.id);
  assert.ok(withDriver.driver?.plateNumber, 'board shows the assigned auto');
  assert.equal((await call('POST', `/admin/rides/${group.id}/unassign-driver`, { reason: 'check' }, admin.token)).status, 200);
  const unassigned = (await call('GET', '/admin/rides', null, admin.token)).data.rides.find((r) => r.id === group.id);
  assert.equal(unassigned.driver, null, 'driver cleared');

  // --- safety reports ------------------------------------------------------
  assert.equal((await call('POST', `/admin/reports/groups/${group.id}`, { category: 'unsafe driving', message: 'Driver was on the phone the whole way.' }, rider.token)).status, 201);
  const outsider = await login('a.outsider');
  assert.equal((await call('POST', `/admin/reports/groups/${group.id}`, { category: 'other', message: 'I was not even on this ride.' }, outsider.token)).status >= 400, true, 'only riders of that group can report it');

  const openReports = (await call('GET', '/admin/reports', null, admin.token)).data.reports;
  assert.equal(openReports.length, 1);
  assert.equal(openReports[0].status, 'open');
  const resolved = await call('PATCH', `/admin/reports/${openReports[0].id}`, { status: 'resolved', resolution: 'Spoke to the driver' }, admin.token);
  assert.equal(resolved.data.status, 'resolved');
  assert.equal((await call('PATCH', `/admin/reports/${openReports[0].id}`, { status: 'dismissed' }, admin.token)).status, 409, 'a closed report cannot be reopened');

  // --- students ------------------------------------------------------------
  const list = (await call('GET', '/admin/students', null, admin.token)).data.students;
  const mine = list.find((s) => s.id === rider.user.id);
  assert.ok(mine, 'student appears in the list');
  assert.equal(mine.rides >= 1, true, 'their ride count is real');
  assert.equal(mine.suspended, false);

  const suspended = await call('PATCH', `/admin/students/${rider.user.id}/status`, { suspended: true, reason: 'repeated no-shows' }, admin.token);
  assert.equal(suspended.data.suspended, true);
  assert.equal(suspended.data.suspendedReason, 'repeated no-shows');
  assert.equal((await call('PATCH', `/admin/students/${rider.user.id}/status`, { suspended: false }, admin.token)).data.suspended, false);

  // --- notices -------------------------------------------------------------
  assert.deepEqual((await call('GET', '/admin/notices/active', null, rider.token)).data.notices, [], 'no notices yet');
  const notice = await call('POST', '/admin/notices', { message: 'No autos after 10pm tonight', level: 'warning' }, admin.token);
  assert.equal(notice.status, 201);
  const seen = (await call('GET', '/admin/notices/active', null, rider.token)).data.notices;
  assert.equal(seen.length, 1, 'students see the notice');
  assert.equal(seen[0].message, 'No autos after 10pm tonight');
  const expired = await call('POST', '/admin/notices', { message: 'Already over', expiresAt: at(-5) }, admin.token);
  assert.equal(expired.status, 201);
  assert.equal((await call('GET', '/admin/notices/active', null, rider.token)).data.notices.length, 1, 'an expired notice is not shown');
  assert.equal((await call('DELETE', `/admin/notices/${notice.data.id}`, null, admin.token)).status, 200);
  assert.equal((await call('GET', '/admin/notices/active', null, rider.token)).data.notices.length, 0);

  // --- cancelling a ride ---------------------------------------------------
  const cancelled = await call('POST', `/admin/rides/${group.id}/cancel`, { reason: 'test' }, admin.token);
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.data));
  assert.equal(cancelled.data.riders, 2);
  assert.equal((await call('POST', `/admin/rides/${group.id}/cancel`, {}, admin.token)).status, 409, 'cannot cancel twice');
  assert.ok(!(await call('GET', '/admin/rides', null, admin.token)).data.rides.some((r) => r.id === group.id), 'a cancelled ride leaves the board');

  // --- audit log -----------------------------------------------------------
  const actions = (await call('GET', '/admin/audit', null, admin.token)).data.actions;
  const kinds = actions.map((a) => a.action);
  for (const expected of ['ride.cancel', 'ride.unassign_driver', 'student.suspend', 'student.reinstate', 'report.resolved', 'notice.post', 'notice.remove']) {
    assert.ok(kinds.includes(expected), `audit log should record ${expected} (got ${kinds.join(', ')})`);
  }
  assert.ok(actions.every((a) => a.admin === ADMIN_EMAIL && a.at), 'every entry says who and when');

  console.log('admin features check passed');
})().catch((e) => { console.error(e); process.exit(1); });
