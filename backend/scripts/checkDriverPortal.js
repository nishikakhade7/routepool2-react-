// Checks the driver portal end to end: sign-in, documents + admin review,
// going online, getting a ride, accept, rider code, complete, decline, expiry.
//   node scripts/checkDriverPortal.js http://localhost:4000
// Start that server with EXPOSE_DEV_OTP=true, no SMTP, ADMIN_EMAILS containing
// CHECK_ADMIN_EMAIL, and a FRESH MOCK_DB_FILE (driver assignment needs free autos).
const assert = require('assert');

const BASE = (process.argv[2] || 'http://localhost:4000') + '/api';
const ADMIN_EMAIL = process.env.CHECK_ADMIN_EMAIL || 'vehicle.admin@spit.ac.in';
function requiredPassword() {
  const pw = process.env.CHECK_ADMIN_PASSWORD;
  if (!pw) throw new Error('Set CHECK_ADMIN_PASSWORD to the admin password before running this check');
  return pw;
}

const run = Date.now().toString(36);

async function call(method, path, body, token, raw) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(raw ? { 'content-type': raw.type, 'x-file-name': raw.name } : { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: raw ? raw.bytes : body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function student(name, preferences) {
  const email = `${name}.${run}@spit.ac.in`;
  const { data } = await call('POST', '/auth/send-otp', { email });
  assert.ok(data.devCode, 'run the server with EXPOSE_DEV_OTP=true and no SMTP');
  const session = (await call('POST', '/auth/verify-otp', { email, code: data.devCode })).data;
  if (preferences) await call('PUT', '/auth/me/preferences', preferences, session.token);
  return session;
}

async function driver(email) {
  const sent = await call('POST', '/drivers/auth/send-otp', { email });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const res = await call('POST', '/drivers/auth/verify-otp', { email, code: sent.data.demoCode });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data;
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const PDF = Buffer.from('%PDF-1.4\n%demo\n');
const upload = (token, type, bytes, mime, name) => call('PUT', `/drivers/me/documents/${type}`, null, token, { bytes, type: mime, name });

const at = (min) => new Date(Date.now() + min * 60000).toISOString();
const slot = 60 + Math.floor(Math.random() * 600);

async function bookSolo(session, dropText) {
  const req = (await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText, pickupTime: at(slot) }, session.token)).data;
  const group = (await call('POST', '/groups/join', { rideRequestId: req.id, memberRideRequestIds: [req.id] }, session.token)).data;
  const drv = await call('GET', `/groups/${group.id}/driver`, null, session.token);
  return { group, driver: drv };
}

(async () => {
  // --- sign-in ---------------------------------------------------------------
  assert.equal((await call('POST', '/drivers/auth/send-otp', { email: 'priya@spit.ac.in' })).status, 400, 'pattern enforced');
  assert.equal((await call('POST', '/drivers/auth/send-otp', { email: 'nobody.24@spit.ac.in' })).status, 404, 'roster enforced');
  const badCode = await call('POST', '/drivers/auth/verify-otp', { email: 'priya.24@spit.ac.in', code: '0000' });
  assert.equal(badCode.status, 400);

  const priya = await driver('priya.24@spit.ac.in');
  assert.match(priya.user.driverCode, /^RP-DRV-[A-Z0-9]{6}$/);
  const again = await driver('priya.24@spit.ac.in');
  assert.equal(again.user.driverCode, priya.user.driverCode, 'the ID never changes');
  assert.equal((await call('POST', '/drivers/auth/verify-otp', { email: 'priya.25@spit.ac.in', code: '2468' })).status, 409, 'one account per roster driver');

  // Driver and student tokens never cross over.
  const rider = await student('d.rider', { gender: 'female' });
  assert.equal((await call('GET', '/dashboard/stats', null, priya.token)).status, 401, 'driver token refused on student routes');
  assert.equal((await call('GET', '/drivers/me', null, rider.token)).status, 403, 'student token refused on driver routes');

  // --- documents + verification gate ------------------------------------------
  let me = (await call('GET', '/drivers/me', null, priya.token)).data;
  assert.equal(me.verification.verified, false);
  assert.equal((await call('PATCH', '/drivers/me/availability', { online: true }, priya.token)).status, 409, 'cannot go online unverified');

  assert.equal((await upload(priya.token, 'licence', Buffer.from('not a png'), 'image/png', 'x.png')).status, 400, 'content checked');
  assert.equal((await upload(priya.token, 'licence', Buffer.alloc(5 * 1024 * 1024 + 10, 1), 'application/pdf', 'big.pdf')).status, 400, '5 MB limit');
  assert.equal((await upload(priya.token, 'licence', PNG, 'image/png', 'licence.png')).status, 201);
  me = (await upload(priya.token, 'inspection_certificate', PDF, 'application/pdf', 'inspection.pdf')).data;
  assert.deepEqual(me.verification.documents.map((d) => d.current.state), ['pending', 'pending']);

  const admin = (await call('POST', '/auth/admin-login', { email: ADMIN_EMAIL, password: requiredPassword() })).data;
  assert.equal((await call('GET', '/drivers/admin/list', null, rider.token)).status, 403, 'students cannot review');
  let list = (await call('GET', '/drivers/admin/list', null, admin.token)).data;
  assert.equal(list.summary.pendingReviews, 2);
  for (const d of list.drivers[0].verification.documents) {
    assert.equal((await call('PATCH', `/drivers/admin/documents/${d.current.id}`, { approve: true }, admin.token)).status, 200);
  }
  me = (await call('PATCH', '/drivers/me/availability', { online: true }, priya.token)).data;
  assert.equal(me.online, true);
  assert.equal(me.verification.verified, true);

  // --- a ride goes to the online portal driver, then accept -> board -> complete --
  const booking = await bookSolo(rider, 'Ghatkopar');
  assert.equal(booking.driver.status, 200, JSON.stringify(booking.driver.data));
  assert.equal(booking.driver.data.plateNumber, 'MH 47 BX 3308', 'online portal driver is preferred');
  assert.equal(booking.driver.data.vehicleCheck.verified, true, 'approved certificate shows as verified to riders');

  const offers = (await call('GET', '/drivers/me/rides', null, priya.token)).data;
  const offer = offers.rides.find((r) => r.groupId === booking.group.id);
  assert.ok(offer, 'assigned ride is offered');
  assert.ok(offer.payout < offer.totalFare);
  assert.equal((await call('POST', `/drivers/me/rides/${offer.groupId}/accept`, {}, priya.token)).status, 200);
  assert.equal((await call('POST', `/drivers/me/trips/${offer.groupId}/complete`, {}, priya.token)).status, 409, 'cannot complete before boarding');
  assert.equal((await call('POST', `/drivers/me/trips/${offer.groupId}/heading`, {}, priya.token)).status, 200);
  assert.equal((await call('POST', `/drivers/me/trips/${offer.groupId}/board`, { code: '000000' === rider.user.riderCode ? '111111' : '000000' }, priya.token)).status, 400, 'wrong code');
  const boarded = await call('POST', `/drivers/me/trips/${offer.groupId}/board`, { code: rider.user.riderCode }, priya.token);
  assert.equal(boarded.status, 200, JSON.stringify(boarded.data));
  assert.equal(boarded.data.trip.status, 'started');
  assert.equal((await call('POST', `/drivers/me/trips/${offer.groupId}/complete`, {}, priya.token)).status, 200);
  const trips = (await call('GET', '/drivers/me/trips', null, priya.token)).data;
  assert.equal(trips.summary.completedTrips, 1);

  // --- decline hands the ride to someone else ----------------------------------
  const rider2 = await student('d.rider2');
  // Priya is busy with the first ride until it is over, so send her through
  // a second roster driver: Sunita signs in, gets verified, goes online.
  const sunita = await driver('sunita.23@spit.ac.in');
  await upload(sunita.token, 'licence', PNG, 'image/png', 'l.png');
  await upload(sunita.token, 'inspection_certificate', PDF, 'application/pdf', 'i.pdf');
  list = (await call('GET', '/drivers/admin/list', null, admin.token)).data;
  for (const d of list.drivers.find((x) => x.name === 'Sunita Jadhav').verification.documents) {
    await call('PATCH', `/drivers/admin/documents/${d.current.id}`, { approve: true }, admin.token);
  }
  await call('PATCH', '/drivers/me/availability', { online: true }, sunita.token);
  const second = await bookSolo(rider2, 'Ghatkopar');
  assert.equal(second.driver.data.plateNumber, 'MH 02 GK 5521');
  assert.equal((await call('POST', `/drivers/me/rides/${second.group.id}/decline`, {}, sunita.token)).status, 200);
  const after = (await call('GET', `/groups/${second.group.id}/driver`, null, rider2.token)).data;
  assert.notEqual(after.plateNumber, 'MH 02 GK 5521', 'declined ride goes to another driver');

  // --- expiry: reminder, then re-verification takes the driver offline ----------
  me = (await call('POST', '/drivers/me/dev/age-documents', { days: 160 }, sunita.token)).data;
  assert.equal(me.verification.verified, true);
  assert.equal(me.verification.reminder, true, 'reminder within 30 days of expiry');
  me = (await call('POST', '/drivers/me/dev/age-documents', { days: 30 }, sunita.token)).data;
  assert.equal(me.verification.verified, false);
  assert.equal(me.verification.reverificationRequired, true);
  assert.equal(me.online, false, 'expired documents switch the driver offline');
  assert.deepEqual(me.verification.documents.map((d) => d.current.state), ['expired', 'expired']);
  assert.equal((await call('GET', '/drivers/admin/list', null, admin.token)).data.summary.reverification.includes('Sunita Jadhav'), true);

  console.log('driver portal checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
