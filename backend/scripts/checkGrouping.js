// End-to-end check of grouping against a running mock-DB backend:
//   node scripts/checkGrouping.js [http://localhost:4000]
const assert = require('assert');

const BASE = (process.argv[2] || 'http://localhost:4000') + '/api';
const VILE_PARLE = '00000000-0000-0000-0000-000000000006';
const SPIT = '00000000-0000-0000-0000-000000000001';
const run = Date.now().toString(36); // fresh users every run

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function login(name) {
  const email = `${name}.${run}@spit.ac.in`;
  const { data: { devCode } } = await call('POST', '/auth/send-otp', { email });
  return (await call('POST', '/auth/verify-otp', { email, code: devCode })).data.token;
}

// Random slot 1-20h ahead so leftovers from earlier runs don't match this one.
const pickupTime = new Date(Date.now() + (60 + Math.floor(Math.random() * 1140)) * 60000).toISOString();
const request = (t, time = pickupTime, drop = SPIT) =>
  call('POST', '/rides/request', { pickupNodeId: VILE_PARLE, dropNodeId: drop, pickupTime: time }, t);
const matches = async (t, id) => (await call('GET', `/rides/matches?rideRequestId=${id}`, null, t)).data.groups;

(async () => {
  const users = await Promise.all(['ga', 'gb', 'gc', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi'].map(login));

  // Past time rejected.
  assert.equal((await request(users[0], new Date(Date.now() - 10 * 60000).toISOString())).status, 400);

  // First rider: no matches, starts a solo group. Same slot twice = same request.
  const r0 = (await request(users[0])).data;
  assert.equal((await request(users[0])).data.id, r0.id, 'duplicate request should be reused');
  const other = (await request(users[0], new Date(Date.parse(pickupTime) + 3 * 3600000).toISOString())).data; // different time = allowed
  assert.notEqual(other.id, r0.id);
  assert.equal((await matches(users[0], r0.id)).length, 0);
  assert.equal((await call('POST', '/groups/join', { rideRequestId: r0.id, memberRideRequestIds: [r0.id] }, users[0])).status, 201);
  // Confirming a ride cancels the rider's other open request.
  assert.equal((await call('GET', `/rides/matches?rideRequestId=${other.id}`, null, users[0])).status, 400);

  // Riders 2-4 find the forming group and join it.
  let groupId;
  for (let i = 1; i < 4; i++) {
    const r = (await request(users[i])).data;
    const [best] = await matches(users[i], r.id);
    assert.equal(best.members.length, i + 1, `rider ${i + 1} should see ${i + 1} members`);
    const joined = await call('POST', '/groups/join', { rideRequestId: r.id, memberRideRequestIds: best.memberRideRequestIds }, users[i]);
    assert.equal(joined.status, 201, JSON.stringify(joined.data));
    assert.ok(!groupId || joined.data.id === groupId, 'should join the same group');
    groupId = joined.data.id;
  }

  // Group is full: a 5th rider sees nothing.
  const r5 = (await request(users[4])).data;
  assert.equal((await matches(users[4], r5.id)).length, 0);

  // Dashboard list: an ungrouped request and a started group are both listed and joinable.
  const later = (h) => new Date(Date.parse(pickupTime) + h * 3600000).toISOString();
  const lone = (await request(users[5], later(1))).data;
  const solo = (await request(users[7], later(2))).data;
  await call('POST', '/groups/join', { rideRequestId: solo.id, memberRideRequestIds: [solo.id] }, users[7]);
  const listed = (await call('GET', '/groups/available', null, users[6])).data.groups.map((g) => g.id);
  assert.ok(listed.includes(lone.id), 'open request should be listed');
  const preview = (await call('GET', '/groups/available', null, users[8])).data.groups.find((g) => g.pickupTime === solo.pickupTime);
  const soloGroupId = preview.id;
  const viaRequest = await call('POST', `/groups/${lone.id}/join`, null, users[6]);
  assert.equal(viaRequest.data.members.length, 2, JSON.stringify(viaRequest.data));
  const viaGroup = await call('POST', `/groups/${soloGroupId}/join`, null, users[8]);
  assert.equal(viaGroup.data.id, soloGroupId, JSON.stringify(viaGroup.data));
  assert.equal(viaGroup.data.members.length, 2);
  const mine = (await call('GET', '/groups/mine', null, users[8])).data.groups;
  assert.deepEqual(mine.map((g) => g.id), [soloGroupId], 'joined group should be in my groups');
  // Fare preview shown before joining = what you pay after; shares add up to the meter total.
  const { fare } = mine[0];
  assert.equal(fare.you.fareShare, preview.fare.you.fareShare, 'preview fare should match actual fare');
  assert.ok(Math.abs(fare.members.reduce((t, m) => t + m.fareShare, 0) - fare.totalFare) < 0.05, 'shares should sum to total');
  assert.ok(Math.abs(fare.meterFare + fare.surgeCharge - fare.totalFare) < 0.05, 'meter + surge should equal total');
  assert.equal(viaGroup.data.members.find((m) => m.isYou).fareShare, fare.you.fareShare, 'stored share should match breakup');

  console.log('grouping check passed');
})().catch((e) => { console.error(e); process.exit(1); });
