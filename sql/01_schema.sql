-- =============================================
-- Spotify DBS — Schema (PostgreSQL / Supabase)
-- BITS Pilani — DBMS Project (CS F212), Sem 1 2026-27
-- Matches the mid-semester design document exactly:
-- 11 relations (7 strong + 1 weak + 3 associative), all FKs, all CHECKs.
-- Run this FIRST, in the Supabase SQL Editor, on a fresh project.
-- =============================================

-- Drop in reverse dependency order so this script is re-runnable.
DROP TABLE IF EXISTS listening_history CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS playlist_song CASCADE;
DROP TABLE IF EXISTS playlist CASCADE;
DROP TABLE IF EXISTS subscription CASCADE;
DROP TABLE IF EXISTS plan CASCADE;
DROP TABLE IF EXISTS performs CASCADE;
DROP TABLE IF EXISTS song CASCADE;
DROP TABLE IF EXISTS album CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS artist CASCADE;

-- pgcrypto gives us crypt()/gen_salt() for seeding auth.users directly,
-- and gen_random_uuid() (also available from core on supported PG versions).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Artist ────────────────────────────────
CREATE TABLE artist (
    artist_id        SERIAL PRIMARY KEY,
    artist_name      VARCHAR(150) NOT NULL UNIQUE,
    genre            VARCHAR(100) NOT NULL,
    country          VARCHAR(100) NOT NULL,
    verified_status  BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_artist_name_length CHECK (LENGTH(TRIM(artist_name)) >= 2)
);

-- ── 2. Album ─────────────────────────────────
-- Releases: Artist (1) -> (N) Album. Total participation from Album (artist_id NOT NULL).
CREATE TABLE album (
    album_id      SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    release_date  DATE NOT NULL,
    album_type    VARCHAR(10) NOT NULL DEFAULT 'album',
    artist_id     INT NOT NULL REFERENCES artist(artist_id) ON DELETE RESTRICT,
    CONSTRAINT chk_album_type CHECK (album_type IN ('album', 'single', 'ep')),
    CONSTRAINT chk_album_release_date CHECK (release_date <= CURRENT_DATE + INTERVAL '1 year')
);

-- ── 3. Song ──────────────────────────────────
-- HasTrack: Album (1) -> (N) Song. Total participation from Song (album_id NOT NULL).
-- No release_date here on purpose: a song's release date is its album's (assumption 1.2.2
-- in the design doc) — storing it twice would just be a second, driftable copy of the truth.
CREATE TABLE song (
    song_id           SERIAL PRIMARY KEY,
    title             VARCHAR(200) NOT NULL,
    duration_seconds  INT NOT NULL,
    play_count        INT NOT NULL DEFAULT 0,
    album_id          INT NOT NULL REFERENCES album(album_id) ON DELETE CASCADE,
    CONSTRAINT chk_song_duration_range CHECK (duration_seconds BETWEEN 10 AND 3600),
    CONSTRAINT chk_play_count_non_negative CHECK (play_count >= 0)
);

-- ── 4. Users ─────────────────────────────────
-- auth_id points at Supabase's own auth.users — passwords are never stored in this
-- schema (see design doc section 6). An account is 'artist' exactly when it is linked
-- to an artist profile (BR9).
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    auth_id        UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(200) NOT NULL UNIQUE,
    date_of_birth  DATE NOT NULL,
    country        VARCHAR(100) NOT NULL,
    account_type   VARCHAR(10) NOT NULL DEFAULT 'listener',
    artist_id      INT UNIQUE REFERENCES artist(artist_id) ON DELETE SET NULL,
    CONSTRAINT chk_name_length CHECK (LENGTH(TRIM(name)) >= 2),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_account_type CHECK (account_type IN ('listener', 'artist', 'admin')),
    CONSTRAINT chk_artist_account_linkage CHECK ((account_type = 'artist') = (artist_id IS NOT NULL))
);

