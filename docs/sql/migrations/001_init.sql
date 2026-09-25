-- 001_init.sql
-- Apply with search_path = panel_club | panel_club_test

CREATE SCHEMA IF NOT EXISTS panel_club;
CREATE SCHEMA IF NOT EXISTS panel_club_test;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shows (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Panel shows',
    'Game shows',
    'Roasts',
    'Advice & banter'
  )),
  description TEXT NOT NULL DEFAULT '',
  cover_video_id TEXT NOT NULL,
  availability_note TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  show_slug TEXT NOT NULL REFERENCES shows (slug) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('playlist', 'channel')),
  playlist_id TEXT,
  channel_id TEXT,
  handle TEXT,
  title_include TEXT,
  min_duration_seconds INTEGER NOT NULL DEFAULT 480,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS people (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  show_slug TEXT NOT NULL REFERENCES shows (slug) ON DELETE CASCADE,
  youtube_video_id TEXT UNIQUE,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('aired', 'upcoming')),
  unpublished BOOLEAN NOT NULL DEFAULT FALSE,
  premieres_at TEXT,
  media_url TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS show_credits (
  show_slug TEXT NOT NULL REFERENCES shows (slug) ON DELETE CASCADE,
  person_slug TEXT NOT NULL REFERENCES people (slug),
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  PRIMARY KEY (show_slug, person_slug, role)
);

CREATE TABLE IF NOT EXISTS episode_credits (
  episode_id TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
  person_slug TEXT NOT NULL REFERENCES people (slug),
  role TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  PRIMARY KEY (episode_id, person_slug, role)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  parent_id TEXT REFERENCES reviews (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  stars INTEGER,
  body TEXT NOT NULL,
  spoiler BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_root_unique
  ON reviews (episode_id, viewer_id)
  WHERE parent_id IS NULL;

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  unpublished INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingest_items (
  run_id TEXT NOT NULL REFERENCES ingest_runs (id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  show_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (run_id, video_id)
);
