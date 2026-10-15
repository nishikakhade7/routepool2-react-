// End-to-end check of vehicle maintenance against a running mock-DB backend:
//   node scripts/checkVehicles.js http://localhost:4000
// Start that server with EXPOSE_DEV_OTP=true, no SMTP, and ADMIN_EMAILS containing
// CHECK_ADMIN_EMAIL (default vehicle.admin@spit.ac.in).
//
// Point it at a FRESH database (MOCK_DB_FILE=/tmp/check.json): the ride section
// needs a free auto, and every assignment holds one until 30 min past its pickup,
// so repeated runs against one database exhaust the 7-auto demo fleet.
// The admin email must match the one the server was started with.
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

async function login(email) {
  const { data } = await call('POST', '/auth/send-otp', { email });
  assert.ok(data.devCode, `no devCode for ${email} - run the server with SMTP unset`);
  return (await call('POST', '/auth/verify-otp', { email, code: data.devCode })).data;
}

const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();

// Staff sign in with a password now; OTP is refused for admin addresses.
async function adminLogin() {
  const res = await call('POST', '/auth/admin-login', { email: ADMIN_EMAIL, password: requiredPassword() });
  assert.equal(res.status, 200, `admin login failed: ${JSON.stringify(res.data)}`);
  return res.data;
}

