-- =============================================
-- Spotify DBS — Triggers (T1-T5) and application-facing functions
-- Run AFTER 01_schema.sql
-- =============================================

-- ══════════════════════════════════════════════
-- PART 0: Identity helpers
-- SECURITY DEFINER with a pinned search_path so these can be used inside RLS
-- policies on OTHER tables without re-triggering RLS on `users` itself
-- (the standard Supabase pattern for avoiding self-referential policy recursion).
-- ══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION app_user_id()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT user_id FROM users WHERE auth_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_artist_id()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT artist_id FROM users WHERE auth_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE((SELECT account_type = 'admin' FROM users WHERE auth_id = auth.uid()), FALSE);
$$;

-- ══════════════════════════════════════════════
-- PART 1: Triggers
-- ══════════════════════════════════════════════

-- ── T1 (BR4): a song cannot be played before its album released, or in the future ──
CREATE OR REPLACE FUNCTION trg_validate_listen()
RETURNS TRIGGER AS $$
DECLARE
    v_release_date DATE;
BEGIN
    SELECT al.release_date INTO v_release_date
    FROM song s JOIN album al ON al.album_id = s.album_id
    WHERE s.song_id = NEW.song_id;

    IF v_release_date IS NULL THEN
        RAISE EXCEPTION 'listening_history: song % does not exist', NEW.song_id;
    END IF;

    IF NEW.listened_at < v_release_date THEN
        RAISE EXCEPTION 'listening_history: cannot log a listen on % before the song''s album released (%)',
            NEW.listened_at, v_release_date;
    END IF;

    IF NEW.listened_at > now() THEN
        RAISE EXCEPTION 'listening_history: cannot log a listen in the future (%)', NEW.listened_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t1_validate_listen ON listening_history;
CREATE TRIGGER t1_validate_listen
    BEFORE INSERT ON listening_history
    FOR EACH ROW EXECUTE FUNCTION trg_validate_listen();

-- ── T2 (BR5): a song cannot be added to a playlist before that playlist existed ──
CREATE OR REPLACE FUNCTION trg_validate_playlist_add()
RETURNS TRIGGER AS $$
DECLARE
    v_created_date TIMESTAMPTZ;
BEGIN
    SELECT created_date INTO v_created_date FROM playlist WHERE playlist_id = NEW.playlist_id;

    IF v_created_date IS NULL THEN
        RAISE EXCEPTION 'playlist_song: playlist % does not exist', NEW.playlist_id;
    END IF;

    IF NEW.added_date < v_created_date THEN
        RAISE EXCEPTION 'playlist_song: added_date (%) is before the playlist was created (%)',
            NEW.added_date, v_created_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t2_validate_playlist_add ON playlist_song;
CREATE TRIGGER t2_validate_playlist_add
    BEFORE INSERT ON playlist_song
    FOR EACH ROW EXECUTE FUNCTION trg_validate_playlist_add();

-- ── T3 (BR6): a song's play_count always equals the number of times it has been played ──
CREATE OR REPLACE FUNCTION trg_play_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE song SET play_count = play_count + 1 WHERE song_id = NEW.song_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE song SET play_count = play_count - 1 WHERE song_id = OLD.song_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t3_play_count ON listening_history;
CREATE TRIGGER t3_play_count
    AFTER INSERT OR DELETE ON listening_history
    FOR EACH ROW EXECUTE FUNCTION trg_play_count();

-- ── T4 (BR7): users are at least 13, subscriptions cannot start in the future ──
-- One function, two tables — a CHECK constraint can't express either half of this
-- because both depend on CURRENT_DATE, which CHECK should never read (design doc
-- section 4): a row that was valid yesterday must not become invalid, untouched,
-- just because a day passed.
CREATE OR REPLACE FUNCTION trg_validate_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        IF NEW.date_of_birth > CURRENT_DATE - INTERVAL '13 years' THEN
            RAISE EXCEPTION 'users: must be at least 13 years old (date_of_birth %)', NEW.date_of_birth;
        END IF;
    ELSIF TG_TABLE_NAME = 'subscription' THEN
        IF NEW.start_date > CURRENT_DATE THEN
            RAISE EXCEPTION 'subscription: start_date (%) cannot be in the future', NEW.start_date;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t4_validate_dates_users ON users;
CREATE TRIGGER t4_validate_dates_users
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trg_validate_dates();

DROP TRIGGER IF EXISTS t4_validate_dates_subscription ON subscription;
CREATE TRIGGER t4_validate_dates_subscription
    BEFORE INSERT OR UPDATE ON subscription
    FOR EACH ROW EXECUTE FUNCTION trg_validate_dates();

-- ── T5 (BR8): a user without an active paid subscription owns at most 5 playlists ──
CREATE OR REPLACE FUNCTION trg_playlist_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_has_active_paid BOOLEAN;
    v_playlist_count INT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM subscription
        WHERE user_id = NEW.user_id AND payment_status = 'Paid' AND end_date >= CURRENT_DATE
    ) INTO v_has_active_paid;

    IF v_has_active_paid THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_playlist_count FROM playlist WHERE user_id = NEW.user_id;

    IF v_playlist_count >= 5 THEN
        RAISE EXCEPTION 'playlist: free users may own at most 5 playlists (user % already has %)',
            NEW.user_id, v_playlist_count;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t5_playlist_limit ON playlist;
CREATE TRIGGER t5_playlist_limit
    BEFORE INSERT ON playlist
    FOR EACH ROW EXECUTE FUNCTION trg_playlist_limit();

