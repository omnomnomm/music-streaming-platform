-- =============================================
-- Spotify DBS — Row Level Security
-- Run AFTER 02_triggers_and_functions.sql (policies below call app_user_id() /
-- app_artist_id() / is_admin()).
--
-- Model: the catalog (artist/album/song/performs/plan) is public to read, like a
-- real streaming catalog or price list. Writes to the catalog are restricted to
-- the owning artist (their own songs/albums) or an admin. Every listener-specific
-- relation (users, subscription, playlist, playlist_song, likes,
-- listening_history) is restricted to its own row, with admins able to see and
-- manage everything.
-- =============================================

ALTER TABLE artist ENABLE ROW LEVEL SECURITY;
ALTER TABLE album ENABLE ROW LEVEL SECURITY;
ALTER TABLE song ENABLE ROW LEVEL SECURITY;
ALTER TABLE performs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_song ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_history ENABLE ROW LEVEL SECURITY;

-- ── Artist: public catalog read; writes by the owning artist or an admin ──
DROP POLICY IF EXISTS artist_select_all ON artist;
CREATE POLICY artist_select_all ON artist FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS artist_update_own_or_admin ON artist;
CREATE POLICY artist_update_own_or_admin ON artist FOR UPDATE
    USING (artist_id = app_artist_id() OR is_admin())
    WITH CHECK (artist_id = app_artist_id() OR is_admin());

DROP POLICY IF EXISTS artist_insert_admin ON artist;
CREATE POLICY artist_insert_admin ON artist FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS artist_delete_admin ON artist;
CREATE POLICY artist_delete_admin ON artist FOR DELETE USING (is_admin());

-- ── Album: public read; the owning artist (via release_album) or admin writes ──
DROP POLICY IF EXISTS album_select_all ON album;
CREATE POLICY album_select_all ON album FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS album_insert_own_or_admin ON album;
CREATE POLICY album_insert_own_or_admin ON album FOR INSERT
    WITH CHECK (artist_id = app_artist_id() OR is_admin());

DROP POLICY IF EXISTS album_update_own_or_admin ON album;
CREATE POLICY album_update_own_or_admin ON album FOR UPDATE
    USING (artist_id = app_artist_id() OR is_admin())
    WITH CHECK (artist_id = app_artist_id() OR is_admin());

DROP POLICY IF EXISTS album_delete_own_or_admin ON album;
CREATE POLICY album_delete_own_or_admin ON album FOR DELETE
    USING (artist_id = app_artist_id() OR is_admin());

-- ── Song: public read; writable only through an owned album (or admin) ──
DROP POLICY IF EXISTS song_select_all ON song;
CREATE POLICY song_select_all ON song FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS song_insert_own_or_admin ON song;
CREATE POLICY song_insert_own_or_admin ON song FOR INSERT
    WITH CHECK (
        is_admin() OR EXISTS (
            SELECT 1 FROM album al WHERE al.album_id = song.album_id AND al.artist_id = app_artist_id()
        )
    );

DROP POLICY IF EXISTS song_update_own_or_admin ON song;
CREATE POLICY song_update_own_or_admin ON song FOR UPDATE
    USING (
        is_admin() OR EXISTS (
            SELECT 1 FROM album al WHERE al.album_id = song.album_id AND al.artist_id = app_artist_id()
        )
    );

DROP POLICY IF EXISTS song_delete_own_or_admin ON song;
CREATE POLICY song_delete_own_or_admin ON song FOR DELETE
    USING (
        is_admin() OR EXISTS (
            SELECT 1 FROM album al WHERE al.album_id = song.album_id AND al.artist_id = app_artist_id()
        )
    );

-- ── Performs: public read; credits are set by whoever owns the song's album ──
DROP POLICY IF EXISTS performs_select_all ON performs;
CREATE POLICY performs_select_all ON performs FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS performs_insert_own_or_admin ON performs;
CREATE POLICY performs_insert_own_or_admin ON performs FOR INSERT
    WITH CHECK (
        is_admin() OR EXISTS (
            SELECT 1 FROM song s JOIN album al ON al.album_id = s.album_id
            WHERE s.song_id = performs.song_id AND al.artist_id = app_artist_id()
        )
    );