-- ── 5. Plan ──────────────────────────────────
-- Natural key: plan names are few, stable, and meaningful on their own.
CREATE TABLE plan (
    plan_type      VARCHAR(20) PRIMARY KEY,
    monthly_price  NUMERIC(6, 2) NOT NULL,
    CONSTRAINT chk_plan_price_positive CHECK (monthly_price > 0)
);

-- ── 6. Subscription ──────────────────────────
-- Subscribes: User (1) - (1) Subscription, enforced by UNIQUE(user_id).
-- Kept as its own relation (not columns on users) so free users — the majority —
-- don't carry a row of NULLs; a renewal just updates the existing row.
CREATE TABLE subscription (
    subscription_id  SERIAL PRIMARY KEY,
    user_id          INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    plan_type        VARCHAR(20) NOT NULL REFERENCES plan(plan_type) ON DELETE RESTRICT,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    payment_status   VARCHAR(10) NOT NULL DEFAULT 'Pending',
    CONSTRAINT chk_sub_end_after_start CHECK (end_date > start_date),
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('Paid', 'Pending', 'Failed'))
);

-- ── 7. Playlist ──────────────────────────────
-- Owns: User (1) -> (N) Playlist. Total participation from Playlist (user_id NOT NULL).
CREATE TABLE playlist (
    playlist_id    SERIAL PRIMARY KEY,
    playlist_name  VARCHAR(200) NOT NULL,
    created_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_playlist_name_nonempty CHECK (LENGTH(TRIM(playlist_name)) >= 1),
    CONSTRAINT uq_playlist_name_per_user UNIQUE (user_id, playlist_name)
);

-- ── 8. Performs (associative: Artist M:N Song) ─
CREATE TABLE performs (
    artist_id  INT NOT NULL REFERENCES artist(artist_id) ON DELETE CASCADE,
    song_id    INT NOT NULL REFERENCES song(song_id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    PRIMARY KEY (artist_id, song_id),
    CONSTRAINT chk_performs_role CHECK (role IN ('Lead', 'Featured'))
);

-- ── 9. Playlist_Song (associative: Playlist M:N Song) ─
CREATE TABLE playlist_song (
    playlist_id  INT NOT NULL REFERENCES playlist(playlist_id) ON DELETE CASCADE,
    song_id      INT NOT NULL REFERENCES song(song_id) ON DELETE CASCADE,
    added_date   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (playlist_id, song_id)
);

-- ── 10. Likes (associative: User M:N Song) ───
CREATE TABLE likes (
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    song_id     INT NOT NULL REFERENCES song(song_id) ON DELETE CASCADE,
    liked_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, song_id)
);

-- ── 11. Listening_History (weak entity) ──────
-- Listens (identifying): owned by both Users and Song. Full key is
-- (user_id, song_id, listened_at) — a single play has no identity of its own.
CREATE TABLE listening_history (
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    song_id      INT NOT NULL REFERENCES song(song_id) ON DELETE CASCADE,
    listened_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_type  VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, song_id, listened_at),
    CONSTRAINT chk_device_type CHECK (device_type IN ('Mobile', 'Desktop', 'Web', 'Tablet', 'Smart Speaker'))
);

-- ══════════════════════════════════════════════
-- Indexes (Postgres does not index foreign keys automatically)
-- ══════════════════════════════════════════════
CREATE INDEX idx_album_artist_id ON album(artist_id);
CREATE INDEX idx_song_album_id ON song(album_id);
CREATE INDEX idx_playlist_user_id ON playlist(user_id);
CREATE INDEX idx_performs_song_id ON performs(song_id);
CREATE INDEX idx_listening_history_song_time ON listening_history(song_id, listened_at);
-- Search support, matching src/services/api.js's ilike() search on these three columns.
CREATE INDEX idx_song_title_lower ON song (lower(title));
CREATE INDEX idx_album_title_lower ON album (lower(title));
CREATE INDEX idx_artist_name_lower ON artist (lower(artist_name));
