-- =============================================
-- Spotify DBS — Reporting views + the 8 planned queries (design doc section 9)
-- Run AFTER 03_rls_policies.sql
--
-- v_top_songs_by_country, v_artist_monthly_listeners and v_genre_trends read
-- listening_history across ALL users on purpose — these are platform-wide charts,
-- the same kind of aggregate data real streaming charts publish. They are defined
-- here as plain views (created by the table owner), and listening_history's own
-- RLS restricts each listener to their own rows. In Postgres, a view's RLS
-- evaluation uses the VIEW OWNER's privileges by default (security_invoker=false,
-- the default), and the table owner bypasses RLS on its own tables unless RLS is
-- FORCEd — which it isn't here. So these three views correctly aggregate over
-- everyone's history while listening_history itself stays locked down. This is
-- the standard Supabase pattern for "reporting view over a row-level-secured
-- table" and is why it's documented here rather than left to be rediscovered.
--
-- v_user_wrapped is different: it's per-user data, so instead of relying on that
-- same bypass, it filters explicitly in its own WHERE clause (own user_id, or an
-- admin) — correct regardless of view-ownership subtleties.
-- =============================================

-- ── v_top_songs_by_country (Q1) ──────────────
DROP VIEW IF EXISTS v_top_songs_by_country;
CREATE VIEW v_top_songs_by_country AS
WITH plays AS (
    SELECT u.country, lh.song_id, COUNT(*) AS plays
    FROM listening_history lh
    JOIN users u ON u.user_id = lh.user_id
    WHERE lh.listened_at >= now() - INTERVAL '30 days'
    GROUP BY u.country, lh.song_id
)
SELECT
    p.country,
    p.song_id,
    s.title,
    art.artist_name,
    p.plays,
    RANK() OVER (PARTITION BY p.country ORDER BY p.plays DESC) AS rank
FROM plays p
JOIN song s ON s.song_id = p.song_id
JOIN performs perf ON perf.song_id = p.song_id AND perf.role = 'Lead'
JOIN artist art ON art.artist_id = perf.artist_id;

-- ── v_artist_monthly_listeners (Q2) ──────────
-- Distinct listeners of each artist's lead-credited songs in the last 30 days.
-- Not a stored column (it changes every day) — recomputed on read, per the design
-- doc's "computed by a view instead of being stored".
DROP VIEW IF EXISTS v_artist_monthly_listeners;
CREATE VIEW v_artist_monthly_listeners AS
SELECT
    art.artist_id,
    art.artist_name,
    COUNT(DISTINCT lh.user_id) AS monthly_listeners
FROM artist art
LEFT JOIN performs perf ON perf.artist_id = art.artist_id AND perf.role = 'Lead'
LEFT JOIN listening_history lh
    ON lh.song_id = perf.song_id AND lh.listened_at >= now() - INTERVAL '30 days'
GROUP BY art.artist_id, art.artist_name;

-- ── v_genre_trends (Q3) ───────────────────────
DROP VIEW IF EXISTS v_genre_trends;
CREATE VIEW v_genre_trends AS
WITH recent_plays AS (
    SELECT lh.song_id
    FROM listening_history lh
    WHERE lh.listened_at >= now() - INTERVAL '30 days'
),
genre_plays AS (
    SELECT art.genre, COUNT(*) AS plays
    FROM recent_plays rp
    JOIN performs perf ON perf.song_id = rp.song_id AND perf.role = 'Lead'
    JOIN artist art ON art.artist_id = perf.artist_id
    GROUP BY art.genre
)
SELECT
    genre,
    plays,
    SUM(plays) OVER () AS total_plays,
    ROUND(100.0 * plays / NULLIF(SUM(plays) OVER (), 0), 2) AS pct_share
FROM genre_plays;