DROP POLICY IF EXISTS performs_delete_own_or_admin ON performs;
CREATE POLICY performs_delete_own_or_admin ON performs FOR DELETE
    USING (
        is_admin() OR EXISTS (
            SELECT 1 FROM song s JOIN album al ON al.album_id = s.album_id
            WHERE s.song_id = performs.song_id AND al.artist_id = app_artist_id()
        )
    );

-- ── Plan: public read (it's the pricing page); only an admin changes prices ──
DROP POLICY IF EXISTS plan_select_all ON plan;
CREATE POLICY plan_select_all ON plan FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS plan_write_admin ON plan;
CREATE POLICY plan_write_admin ON plan FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── Users: see/update your own row; admins see/manage everyone ──
-- Note: these policies check auth_id = auth.uid() directly rather than calling
-- app_user_id(), so there is no self-referential call back into this same table.
DROP POLICY IF EXISTS users_select_own_or_admin ON users;
CREATE POLICY users_select_own_or_admin ON users FOR SELECT
    USING (auth_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS users_insert_self ON users;
CREATE POLICY users_insert_self ON users FOR INSERT
    WITH CHECK (auth_id = auth.uid());

DROP POLICY IF EXISTS users_update_own_or_admin ON users;
CREATE POLICY users_update_own_or_admin ON users FOR UPDATE
    USING (auth_id = auth.uid() OR is_admin())
    WITH CHECK (auth_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS users_delete_admin ON users;
CREATE POLICY users_delete_admin ON users FOR DELETE USING (is_admin());

-- ── Subscription: own row only, or admin ──
DROP POLICY IF EXISTS subscription_all_own_or_admin ON subscription;
CREATE POLICY subscription_all_own_or_admin ON subscription FOR ALL
    USING (user_id = app_user_id() OR is_admin())
    WITH CHECK (user_id = app_user_id() OR is_admin());

-- ── Playlist: own row only, or admin ──
DROP POLICY IF EXISTS playlist_all_own_or_admin ON playlist;
CREATE POLICY playlist_all_own_or_admin ON playlist FOR ALL
    USING (user_id = app_user_id() OR is_admin())
    WITH CHECK (user_id = app_user_id() OR is_admin());

-- ── Playlist_Song: only through a playlist you own, or admin ──
DROP POLICY IF EXISTS playlist_song_all_own_or_admin ON playlist_song;
CREATE POLICY playlist_song_all_own_or_admin ON playlist_song FOR ALL
    USING (
        is_admin() OR EXISTS (
            SELECT 1 FROM playlist p WHERE p.playlist_id = playlist_song.playlist_id AND p.user_id = app_user_id()
        )
    )
    WITH CHECK (
        is_admin() OR EXISTS (
            SELECT 1 FROM playlist p WHERE p.playlist_id = playlist_song.playlist_id AND p.user_id = app_user_id()
        )
    );

-- ── Likes: own rows only, or admin ──
DROP POLICY IF EXISTS likes_all_own_or_admin ON likes;
CREATE POLICY likes_all_own_or_admin ON likes FOR ALL
    USING (user_id = app_user_id() OR is_admin())
    WITH CHECK (user_id = app_user_id() OR is_admin());

-- ── Listening_History: you can log/see your own plays; admin sees all ──
-- Chart/Wrapped aggregates are NOT read through this table directly by listeners —
-- they go through the reporting views in 04_views_and_queries.sql, which are owned by the
-- table owner and so are not row-filtered the way direct table access is (same
-- reasoning real "see everyone's play counts, but not everyone's play history"
-- charts features need). See the comment at the top of that file.
DROP POLICY IF EXISTS listening_history_select_own_or_admin ON listening_history;
CREATE POLICY listening_history_select_own_or_admin ON listening_history FOR SELECT
    USING (user_id = app_user_id() OR is_admin());

DROP POLICY IF EXISTS listening_history_insert_own ON listening_history;
CREATE POLICY listening_history_insert_own ON listening_history FOR INSERT
    WITH CHECK (user_id = app_user_id() OR is_admin());