-- ══════════════════════════════════════════════
-- PART 2: Application-facing functions (called via supabase.rpc())
-- Each one is the single transaction boundary for a workflow that touches more
-- than one relation or has to respect a business rule beyond a single CHECK.
-- All run SECURITY INVOKER (the default) — they rely on the RLS policies in
-- 04_rls_policies.sql for authorization, not on elevated privilege.
-- ══════════════════════════════════════════════

-- ── release_album (BR3, W1): an album's songs must each have a Lead performer ──
-- Total participation of Song in Performs can't be written as a foreign key, since
-- "every song has >=1 lead performer" is a constraint on a relationship, not a
-- column. So songs are only ever inserted through this function: it builds the
-- whole release (album + songs + credits) as one transaction and aborts entirely
-- if any track is missing a Lead credit.
--
-- p_songs shape: [{"title": "...", "duration_seconds": 200,
--                   "performers": [{"artist_id": 1, "role": "Lead"}, ...]}, ...]
CREATE OR REPLACE FUNCTION release_album(
    p_artist_id INT,
    p_title TEXT,
    p_release_date DATE,
    p_album_type TEXT,
    p_songs JSONB
) RETURNS INT AS $$
DECLARE
    v_album_id INT;
    v_song JSONB;
    v_song_id INT;
    v_performer JSONB;
    v_has_lead BOOLEAN;
BEGIN
    IF app_artist_id() IS DISTINCT FROM p_artist_id AND NOT is_admin() THEN
        RAISE EXCEPTION 'release_album: you may only release albums for your own artist profile';
    END IF;

    IF jsonb_array_length(p_songs) = 0 THEN
        RAISE EXCEPTION 'release_album: an album needs at least one song';
    END IF;

    INSERT INTO album (title, release_date, album_type, artist_id)
    VALUES (p_title, p_release_date, p_album_type, p_artist_id)
    RETURNING album_id INTO v_album_id;

    FOR v_song IN SELECT * FROM jsonb_array_elements(p_songs) LOOP
        v_has_lead := FALSE;
        FOR v_performer IN SELECT * FROM jsonb_array_elements(v_song->'performers') LOOP
            IF v_performer->>'role' = 'Lead' THEN
                v_has_lead := TRUE;
            END IF;
        END LOOP;

        IF NOT v_has_lead THEN
            RAISE EXCEPTION 'release_album: song "%" has no Lead performer — rolling back the whole release',
                v_song->>'title';
        END IF;

        INSERT INTO song (title, duration_seconds, album_id)
        VALUES (v_song->>'title', (v_song->>'duration_seconds')::INT, v_album_id)
        RETURNING song_id INTO v_song_id;

        FOR v_performer IN SELECT * FROM jsonb_array_elements(v_song->'performers') LOOP
            INSERT INTO performs (artist_id, song_id, role)
            VALUES ((v_performer->>'artist_id')::INT, v_song_id, v_performer->>'role');
        END LOOP;
    END LOOP;

    RETURN v_album_id;
END;
$$ LANGUAGE plpgsql;

-- ── record_listen (W2): the only way a listen gets logged ──
-- user_id is taken from the caller's own session, never from the argument list —
-- otherwise any logged-in user could inflate another user's (or song's) stats.
CREATE OR REPLACE FUNCTION record_listen(
    p_song_id INT,
    p_device_type TEXT DEFAULT 'Web'
) RETURNS listening_history AS $$
DECLARE
    v_row listening_history;
BEGIN
    INSERT INTO listening_history (user_id, song_id, device_type)
    VALUES (app_user_id(), p_song_id, p_device_type)
    RETURNING * INTO v_row;
    RETURN v_row;
END;
$$ LANGUAGE plpgsql;

-- ── add_to_playlist (W3): add a song, or no-op if it's already there (BR1) ──
-- Returns TRUE if the song was newly added, FALSE if it was already in the playlist.
CREATE OR REPLACE FUNCTION add_to_playlist(
    p_playlist_id INT,
    p_song_id INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_owner INT;
    v_inserted BOOLEAN;
BEGIN
    SELECT user_id INTO v_owner FROM playlist WHERE playlist_id = p_playlist_id;

    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'add_to_playlist: playlist % does not exist', p_playlist_id;
    END IF;

    IF v_owner IS DISTINCT FROM app_user_id() AND NOT is_admin() THEN
        RAISE EXCEPTION 'add_to_playlist: you do not own playlist %', p_playlist_id;
    END IF;

    INSERT INTO playlist_song (playlist_id, song_id)
    VALUES (p_playlist_id, p_song_id)
    ON CONFLICT (playlist_id, song_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted > 0;
END;
$$ LANGUAGE plpgsql;

-- ── subscribe (W3): start or renew a subscription ──
-- Real payment processing is explicitly out of scope (design doc section 1.1), so
-- this simulates a successful checkout — it marks payment_status 'Paid' outright
-- rather than pretending to integrate with a payment gateway that isn't there.
CREATE OR REPLACE FUNCTION subscribe(
    p_plan_type TEXT,
    p_duration_days INT DEFAULT 30
) RETURNS subscription AS $$
DECLARE
    v_row subscription;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM plan WHERE plan_type = p_plan_type) THEN
        RAISE EXCEPTION 'subscribe: unknown plan_type %', p_plan_type;
    END IF;

    INSERT INTO subscription (user_id, plan_type, start_date, end_date, payment_status)
    VALUES (app_user_id(), p_plan_type, CURRENT_DATE, CURRENT_DATE + p_duration_days, 'Paid')
    ON CONFLICT (user_id) DO UPDATE SET
        plan_type = EXCLUDED.plan_type,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        payment_status = 'Paid'
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$ LANGUAGE plpgsql;