-- ── v_user_wrapped (Q4) ───────────────────────
-- ROW_NUMBER() (not RANK()) on the "top X" CTEs deliberately, so a tie never fans
-- a user out into two rows — this view is meant to return exactly one row per
-- visible user.
DROP VIEW IF EXISTS v_user_wrapped;
CREATE VIEW v_user_wrapped AS
WITH history AS (
    SELECT lh.user_id, lh.song_id, lh.listened_at
    FROM listening_history lh
),
song_info AS (
    SELECT s.song_id, s.title, s.duration_seconds, perf.artist_id, art.artist_name, art.genre
    FROM song s
    JOIN performs perf ON perf.song_id = s.song_id AND perf.role = 'Lead'
    JOIN artist art ON art.artist_id = perf.artist_id
),
minutes AS (
    SELECT h.user_id, SUM(si.duration_seconds) / 60.0 AS total_minutes, COUNT(*) AS total_streams
    FROM history h JOIN song_info si ON si.song_id = h.song_id
    GROUP BY h.user_id
),
song_counts AS (
    SELECT h.user_id, h.song_id, COUNT(*) AS plays,
           ROW_NUMBER() OVER (PARTITION BY h.user_id ORDER BY COUNT(*) DESC) AS rn
    FROM history h
    GROUP BY h.user_id, h.song_id
),
top_song AS (
    SELECT sc.user_id, si.title, sc.plays
    FROM song_counts sc JOIN song_info si ON si.song_id = sc.song_id
    WHERE sc.rn = 1
),
artist_counts AS (
    SELECT h.user_id, si.artist_id, COUNT(*) AS plays,
           ROW_NUMBER() OVER (PARTITION BY h.user_id ORDER BY COUNT(*) DESC) AS rn
    FROM history h JOIN song_info si ON si.song_id = h.song_id
    GROUP BY h.user_id, si.artist_id
),
top_artist AS (
    SELECT ac.user_id, art.artist_name, ac.plays
    FROM artist_counts ac JOIN artist art ON art.artist_id = ac.artist_id
    WHERE ac.rn = 1
),
genre_counts AS (
    SELECT h.user_id, si.genre, COUNT(*) AS plays,
           ROW_NUMBER() OVER (PARTITION BY h.user_id ORDER BY COUNT(*) DESC) AS rn
    FROM history h JOIN song_info si ON si.song_id = h.song_id
    GROUP BY h.user_id, si.genre
),
top_genre AS (
    SELECT user_id, genre, plays FROM genre_counts WHERE rn = 1
)
SELECT
    u.user_id,
    u.name,
    COALESCE(m.total_streams, 0) AS total_streams,
    ROUND(COALESCE(m.total_minutes, 0)) AS total_minutes,
    ts.title AS top_song,
    ts.plays AS top_song_plays,
    ta.artist_name AS top_artist,
    ta.plays AS top_artist_plays,
    tg.genre AS top_genre,
    tg.plays AS top_genre_plays
FROM users u
LEFT JOIN minutes m ON m.user_id = u.user_id
LEFT JOIN top_song ts ON ts.user_id = u.user_id
LEFT JOIN top_artist ta ON ta.user_id = u.user_id
LEFT JOIN top_genre tg ON tg.user_id = u.user_id
WHERE u.user_id = app_user_id() OR is_admin();

-- ── v_device_distribution / v_daily_plays ─────
-- Not one of the 4 named in the design doc, but the same justification applies:
-- the Charts page's device-mix and 30-day trend widgets are platform-wide
-- aggregates over listening_history, so they need the same reporting-view
-- bypass as v_top_songs_by_country etc., or they'd silently show only the
-- viewing listener's own history once RLS is on.
DROP VIEW IF EXISTS v_device_distribution;
CREATE VIEW v_device_distribution AS
SELECT device_type, COUNT(*) AS play_count
FROM listening_history
GROUP BY device_type;

DROP VIEW IF EXISTS v_daily_plays;
CREATE VIEW v_daily_plays AS
SELECT date_trunc('day', listened_at)::date AS play_date, COUNT(*) AS plays
FROM listening_history
WHERE listened_at >= now() - INTERVAL '90 days'
GROUP BY date_trunc('day', listened_at)::date;

