-- RoutePool initial migration
-- Generated from db/init.sql and prisma/schema.prisma
-- This migration sets up the full database schema for RoutePool.
-- It is designed to be run on a fresh PostgreSQL + PostGIS database.

-- ── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Enum types ────────────────────────────────────────────────────────────────

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

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  initials      TEXT        NOT NULL,
  branch        TEXT,
  is_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  total_rides   INTEGER     NOT NULL DEFAULT 0,
  total_savings NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  code_hash  TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);

CREATE TABLE IF NOT EXISTS nodes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  short_name TEXT        NOT NULL,
  area       node_area   NOT NULL DEFAULT 'city',
  geom       GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST (geom);

CREATE TABLE IF NOT EXISTS route_edges (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  node_a_id   UUID           NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  node_b_id   UUID           NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  distance_km NUMERIC(6, 2)  NOT NULL,
  CONSTRAINT edge_not_self CHECK (node_a_id <> node_b_id)
);
CREATE INDEX IF NOT EXISTS idx_edges_a ON route_edges(node_a_id);
CREATE INDEX IF NOT EXISTS idx_edges_b ON route_edges(node_b_id);

CREATE TABLE IF NOT EXISTS groups (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_node_id UUID         NOT NULL REFERENCES nodes(id),
  departure_time TIMESTAMPTZ  NOT NULL,
  total_fare     NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status         group_status NOT NULL DEFAULT 'forming',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_node_id        UUID          NOT NULL REFERENCES nodes(id),
  drop_node_id          UUID          NOT NULL REFERENCES nodes(id),
  window_start          TIMESTAMPTZ   NOT NULL,
  window_end            TIMESTAMPTZ   NOT NULL,
  flex_minutes          INTEGER       NOT NULL DEFAULT 0,
  status                ride_status   NOT NULL DEFAULT 'open',
  estimated_distance_km NUMERIC(6, 2) NOT NULL,
  solo_fare             NUMERIC(8, 2) NOT NULL,
  group_id              UUID          REFERENCES groups(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pickup_drop_diff CHECK (pickup_node_id <> drop_node_id)
);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_ride_requests_user   ON ride_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_pickup ON ride_requests(pickup_node_id);

CREATE TABLE IF NOT EXISTS group_members (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ride_request_id UUID          NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
  drop_node_id    UUID          NOT NULL REFERENCES nodes(id),
  fare_share      NUMERIC(8, 2) NOT NULL DEFAULT 0,
  status          member_status NOT NULL DEFAULT 'confirmed',
  joined_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_group ON chat_messages(group_id, created_at);

-- ── Prisma internal migration table ──────────────────────────────────────────
-- Prisma needs this to track which migrations have been applied.
-- (Prisma normally creates this automatically via `prisma migrate deploy`.)