(async () => {
  const admin = await adminLogin();
  const rider = await login(`v.rider.${run}@spit.ac.in`);
  assert.equal(admin.user.isAdmin, true, `${ADMIN_EMAIL} must be in ADMIN_EMAILS`);
  assert.equal(rider.user.isAdmin, false);

  // Only admins see the panel.
  assert.equal((await call('GET', '/vehicles', null, rider.token)).status, 403);
  const list = await call('GET', '/vehicles', null, admin.token);
  assert.equal(list.status, 200);
  const vehicles = list.data.vehicles;
  assert.ok(vehicles.length > 0, 'seeded vehicles expected');

  // Start from a known fleet: every auto on the road with valid paperwork, so a
  // half-finished earlier run can't fail this one.
  for (const v of vehicles) {
    await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/status`, { status: 'active' }, admin.token);
    await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/documents`,
      { permit: iso(300), insurance: iso(300), puc: iso(300), fitness: iso(300) }, admin.token);
  }

  // Eligibility gate: expire a document and the auto comes off the road.
  // The check makes its own state, so it passes on a database that has been used.
  const subject = vehicles.find((v) => v.eligible) || vehicles[0];
  const expiredDoc = (await call('PATCH', `/vehicles/${encodeURIComponent(subject.plateNumber)}/documents`, { puc: iso(-3) }, admin.token)).data;
  assert.equal(expiredDoc.eligible, false, 'an expired PUC takes the auto off the road');
  assert.ok(/Expired puc/.test(expiredDoc.blockedReason), expiredDoc.blockedReason);

  // Renewing the document puts it back on the road; expiring soon = reminder.
  const renewed = await call('PATCH', `/vehicles/${encodeURIComponent(expiredDoc.plateNumber)}/documents`,
    { permit: iso(200), insurance: iso(200), puc: iso(200), fitness: iso(200) }, admin.token);
  assert.equal(renewed.status, 200);
  assert.equal(renewed.data.eligible, true, 'valid documents -> eligible again');
  const soon = await call('PATCH', `/vehicles/${encodeURIComponent(expiredDoc.plateNumber)}/documents`, { insurance: iso(5) }, admin.token);
  assert.deepEqual(soon.data.expiringSoon, ['insurance'], 'a document due in 5 days is a reminder, not a block');
  assert.equal(soon.data.eligible, true, 'expiring soon still rides');

  // Self-inspection: submitted, approved, and then the rider-facing badge is current.
  const plate = encodeURIComponent(expiredDoc.plateNumber);
  assert.equal((await call('POST', `/vehicles/${plate}/inspections`, { photos: { tyres: 't.jpg', lights: 'l.jpg' } }, admin.token)).status, 400, 'all four photos required');
  const submitted = await call('POST', `/vehicles/${plate}/inspections`, { photos: { tyres: 't.jpg', lights: 'l.jpg', seats: 's.jpg', meter: 'm.jpg' } }, admin.token);
  assert.equal(submitted.status, 201);
  assert.equal(submitted.data.status, 'pending');
  const approved = await call('PATCH', `/vehicles/inspections/${submitted.data.id}`, { approve: true }, admin.token);
  assert.equal(approved.status, 200);
  assert.equal((await call('PATCH', `/vehicles/inspections/${submitted.data.id}`, { approve: true }, admin.token)).status, 409, 'cannot review twice');
  const afterInspection = (await call('GET', `/vehicles/${plate}`, null, admin.token)).data;
  assert.equal(afterInspection.inspection.current, true, 'approved inspection is current');
  assert.ok(afterInspection.inspection.inspectedOn, 'badge needs the inspection date');

  // Service log: a service long enough ago is overdue, and logging one clears it.
  const stale = (await call('POST', `/vehicles/${plate}/service`, { servicedOn: iso(-200) }, admin.token)).data;
  assert.equal(stale.service.overdueByDate, true, 'a service 200 days ago is overdue by date');
  assert.equal(stale.service.overdue, true);
  const overdue = stale;
  const serviced = await call('POST', `/vehicles/${encodeURIComponent(overdue.plateNumber)}/service`, {}, admin.token);
  assert.equal(serviced.status, 200);
  assert.equal(serviced.data.service.overdue, false, 'logging a service clears the flag');
  assert.equal(serviced.data.service.kmSinceService, 0, 'km counts from the last service');
  assert.equal((await call('POST', `/vehicles/${encodeURIComponent(overdue.plateNumber)}/service`, { servicedOn: iso(5) }, admin.token)).status, 400, 'no future service dates');

  // Suspension keeps an auto off the road even with valid documents.
  const suspended = await call('PATCH', `/vehicles/${plate}/status`, { status: 'suspended', reason: 'check' }, admin.token);
  assert.equal(suspended.data.eligible, false);
  assert.equal(suspended.data.blockedReason, 'Vehicle suspended');
  assert.equal((await call('PATCH', `/vehicles/${plate}/status`, { status: 'active' }, admin.token)).data.eligible, true);

  // --- a real ride: gate -> boarding -> km -> rider feedback -> suspension ----
  const roadworthy = new Set((await call('GET', '/vehicles', null, admin.token)).data.vehicles.filter((v) => v.eligible).map((v) => v.plateNumber));
  const offRoad = (await call('GET', '/vehicles', null, admin.token)).data.vehicles.filter((v) => !v.eligible).map((v) => v.plateNumber);

  const riders = [rider, await login(`v.r2.${run}@spit.ac.in`), await login(`v.r3.${run}@spit.ac.in`)];
  // Random slot well ahead, so this run doesn't collide with checkGrouping's riders.
  const pickupTime = new Date(Date.now() + (90 + Math.floor(Math.random() * 1000)) * 60000).toISOString();
  const reqOf = async (r, dropText) =>
    (await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText, pickupTime }, r.token)).data;

  const r1 = await reqOf(riders[0], 'Ghatkopar');
  const group = (await call('POST', '/groups/join', { rideRequestId: r1.id, memberRideRequestIds: [r1.id] }, riders[0].token)).data;
  for (const r of riders.slice(1)) {
    const req = await reqOf(r, 'Andheri');
    const match = (await call('GET', `/rides/matches?rideRequestId=${req.id}&kind=auto`, null, r.token)).data.groups.find((g) => g.id === group.id);
    assert.ok(match, 'rider should be offered the open group');
    assert.equal((await call('POST', '/groups/join', { rideRequestId: req.id, memberRideRequestIds: match.memberRideRequestIds }, r.token)).status, 201);
  }

  // Only the roadworthy auto can be assigned, and riders see its inspection badge.
  const driverRes = await call('GET', `/groups/${group.id}/driver`, null, riders[0].token);
  assert.equal(driverRes.status, 200, driverRes.data?.error?.details?.code === 'NO_DRIVER_AVAILABLE'
    ? 'every demo auto is busy or off the road - run this against a fresh MOCK_DB_FILE'
    : `driver assignment failed: ${JSON.stringify(driverRes.data)}`);
  const driver = driverRes.data;
  assert.ok(roadworthy.has(driver.plateNumber), `assigned ${driver.plateNumber}, which is not roadworthy`);
  assert.ok(!offRoad.includes(driver.plateNumber), 'an expired or suspended auto must never be assigned');
  const assignedPlate = encodeURIComponent(driver.plateNumber);
  assert.ok(driver.vehicleCheck, 'driver card carries the vehicle check');
  assert.equal(typeof driver.vehicleCheck.verified, 'boolean');

  // Boarding starts the ride, which puts the route distance on the odometer.
  const kmBefore = (await call('GET', `/vehicles/${assignedPlate}`, null, admin.token)).data.kmDriven;
  assert.equal((await call('POST', `/groups/${group.id}/board`, { code: riders[0].user.riderCode }, riders[0].token)).status, 200);
  const afterBoard = (await call('GET', `/vehicles/${assignedPlate}`, null, admin.token)).data;
  assert.ok(afterBoard.kmDriven > kmBefore, 'a started ride adds kilometres');

  // Rider feedback: complaints flag the auto, then take it off the road.
  const rate = (r, tags) => call('POST', `/vehicles/groups/${group.id}/feedback`, { cleanliness: 2, condition: 2, tags }, r.token);
  assert.equal((await rate(riders[0], ['dirty seats', 'meter not working'])).status, 201);
  assert.equal((await rate(riders[0], ['dirty seats'])).status, 409, 'one rating per rider per ride');
  const flagged = (await rate(riders[1], ['unsafe driving'])).data.vehicle;
  assert.ok(flagged.flaggedReason, '3 complaints flag the vehicle for inspection');
  assert.equal(flagged.eligible, true, 'flagging alone does not stop rides');
  const suspendedByRiders = (await rate(riders[2], ['dirty seats', 'poor condition'])).data.vehicle;
  assert.equal(suspendedByRiders.status, 'suspended', '5 complaints suspend the vehicle');
  assert.equal(suspendedByRiders.eligible, false);

  // With every auto off the road, a new group gets a clear "no driver" error.
  for (const v of (await call('GET', '/vehicles', null, admin.token)).data.vehicles) {
    await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/status`, { status: 'suspended', reason: 'check' }, admin.token);
  }
  const r4rider = await login(`v.r4.${run}@spit.ac.in`);
  const r4 = await reqOf(r4rider, 'Ghatkopar');
  const lone = await call('POST', '/groups/join', { rideRequestId: r4.id, memberRideRequestIds: [r4.id] }, r4rider.token);
  assert.equal(lone.status, 201, JSON.stringify(lone.data));
  const noDriver = await call('GET', `/groups/${lone.data.id}/driver`, null, r4rider.token);
  assert.equal(noDriver.status, 409, 'no roadworthy auto -> no assignment');

  // Put the fleet back.
  for (const v of (await call('GET', '/vehicles', null, admin.token)).data.vehicles) {
    await call('PATCH', `/vehicles/${encodeURIComponent(v.plateNumber)}/status`, { status: 'active' }, admin.token);
  }

  console.log('vehicle maintenance check passed');
})().catch((e) => { console.error(e); process.exit(1); });