-- Let the client (and admins browsing the dashboard) read these without
-- re-querying listening_history directly.
GRANT SELECT ON v_top_songs_by_country, v_artist_monthly_listeners, v_genre_trends,
    v_user_wrapped, v_device_distribution, v_daily_plays
    TO anon, authenticated;

-- ══════════════════════════════════════════════
-- The 8 planned queries, as runnable SQL (design doc section 9).
-- Q1-Q4 are thin wrappers over the views above; Q5-Q8 stand alone.
-- ══════════════════════════════════════════════

-- Q1: Top 10 songs in each country over the last 30 days.
-- CTE, joins, GROUP BY, RANK() OVER (PARTITION BY) — inside v_top_songs_by_country.
SELECT country, song_id, title, artist_name, plays, rank
FROM v_top_songs_by_country
WHERE rank <= 10
ORDER BY country, rank;

-- Q2: Monthly listeners of each artist.
-- Joins, COUNT(DISTINCT), view.
SELECT artist_id, artist_name, monthly_listeners
FROM v_artist_monthly_listeners
ORDER BY monthly_listeners DESC;

-- Q3: Share of listening by genre over the last 30 days.
-- Joins, GROUP BY, SUM() OVER ().
SELECT genre, plays, total_plays, pct_share
FROM v_genre_trends
ORDER BY plays DESC;

-- Q4: A listener's Wrapped: top artist, top song, minutes listened, top genre.
-- Several CTEs, aggregation — inside v_user_wrapped. Replace the literal with the
-- logged-in user's own user_id (RLS/the view's own WHERE clause enforces this is
-- the only row a non-admin can see regardless).
SELECT * FROM v_user_wrapped WHERE user_id = 1;

-- Q5: Monthly revenue by plan.
-- Join with PLAN, aggregation, date filter.
SELECT
    TO_CHAR(s.start_date, 'YYYY-MM') AS month,
    p.plan_type,
    COUNT(*) AS paying_subscribers,
    COUNT(*) * p.monthly_price AS revenue
FROM subscription s
JOIN plan p ON p.plan_type = s.plan_type
WHERE s.payment_status = 'Paid'
GROUP BY TO_CHAR(s.start_date, 'YYYY-MM'), p.plan_type, p.monthly_price
ORDER BY month, p.plan_type;

-- Q6: Artists with the most distinct collaborators.
-- Self-join on PERFORMS — two artists "collaborate" when they're both credited
-- (in any role) on the same song.
SELECT
    a.artist_id,
    a.artist_name,
    COUNT(DISTINCT p2.artist_id) AS distinct_collaborators
FROM performs p1
JOIN performs p2 ON p2.song_id = p1.song_id AND p2.artist_id <> p1.artist_id
JOIN artist a ON a.artist_id = p1.artist_id
GROUP BY a.artist_id, a.artist_name
ORDER BY distinct_collaborators DESC;

-- Q7: Songs a listener has played at least five times but not liked.
-- GROUP BY, HAVING, NOT EXISTS. Replace the literal with the logged-in user_id.
SELECT s.song_id, s.title, COUNT(*) AS play_count
FROM listening_history lh
JOIN song s ON s.song_id = lh.song_id
WHERE lh.user_id = 1
  AND NOT EXISTS (
      SELECT 1 FROM likes l WHERE l.user_id = lh.user_id AND l.song_id = lh.song_id
  )
GROUP BY s.song_id, s.title
HAVING COUNT(*) >= 5
ORDER BY play_count DESC;

-- Q8: Songs played more often than the average song on their own album.
-- Correlated subquery.
SELECT s.song_id, s.title, s.album_id, s.play_count
FROM song s
WHERE s.play_count > (
    SELECT AVG(s2.play_count) FROM song s2 WHERE s2.album_id = s.album_id
)
ORDER BY s.album_id, s.play_count DESC;
