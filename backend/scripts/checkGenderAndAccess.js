// Checks the gender rules (women-only groups, female-driver preference) and the
// admin lock on vehicle checks, including how they interact with the vehicle
// eligibility gate:
//   node scripts/checkGenderAndAccess.js http://localhost:4000
// Start that server with EXPOSE_DEV_OTP=true, no SMTP, ADMIN_EMAILS containing
// CHECK_ADMIN_EMAIL, and a FRESH MOCK_DB_FILE (driver assignment needs free autos).
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

async function login(name, preferences) {
  const email = `${name}.${run}@spit.ac.in`;
  const { data } = await call('POST', '/auth/send-otp', { email });
  assert.ok(data.devCode, 'run the server with EXPOSE_DEV_OTP=true and no SMTP');
  const session = (await call('POST', '/auth/verify-otp', { email, code: data.devCode })).data;
  if (preferences) {
    const saved = await call('PUT', '/auth/me/preferences', preferences, session.token);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
  }
  return session;
}

const at = (min) => new Date(Date.now() + min * 60000).toISOString();
const slot = 120 + Math.floor(Math.random() * 900); // far from other check scripts' riders

async function search(token, dropText, min = 0) {
  const req = (await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText, pickupTime: at(slot + min) }, token)).data;
  const groups = (await call('GET', `/rides/matches?rideRequestId=${req.id}&kind=auto`, null, token)).data.groups;
  return { req, groups };
}
const start = (token, req) => call('POST', '/groups/join', { rideRequestId: req.id, memberRideRequestIds: [req.id] }, token);

(async () => {
  const [woman, man, plainWoman] = await Promise.all([
    login('g.woman', { gender: 'female', womenOnlyGroups: true, driverPreference: 'female' }),
    login('g.man', { gender: 'male' }),
    login('g.woman2', { gender: 'female' }),
  ]);

  // --- admin lock on vehicle checks ---------------------------------------
  const adminSession = await login('x.ignored', null); // a plain student
  assert.equal(adminSession.user.isAdmin, false);
  for (const path of ['/vehicles', '/vehicles/MH%2002%20EK%204417']) {
    const res = await call('GET', path, null, woman.token);
    assert.equal(res.status, 403, `students must not read ${path}`);
    assert.ok(!res.data?.vehicles, 'no vehicle data leaks to a student');
  }
  assert.equal((await call('PATCH', '/vehicles/MH%2002%20EK%204417/status', { status: 'suspended' }, man.token)).status, 403, 'students cannot suspend an auto');
  assert.equal((await call('GET', '/vehicles', null, null)).status, 401, 'signed-out gets nothing');

  const staff = await login(ADMIN_EMAIL.split('@')[0].replace(/\..*/, '') === '' ? 'staff' : 'staff', null);
  assert.equal(staff.user.isAdmin, false, 'only ADMIN_EMAILS are staff');
  const adminRes = await call('POST', '/auth/admin-login', { email: ADMIN_EMAIL, password: requiredPassword() });
  assert.equal(adminRes.status, 200, `admin login failed: ${JSON.stringify(adminRes.data)}`);
  const adminSess = adminRes.data;
  assert.equal(adminSess.user.isAdmin, true, `${ADMIN_EMAIL} must be in ADMIN_EMAILS`);
  assert.equal((await call('GET', '/vehicles', null, adminSess.token)).status, 200, 'staff can read the panel');

  // --- women-only groups ---------------------------------------------------
  const w = await search(woman.token, 'Ghatkopar');
  const womenOnlyGroup = (await start(woman.token, w.req)).data;
  const womenOnlyView = (await call('GET', `/groups/${womenOnlyGroup.id}`, null, woman.token)).data;
  assert.equal(womenOnlyView.womenOnly, true, 'a women-only student starts a women-only group');

  // A male student must not see or join it.
  const m = await search(man.token, 'Andheri', 1);
  assert.ok(!m.groups.some((g) => g.id === womenOnlyGroup.id), 'men must not be offered a women-only group');
  const refused = await call('POST', `/groups/${womenOnlyGroup.id}/join`, null, man.token);
  assert.equal(refused.status >= 400, true, 'a man joining a women-only group is refused');
  assert.ok(/women-only/i.test(JSON.stringify(refused.data)), JSON.stringify(refused.data));

  // Another female student can.
  const w2 = await search(plainWoman.token, 'Andheri', 2);
  assert.ok(w2.groups.some((g) => g.id === womenOnlyGroup.id), 'a female student is offered the women-only group');
  const joined = await call('POST', '/groups/join', { rideRequestId: w2.req.id, memberRideRequestIds: w2.groups.find((g) => g.id === womenOnlyGroup.id).memberRideRequestIds }, plainWoman.token);
  assert.equal(joined.status, 201, JSON.stringify(joined.data));

  // --- female driver, and the vehicle gate on top of it --------------------
  const driver = await call('GET', `/groups/${womenOnlyGroup.id}/driver`, null, woman.token);
  assert.equal(driver.status, 200, JSON.stringify(driver.data));
  const assigned = (await call('GET', `/vehicles/${encodeURIComponent(driver.data.plateNumber)}`, null, adminSess.token)).data;
  assert.equal(assigned.gender, 'female', 'a women-only group must get a female driver');
  assert.equal(assigned.eligible, true, 'and that auto must be roadworthy');

  // Take every female driver's auto off the road: the women-only group can no
  // longer be served, and the refusal says so rather than assigning a man.
  const fleet = (await call('GET', '/vehicles', null, adminSess.token)).data.vehicles;
  const females = fleet.filter((v) => v.gender === 'female');
  assert.ok(females.length > 0, 'demo fleet needs a female driver');
  for (const v of females) await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/status`, { status: 'suspended', reason: 'check' }, adminSess.token);

  const w3 = await login('g.woman3', { gender: 'female', womenOnlyGroups: true });
  const r3 = await search(w3.token, 'Ghatkopar', 3);
  const g3 = (await start(w3.token, r3.req)).data;
  const noFemale = await call('GET', `/groups/${g3.id}/driver`, null, w3.token);
  assert.equal(noFemale.status, 409, 'no roadworthy female driver -> refuse, never substitute');
  assert.ok(/female/i.test(noFemale.data.error.message), noFemale.data.error.message);

  for (const v of females) await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/status`, { status: 'active' }, adminSess.token);

  console.log('gender rules + admin lock check passed');
})().catch((e) => { console.error(e); process.exit(1); });
