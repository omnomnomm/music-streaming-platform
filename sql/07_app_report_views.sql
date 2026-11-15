-- =============================================
-- Spotify DBS — Reporting views used by the app's screens
-- Run AFTER 06_seed_users_and_activity.sql (needs only 01–04, but keeping the
-- numbered order is simplest).
--
-- Q5–Q8 in 04_views_and_queries.sql are standalone queries. The front end reads
-- data through the Supabase API, which can only query tables and views, so each
-- query that a screen shows is wrapped in a view here. The logic is the same as
-- in 04; per-user views filter to the caller's own rows (or an admin), exactly
-- like v_user_wrapped does.
-- =============================================

-- ── v_user_top_songs (Wrapped page: "Your Most Played Songs", unique songs) ──
-- Join, GROUP BY, ROW_NUMBER() OVER (PARTITION BY user).
DROP VIEW IF EXISTS v_user_top_songs;
CREATE VIEW v_user_top_songs AS
SELECT
    lh.user_id,
    s.song_id,
    s.title,
    s.album_id,
    COUNT(*) AS plays,
    ROW_NUMBER() OVER (PARTITION BY lh.user_id ORDER BY COUNT(*) DESC, s.song_id) AS rank
FROM listening_history lh
JOIN song s ON s.song_id = lh.song_id
WHERE lh.user_id = app_user_id() OR is_admin()
GROUP BY lh.user_id, s.song_id, s.title, s.album_id;

-- ── v_user_top_artists (Wrapped "Your Top Artists", Library "Top Artist") ──
-- Plays are credited to each song's Lead performer, as in v_user_wrapped.
DROP VIEW IF EXISTS v_user_top_artists;
CREATE VIEW v_user_top_artists AS
SELECT
    lh.user_id,
    art.artist_id,
    art.artist_name,
    art.genre,
    COUNT(*) AS plays,
    ROW_NUMBER() OVER (PARTITION BY lh.user_id ORDER BY COUNT(*) DESC, art.artist_id) AS rank
FROM listening_history lh
JOIN performs perf ON perf.song_id = lh.song_id AND perf.role = 'Lead'
JOIN artist art ON art.artist_id = perf.artist_id
WHERE lh.user_id = app_user_id() OR is_admin()
GROUP BY lh.user_id, art.artist_id, art.artist_name, art.genre;

-- ── v_user_genre_breakdown (Wrapped "Genre Breakdown" pie) ──
DROP VIEW IF EXISTS v_user_genre_breakdown;
CREATE VIEW v_user_genre_breakdown AS
SELECT
    lh.user_id,
    art.genre,
    COUNT(*) AS plays
FROM listening_history lh
JOIN performs perf ON perf.song_id = lh.song_id AND perf.role = 'Lead'
JOIN artist art ON art.artist_id = perf.artist_id
WHERE lh.user_id = app_user_id() OR is_admin()
GROUP BY lh.user_id, art.genre;

-- ── v_monthly_revenue (Q5 — Charts page, admin only) ──
-- Join with plan, aggregation, filter on payment status. Financial data, so
-- only an admin gets rows back.
DROP VIEW IF EXISTS v_monthly_revenue;
CREATE VIEW v_monthly_revenue AS
SELECT
    TO_CHAR(s.start_date, 'YYYY-MM') AS month,
    p.plan_type,
    COUNT(*) AS paying_subscribers,
    COUNT(*) * p.monthly_price AS revenue
FROM subscription s
JOIN plan p ON p.plan_type = s.plan_type
WHERE s.payment_status = 'Paid' AND is_admin()
GROUP BY TO_CHAR(s.start_date, 'YYYY-MM'), p.plan_type, p.monthly_price;

-- ── v_artist_collaborators (Q6 — Charts page "Most Collaborative") ──
-- Self-join on performs: two artists collaborate when both are credited on the
-- same song.
DROP VIEW IF EXISTS v_artist_collaborators;
CREATE VIEW v_artist_collaborators AS
SELECT
    a.artist_id,
    a.artist_name,
    COUNT(DISTINCT p2.artist_id) AS distinct_collaborators,
    COUNT(DISTINCT p1.song_id) AS shared_songs
FROM performs p1
JOIN performs p2 ON p2.song_id = p1.song_id AND p2.artist_id <> p1.artist_id
JOIN artist a ON a.artist_id = p1.artist_id
GROUP BY a.artist_id, a.artist_name;

-- ── v_on_repeat_not_liked (Q7 — Wrapped page "On repeat, not liked yet") ──
-- GROUP BY, HAVING, NOT EXISTS. Always the caller's own history.
DROP VIEW IF EXISTS v_on_repeat_not_liked;
CREATE VIEW v_on_repeat_not_liked AS
SELECT lh.user_id, s.song_id, s.title, s.album_id, s.duration_seconds, COUNT(*) AS play_count
FROM listening_history lh
JOIN song s ON s.song_id = lh.song_id
WHERE lh.user_id = app_user_id()
  AND NOT EXISTS (
      SELECT 1 FROM likes l WHERE l.user_id = lh.user_id AND l.song_id = lh.song_id
  )
GROUP BY lh.user_id, s.song_id, s.title, s.album_id, s.duration_seconds
HAVING COUNT(*) >= 5;

-- ── v_songs_above_album_avg (Q8 — Charts page "Standout Tracks") ──
-- Correlated subquery: each song against the average of its own album.
DROP VIEW IF EXISTS v_songs_above_album_avg;
CREATE VIEW v_songs_above_album_avg AS
SELECT
    s.song_id,
    s.title,
    s.album_id,
    s.duration_seconds,
    s.play_count,
    (SELECT ROUND(AVG(s2.play_count), 1) FROM song s2 WHERE s2.album_id = s.album_id) AS album_avg
FROM song s
WHERE s.play_count > (
    SELECT AVG(s2.play_count) FROM song s2 WHERE s2.album_id = s.album_id
);

GRANT SELECT ON v_user_top_songs, v_user_top_artists, v_user_genre_breakdown,
    v_monthly_revenue, v_artist_collaborators, v_on_repeat_not_liked,
    v_songs_above_album_avg
    TO anon, authenticated;
