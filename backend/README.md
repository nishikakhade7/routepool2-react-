# RoutePool Backend

Express + PostgreSQL/PostGIS API for the RoutePool ride-pooling frontend.

## Stack & design notes

- **Raw `pg`, not an ORM.** The matching algorithm leans on PostGIS geography
  functions (`ST_DWithin`, `ST_MakePoint`, geometry casts) and a hand-rolled
  Dijkstra pass over a `route_edges` graph table. Prisma/Sequelize don't
  model PostGIS geography types or graph traversal any more cleanly than
  parameterized SQL does, so raw `pg` with a thin model layer keeps things
  transparent.
- **Architecture**: `routes/ → controllers/ → services/ → models/` per
  module (`auth`, `dashboard`, `rides`, `groups`), under `src/modules/`.
  Controllers only touch `req`/`res`; services hold business logic; models
  hold SQL.
- **Matching = PostGIS + Dijkstra.** `GET /api/rides/matches` widens the
  candidate pool with `ST_DWithin` (nearby pickup nodes, not just an exact
  match), then runs Dijkstra over `route_edges` to get each candidate's
  shortest path and compares it against the requester's path for shared
  route overlap, direction (which branch they take after pickup), and
  pickup-time overlap. See `src/modules/rides/matching.service.js`.
- **Fare** uses a real auto-rickshaw meter tariff (`src/utils/fare.js`,
  configurable via `AUTO_BASE_FARE` / `AUTO_BASE_KM` / `AUTO_PER_KM_RATE` /
  `AUTO_SURGE_MULTIPLIER` in `.env`): a flat fare for the first 1.5km, a
  per-km rate beyond it, plus a surge multiplier for the driver. For a
  pooled group, each road segment's cost (the *difference* in cumulative
  tariff fare between its two stops, so the nonlinear tariff still adds up
  exactly) is divided only among the riders still onboard for it - someone
  dropped early pays less than someone riding the full route.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET
createdb routepool      # requires local PostgreSQL with PostGIS available
npm run db:init          # creates schema + seed data (db/init.sql)
npm run dev               # starts on http://localhost:4000
```

Requires PostgreSQL with the `postgis` extension installed (e.g. the
`postgis/postgis` Docker image, or `postgresql-<version>-postgis-3` on
Linux, or `brew install postgis` on macOS).

## Auth flow

1. `POST /api/auth/send-otp` `{ email }` — must end in `@spit.ac.in`.
   Outside `NODE_ENV=production` the response includes `devCode` so you can
   test without a real mail provider; the code is also logged to the
   console either way.
2. `POST /api/auth/verify-otp` `{ email, code }` — returns `{ token, user }`.
   Send the token as `Authorization: Bearer <token>` on every other route.

## Endpoints

| Method | Path                          | Auth | Description |
|--------|-------------------------------|------|-------------|
| POST   | `/api/auth/send-otp`          | -    | Simulates sending a 4-digit OTP to an `@spit.ac.in` address |
| POST   | `/api/auth/verify-otp`        | -    | Verifies the OTP, creates/verifies the user, returns a JWT |
| GET    | `/api/dashboard/stats`        | JWT  | Total rides, savings, recent activity |
| GET    | `/api/dashboard/busy-routes`  | JWT  | Most-requested open routes right now |
| GET    | `/api/rides/nodes`            | JWT  | Campus + city pickup/drop nodes |
| POST   | `/api/rides/request`          | JWT  | Create a ride request; returns distance + solo/pooled fare estimate |
| GET    | `/api/rides/matches?rideRequestId=` | JWT | Scored, grouped matches for an open request |
| POST   | `/api/groups/join`            | JWT  | Lock in / join a proposed group from `/matches` |
| GET    | `/api/groups/:groupId/chat`   | JWT  | Group chat history (members only) |
| POST   | `/api/groups/:groupId/chat`   | JWT  | Send a group chat message (members only) |

## Try it end to end

```bash
# 1. Get a token (seeded user, any 4-digit code works via devCode)
curl -s -X POST localhost:4000/api/auth/send-otp -H 'content-type: application/json' \
  -d '{"email":"nishika.khade@spit.ac.in"}'
curl -s -X POST localhost:4000/api/auth/verify-otp -H 'content-type: application/json' \
  -d '{"email":"nishika.khade@spit.ac.in","code":"<devCode from above>"}'

# 2. List nodes, then request a ride (use real node ids from step 2)
curl -s localhost:4000/api/rides/nodes -H "authorization: Bearer <token>"

# 3. See group chat for the seeded demo group
curl -s localhost:4000/api/groups/00000000-0000-0000-0000-000000000201/chat \
  -H "authorization: Bearer <token>"
```

The seed data (`db/init.sql`) already includes a confirmed 3-person group
(Nishika + Rhea + Kabir, SPIT → Jogeshwari East) and an open request from
Ananya (SPIT → Marol Naka) so `/matches` and `/groups/:id/chat` have real
data to return immediately after `npm run db:init`.
