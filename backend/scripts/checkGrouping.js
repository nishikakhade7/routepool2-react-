// End-to-end check of grouping against a running mock-DB backend:
//   node scripts/checkGrouping.js [http://localhost:4000]
// Uses the stops in src/config/stopGraph.js and the rules in src/config/matchingConfig.js
// (10 min window, 3 riders per auto, >= 50% of the shorter route shared).
const assert = require('assert');

const BASE = (process.argv[2] || 'http://localhost:4000') + '/api';
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
const T = Date.now() + (60 + Math.floor(Math.random() * 1140)) * 60000;
const at = (min) => new Date(T + min * 60000).toISOString();
async function search(token, pickupText, dropText, min = 0) {
  const req = (await call('POST', '/rides/request', { pickupText, dropText, pickupTime: at(min) }, token)).data;
  const groups = (await call('GET', `/rides/matches?rideRequestId=${req.id}`, null, token)).data.groups;
  return { req, groups };
}
const joinGroup = (token, req, ids) => call('POST', '/groups/join', { rideRequestId: req.id, memberRideRequestIds: ids }, token);

(async () => {
  const [x, s1, s2, s3, s4, opp] = await Promise.all(['x', 's1', 's2', 's3', 's4', 'opp'].map(login));

  // Past time rejected; unknown place rejected.
  assert.equal((await call('POST', '/rides/request', { pickupText: 'Azad Nagar', dropText: 'Andheri', pickupTime: new Date(Date.now() - 600000).toISOString() }, x)).status, 400);
  assert.equal((await call('POST', '/rides/request', { pickupText: 'Nowhere', dropText: 'Andheri', pickupTime: at(0) }, x)).status, 400);

  // A long-haul rider starts a group first.
  const rx = await search(x, 'Azad Nagar', 'Ghatkopar');
  assert.equal(rx.groups.length, 0);
  assert.equal((await joinGroup(x, rx.req, [rx.req.id])).status, 201);

  // Three short-hop riders. The first's trip lies inside the long-haul route, so
  // that group is offered (100% of their trip is shared) - they start their own.
  const r1 = await search(s1, 'azad', 'andheri', 2);
  assert.equal(r1.groups.length, 1, 'contained trip should be offered the long-haul group');
  assert.equal(r1.groups[0].routeOverlap, 1);
  const g1 = (await joinGroup(s1, r1.req, [r1.req.id])).data;
  // The next two see the same-route group ranked first and join it: one group of 3.
  for (const [t, min] of [[s2, 3], [s3, 4]]) {
    const r = await search(t, 'Azad Nagar', 'Andheri East', min);
    assert.equal(r.groups[0].id, g1.id);
    const preview = r.groups[0].members.find((m) => m.isYou).fareShare;
    const joined = await joinGroup(t, r.req, r.groups[0].memberRideRequestIds);
    assert.equal(joined.status, 201, JSON.stringify(joined.data));
    assert.equal(joined.data.members.find((m) => m.isYou).fareShare, preview, 'preview fare should match charged fare');
  }
  assert.ok(!(await search(s4, 'Azad Nagar', 'Andheri', 4)).groups.some((g) => g.id === g1.id), 'full group should not be offered');
  assert.equal((await search(opp, 'Azad Nagar', 'SPIT', 0)).groups.length, 0, 'opposite direction should not match');

  // Everyone in the group sees the same fares and the same driver.
  const [v1, v2] = await Promise.all([s1, s2].map((t) => call('GET', `/groups/${g1.id}`, null, t)));
  assert.deepEqual(v1.data.members.map((m) => m.fareShare), v2.data.members.map((m) => m.fareShare));
  assert.ok(Math.abs(v1.data.members.reduce((t, m) => t + m.fareShare, 0) - v1.data.totalFare) < 0.05, 'shares should sum to total');
  const [d1, d2] = await Promise.all([s1, s3].map((t) => call('GET', `/groups/${g1.id}/driver`, null, t)));
  assert.deepEqual(d1.data, d2.data, 'same driver for every member');

  // Leaving reopens the seat.
  assert.equal((await call('POST', `/groups/${g1.id}/leave`, null, s3)).status, 200);
  assert.equal((await call('GET', `/groups/${g1.id}`, null, s1)).data.members.length, 2);
  assert.equal((await search(s4, 'Azad Nagar', 'Andheri', 4)).groups[0].id, g1.id);

  // Dashboard endpoints: a 500 here used to reach the UI as "Couldn't load open groups".
  const available = await call('GET', '/groups/available', null, s1);
  assert.equal(available.status, 200, JSON.stringify(available.data));
  assert.ok(Array.isArray(available.data.groups), 'available should return a list');
  const mineList = await call('GET', '/groups/mine', null, s1);
  assert.equal(mineList.status, 200, JSON.stringify(mineList.data));
  assert.ok(mineList.data.groups.some((g) => g.members.length > 0), 'my groups should come back with members');
  // A rider in a group still sees it in the shared list, flagged as theirs.
  assert.ok(available.data.groups.every((g) => typeof g.isMine === 'boolean'), 'each listed group says whether it is mine');

  console.log('grouping check passed');
})().catch((e) => { console.error(e); process.exit(1); });
