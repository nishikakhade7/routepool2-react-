-- RoutePool database schema + seed data
-- Run via: npm run db:init  (or psql -f db/init.sql)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('open', 'matched', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE group_status AS ENUM ('forming', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('pending', 'confirmed', 'left');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE node_area AS ENUM ('campus', 'city');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  branch TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  total_rides INTEGER NOT NULL DEFAULT 0,
  total_savings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

-- Predefined pickup/drop nodes. geom is a geography point so ST_DWithin /
-- ST_Distance operate in metres without manual projection.
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  area node_area NOT NULL DEFAULT 'city',
  geom GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST (geom);

-- Road-graph edges between nodes. The matching service runs Dijkstra over
-- this table to get shortest-path distance and shared-route overlap.
CREATE TABLE IF NOT EXISTS route_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_a_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_b_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  distance_km NUMERIC(6, 2) NOT NULL,
  CONSTRAINT edge_not_self CHECK (node_a_id <> node_b_id)
);
CREATE INDEX IF NOT EXISTS idx_edges_a ON route_edges(node_a_id);
CREATE INDEX IF NOT EXISTS idx_edges_b ON route_edges(node_b_id);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_node_id UUID NOT NULL REFERENCES nodes(id),
  departure_time TIMESTAMPTZ NOT NULL,
  total_fare NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status group_status NOT NULL DEFAULT 'forming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_node_id UUID NOT NULL REFERENCES nodes(id),
  drop_node_id UUID NOT NULL REFERENCES nodes(id),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  flex_minutes INTEGER NOT NULL DEFAULT 10,
  status ride_status NOT NULL DEFAULT 'open',
  estimated_distance_km NUMERIC(6, 2) NOT NULL,
  solo_fare NUMERIC(8, 2) NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pickup_drop_diff CHECK (pickup_node_id <> drop_node_id)
);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_user ON ride_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_pickup ON ride_requests(pickup_node_id);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ride_request_id UUID NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  drop_node_id UUID NOT NULL REFERENCES nodes(id),
  fare_share NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status member_status NOT NULL DEFAULT 'confirmed',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_group ON chat_messages(group_id, created_at);

-- ── Seed data ───────────────────────────────────────────────────────────
-- Fixed UUIDs so the seed is idempotent and easy to reference while testing.

-- Nodes (S.P.I.T Andheri campus + surrounding city nodes, Mumbai)
INSERT INTO nodes (id, name, short_name, area, geom) VALUES
  ('00000000-0000-0000-0000-000000000001', 'S.P.I.T Campus (Gate 2)', 'SPIT',        'campus', ST_SetSRID(ST_MakePoint(72.8468, 19.1197), 4326)::geography),
  ('00000000-0000-0000-0000-000000000002', 'Andheri East',            'ANDHERI E',   'city',   ST_SetSRID(ST_MakePoint(72.8590, 19.1150), 4326)::geography),
  ('00000000-0000-0000-0000-000000000003', 'Jogeshwari West',         'JOG WEST',    'city',   ST_SetSRID(ST_MakePoint(72.8380, 19.1360), 4326)::geography),
  ('00000000-0000-0000-0000-000000000004', 'Jogeshwari East',         'JOG EAST',    'city',   ST_SetSRID(ST_MakePoint(72.8530, 19.1360), 4326)::geography),
  ('00000000-0000-0000-0000-000000000005', 'Marol Naka',              'MAROL',       'city',   ST_SetSRID(ST_MakePoint(72.8790, 19.1190), 4326)::geography),
  ('00000000-0000-0000-0000-000000000006', 'Vile Parle',              'VILE PARLE',  'city',   ST_SetSRID(ST_MakePoint(72.8420, 19.1000), 4326)::geography)
ON CONFLICT (id) DO NOTHING;

-- Road graph: SPIT -> Andheri East -> {Marol Naka, Jogeshwari West -> Jogeshwari East}
--             SPIT -> Vile Parle (separate corridor, used to demo direction mismatch)
INSERT INTO route_edges (node_a_id, node_b_id, distance_km) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 2.6),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 1.3),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 3.2),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 1.6),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 4.5)
ON CONFLICT DO NOTHING;

-- Users
INSERT INTO users (id, email, name, initials, branch, is_verified, total_rides, total_savings) VALUES
  ('00000000-0000-0000-0000-000000000101', 'nishika.khade@spit.ac.in',    'Nishika Khade',     'NK', 'TE Computer Engineering', TRUE, 3, 2340.00),
  ('00000000-0000-0000-0000-000000000102', 'rhea.menon@spit.ac.in',       'Rhea Menon',        'RM', 'TE Computer Engineering', TRUE, 2, 860.00),
  ('00000000-0000-0000-0000-000000000103', 'kabir.shetty@spit.ac.in',     'Kabir Shetty',      'KS', 'BE IT',                   TRUE, 4, 1510.00),
  ('00000000-0000-0000-0000-000000000104', 'ananya.deshpande@spit.ac.in', 'Ananya Deshpande',  'AD', 'SE EXTC',                 TRUE, 1, 210.00)
ON CONFLICT (id) DO NOTHING;

-- A confirmed group: Nishika + Rhea + Kabir, SPIT -> Andheri East -> Jogeshwari West -> Jogeshwari East
-- Tariff: Rs27 for the first 1.5km + Rs18/km after, x1.2 driver surcharge.
-- Full route (7.4km) = (27 + (7.4-1.5)*18) * 1.2 = 159.84, split by segment-occupancy below.
INSERT INTO groups (id, pickup_node_id, departure_time, total_fare, status) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', now() + interval '2 hours', 159.84, 'confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ride_requests (id, user_id, pickup_node_id, drop_node_id, window_start, window_end, flex_minutes, status, estimated_distance_km, solo_fare, group_id) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', now() + interval '2 hours', now() + interval '2 hours 30 minutes', 10, 'matched', 7.4, 159.84, '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now() + interval '2 hours', now() + interval '2 hours 30 minutes', 10, 'matched', 2.6, 56.16, '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', now() + interval '2 hours', now() + interval '2 hours 30 minutes', 10, 'matched', 5.8, 125.28, '00000000-0000-0000-0000-000000000201'),
  -- Ananya's request is left OPEN so /api/rides/matches has a live candidate to score against.
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', now() + interval '2 hours', now() + interval '2 hours 30 minutes', 10, 'open', 3.9, 84.24, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_members (group_id, user_id, ride_request_id, drop_node_id, fare_share, status) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000004', 87.84, 'confirmed'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000002', 18.72, 'confirmed'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000003', 53.28, 'confirmed')
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO chat_messages (group_id, user_id, message, created_at) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Heyy, matched with you two for tonight''s pool 🎉', now() - interval '20 minutes'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000102', 'Perfect, see you at Gate 2!', now() - interval '18 minutes'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000103', 'I''ll be 2 min late, hold the auto 🙏', now() - interval '12 minutes')
ON CONFLICT DO NOTHING;
