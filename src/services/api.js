// ========================================
// API Service Layer — Spotify DBS
// Uses Supabase for all data operations. Auth (login/signup/session) lives in
// AuthContext, which calls supabase.auth directly and signUp() below — this
// file is everything else.
// ========================================
import { supabase } from './supabaseClient';

// ── Sign up ───────────────────────────────
// Creates a real Supabase Auth account, then the matching public.users profile
// row. Self-serve signup only ever creates 'listener' accounts — artist and
// admin accounts are provisioned by an admin (see AdminPage), since an artist
// account has to point at an existing artist catalog entry, and that's an
// admin-only insert (RLS).
export async function signUp({ name, email, password, dateOfBirth, country }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    if (!data.session) {
        return { success: false, error: 'Account created — check your email to confirm it, then log in.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert([{ auth_id: data.user.id, name, email, date_of_birth: dateOfBirth, country, account_type: 'listener' }])
        .select()
        .single();

    if (profileError) return { success: false, error: profileError.message };
    return { success: true, user: profile };
}

// ── Artists ───────────────────────────────
export async function getArtists() {
    const { data } = await supabase.from('artist').select('*');
    return data || [];
}

export async function getArtistById(id) {
    const { data } = await supabase.from('artist').select('*').eq('artist_id', Number(id)).single();
    return data;
}

// ── Albums ────────────────────────────────
export async function getAlbums() {
    const { data } = await supabase.from('album').select('*');
    return data || [];
}

export async function getAlbumById(id) {
    const { data } = await supabase.from('album').select('*').eq('album_id', Number(id)).single();
    return data;
}

export async function getAlbumsByArtist(artistId) {
    const { data } = await supabase.from('album').select('*').eq('artist_id', Number(artistId));
    return data || [];
}

// ── Songs ─────────────────────────────────
export async function getSongs() {
    const { data } = await supabase.from('song').select('*');
    return data || [];
}

export async function getSongById(id) {
    const { data } = await supabase.from('song').select('*').eq('song_id', Number(id)).single();
    return data;
}

export async function getSongsByAlbum(albumId) {
    const { data } = await supabase.from('song').select('*').eq('album_id', Number(albumId));
    return data || [];
}

// ── Performs ──────────────────────────────
export async function getPerformsBySong(songId) {
    const { data } = await supabase.from('performs').select('*').eq('song_id', Number(songId));
    return data || [];
}

export async function getPerformsByArtist(artistId) {
    const { data } = await supabase.from('performs').select('*').eq('artist_id', Number(artistId));
    return data || [];
}

export async function getSongArtists(songId) {
    const { data } = await supabase
        .from('performs')
        .select('*, artist(*)')
        .eq('song_id', Number(songId));
    return (data || []).map(p => ({ ...p.artist, role: p.role }));
}

// ── Users ─────────────────────────────────
export async function getUsers() {
    const { data } = await supabase.from('users').select('*');
    return data || [];
}

export async function getUserById(id) {
    const { data } = await supabase.from('users').select('*').eq('user_id', Number(id)).single();
    return data;
}

// ── Plans / Subscriptions ─────────────────
export async function getPlans() {
    const { data } = await supabase.from('plan').select('*').order('monthly_price');
    return data || [];
}

export async function getSubscriptions() {
    const { data } = await supabase.from('subscription').select('*');
    return data || [];
}

export async function getUserSubscription(userId) {
    const { data } = await supabase.from('subscription').select('*').eq('user_id', Number(userId)).single();
    return data;
}

// subscribe() runs as the one transaction described in the design doc (W3) —
// start_date/payment_status are set server-side, never trusted from the client.
export async function subscribe(planType, durationDays = 30) {
    const { data, error } = await supabase.rpc('subscribe', { p_plan_type: planType, p_duration_days: durationDays });
    if (error) throw new Error(`Subscribe failed: ${error.message}`);
    return data;
}

// ── Playlists ─────────────────────────────
export async function getPlaylists() {
    const { data } = await supabase.from('playlist').select('*');
    return data || [];
}

export async function getPlaylistById(id) {
    const { data } = await supabase.from('playlist').select('*').eq('playlist_id', Number(id)).single();
    return data;
}

export async function getUserPlaylists(userId) {
    const { data } = await supabase.from('playlist').select('*').eq('user_id', Number(userId));
    return data || [];
}

export async function getPlaylistSongs(playlistId) {
    const { data } = await supabase
        .from('playlist_song')
        .select('*, song(*)')
        .eq('playlist_id', Number(playlistId));
    return (data || []).map(ps => ({ ...ps.song, added_date: ps.added_date })).filter(s => s.title);
}

// ── Likes ─────────────────────────────────
export async function getUserLikes(userId) {
    const { data } = await supabase
        .from('likes')
        .select('*, song(*)')
        .eq('user_id', Number(userId));
    return (data || []).map(l => ({ ...l.song, liked_date: l.liked_date })).filter(s => s.title);
}

export async function isLiked(userId, songId) {
    const { data } = await supabase
        .from('likes')
        .select('user_id')
        .eq('user_id', Number(userId))
        .eq('song_id', Number(songId));
    return (data || []).length > 0;
}

// ── Listening History / Analytics ─────────
// Platform-wide charts (everything below that scans "all of listening_history")
// read from reporting views, not the table directly — listening_history's own
// Row Level Security restricts a direct table read to the caller's own rows, so
// client-side aggregation over supabase.from('listening_history') would silently
// turn "platform charts" into "my own stats" for every non-admin user. The
// views (sql/04_views_and_queries.sql) are owned by the table owner, which is
// how they're allowed to aggregate across everyone.
export async function getUserHistory(userId) {
    const { data } = await supabase
        .from('listening_history')
        .select('*, song(*)')
        .eq('user_id', Number(userId))
        .order('listened_at', { ascending: false })
        .limit(50);
    return (data || []).map(l => ({ ...l.song, listened_at: l.listened_at, device_type: l.device_type })).filter(s => s.title);
}

// Top songs by all-time play_count — song.play_count is public and
// trigger-maintained (T3), so this is a plain, RLS-unaffected read.
export async function getTopSongs(limit = 10) {
    const { data } = await supabase.from('song').select('*').order('play_count', { ascending: false }).limit(limit);
    return (data || []).map(s => ({ ...s, streams: s.play_count }));
}

// "Most popular" = highest 30-day monthly listener count (v_artist_monthly_listeners).
export async function getMostPopularArtist() {
    const { data } = await supabase
        .from('v_artist_monthly_listeners')
        .select('*')
        .order('monthly_listeners', { ascending: false })
        .limit(1)
        .single();
    if (!data || !data.monthly_listeners) return null;
    return { ...data, streams: data.monthly_listeners };
}

// performs is public-read and not time-scoped, so this needs no view.
export async function getMostCollaborativeArtist() {
    const { data: allPerforms } = await supabase.from('performs').select('*').eq('role', 'Featured');
    if (!allPerforms) return null;
    const collabs = {};
    allPerforms.forEach(p => { collabs[p.artist_id] = (collabs[p.artist_id] || 0) + 1; });
    const sorted = Object.entries(collabs).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    const artist = await getArtistById(Number(sorted[0][0]));
    return artist ? { ...artist, collaborations: sorted[0][1] } : null;
}

// A listener's own top artist — reads their own listening_history, which RLS
// already scopes to just them, so this needs no view.
export async function getUserTopArtist(userId) {
    const { data: history } = await supabase.from('listening_history').select('song_id').eq('user_id', Number(userId));
    if (!history || history.length === 0) return null;
    const songIds = [...new Set(history.map(h => h.song_id))];
    const { data: performs } = await supabase.from('performs').select('*').in('song_id', songIds).eq('role', 'Lead');
    const counts = {};
    history.forEach(l => {
        const perf = (performs || []).filter(p => p.song_id === l.song_id);
        perf.forEach(p => { counts[p.artist_id] = (counts[p.artist_id] || 0) + 1; });
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;
    const artist = await getArtistById(Number(sorted[0][0]));
    return artist ? { ...artist, plays: sorted[0][1] } : null;
}

export async function getDeviceDistribution() {
    const { data } = await supabase.from('v_device_distribution').select('*');
    return (data || [])
        .map(d => ({ device: d.device_type, count: d.play_count }))
        .sort((a, b) => b.count - a.count);
}

// Admin-only in practice (gated in ChartsPage UI) — a non-admin's own
// subscription row is all RLS would return anyway, which would misreport as
// "total" platform revenue, so this should only ever be called for an admin.
export async function getSubscriptionRevenue() {
    const [{ data: subs }, plans] = await Promise.all([
        supabase.from('subscription').select('*').eq('payment_status', 'Paid'),
        getPlans(),
    ]);
    const rates = Object.fromEntries(plans.map(p => [p.plan_type, Number(p.monthly_price)]));
    const paid = subs || [];
    const total = paid.reduce((sum, s) => sum + (rates[s.plan_type] || 0), 0);
    return {
        total: total.toFixed(2),
        breakdown: {
            Premium: paid.filter(s => s.plan_type === 'Premium').length,
            Family: paid.filter(s => s.plan_type === 'Family').length,
        },
    };
}

// ── Genre Trends (last 30 days, platform-wide) ──
export async function getGenreTrends() {
    const { data } = await supabase.from('v_genre_trends').select('*').order('plays', { ascending: false });
    return (data || []).map(g => ({ genre: g.genre, count: g.plays, pctShare: g.pct_share }));
}

// ── Listening Trends (daily counts, platform-wide) ──
export async function getListeningTrends(days = 30) {
    const { data } = await supabase.from('v_daily_plays').select('*');
    const dayCounts = {};
    (data || []).forEach(d => { dayCounts[d.play_date] = d.plays; });
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        result.push({ date: key, plays: dayCounts[key] || 0 });
    }
    return result;
}

// ── User Wrapped / Personal Stats ────────
// Reads the caller's own listening_history, which RLS already scopes to just
// them (or to the target user for an admin), so — like getUserTopArtist — this
// needs no reporting view.
export async function getUserWrapped(userId) {
    const { data: history } = await supabase.from('listening_history').select('song_id, listened_at').eq('user_id', Number(userId));
    if (!history || history.length === 0) return null;
    const songIds = [...new Set(history.map(h => h.song_id))];
    const { data: songs } = await supabase.from('song').select('*').in('song_id', songIds);
    const { data: performs } = await supabase.from('performs').select('song_id, artist_id').in('song_id', songIds).eq('role', 'Lead');
    const artistIds = [...new Set((performs || []).map(p => p.artist_id))];
    const { data: artists } = await supabase.from('artist').select('*').in('artist_id', artistIds);

    const songMap = {};
    (songs || []).forEach(s => { songMap[s.song_id] = s; });
    const totalSeconds = history.reduce((sum, h) => sum + (songMap[h.song_id]?.duration_seconds || 0), 0);

    const songCounts = {};
    history.forEach(h => { songCounts[h.song_id] = (songCounts[h.song_id] || 0) + 1; });
    const topSongIds = Object.entries(songCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topSongs = topSongIds.map(([id, plays]) => ({ ...(songMap[Number(id)] || {}), plays }));

    const songArtist = {};
    (performs || []).forEach(p => { songArtist[p.song_id] = p.artist_id; });
    const artistCounts = {};
    history.forEach(h => {
        const aid = songArtist[h.song_id];
        if (aid) artistCounts[aid] = (artistCounts[aid] || 0) + 1;
    });
    const topArtistIds = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const artistMap = {};
    (artists || []).forEach(a => { artistMap[a.artist_id] = a; });
    const topArtists = topArtistIds.map(([id, plays]) => ({ ...(artistMap[Number(id)] || {}), plays }));

    const genreCounts = {};
    history.forEach(h => {
        const aid = songArtist[h.song_id];
        const genre = artistMap[aid]?.genre;
        if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });
    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

    return {
        totalMinutes: Math.round(totalSeconds / 60),
        totalStreams: history.length,
        uniqueSongs: songIds.length,
        uniqueArtists: artistIds.length,
        topSongs,
        topArtists,
        topGenre: topGenre ? { genre: topGenre[0], count: topGenre[1] } : null,
        genreBreakdown: Object.entries(genreCounts).map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count),
    };
}

export async function search(query) {
    const q = `%${query}%`;
    const [artistRes, albumRes, songRes] = await Promise.all([
        supabase.from('artist').select('*').ilike('artist_name', q),
        supabase.from('album').select('*').ilike('title', q),
        supabase.from('song').select('*').ilike('title', q),
    ]);
    return {
        artists: artistRes.data || [],
        albums: albumRes.data || [],
        songs: songRes.data || [],
    };
}

// ── CRUD Operations (for Admin/Demo) ─────
export async function addSong(song) {
    const { data, error } = await supabase.from('song').insert([song]).select().single();
    if (error) throw new Error(`Add song failed: ${error.message}`);
    return data;
}
export async function updateSong(songId, updates) {
    const { data, error } = await supabase.from('song').update(updates).eq('song_id', Number(songId)).select().single();
    if (error) throw new Error(`Update song failed: ${error.message}`);
    return data;
}
export async function deleteSong(songId) {
    // Delete related performs entries first
    await supabase.from('performs').delete().eq('song_id', Number(songId));
    const { data, error } = await supabase.from('song').delete().eq('song_id', Number(songId)).select().single();
    if (error) throw new Error(`Delete song failed: ${error.message}`);
    return data;
}

export async function updateUser(userId, updates) {
    const { data, error } = await supabase.from('users').update(updates).eq('user_id', Number(userId)).select().single();
    if (error) throw new Error(`Update user failed: ${error.message}`);
    return data;
}
export async function deleteUser(userId) {
    const { data, error } = await supabase.from('users').delete().eq('user_id', Number(userId)).select().single();
    if (error) throw new Error(`Delete user failed: ${error.message}`);
    return data;
}

// ── Interactive Features ─────────────────

// Toggle like on a song (like if not liked, unlike if already liked)
export async function toggleLike(userId, songId) {
    const liked = await isLiked(userId, songId);
    if (liked) {
        await supabase.from('likes').delete().eq('user_id', Number(userId)).eq('song_id', Number(songId));
        return false; // now unliked
    } else {
        await supabase.from('likes').insert([{ user_id: Number(userId), song_id: Number(songId) }]);
        return true; // now liked
    }
}

// Get like count for a song
export async function getSongLikeCount(songId) {
    const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('song_id', Number(songId));
    return count || 0;
}

// Record a listen — goes through the record_listen() RPC (design doc W2), which
// takes user_id from the caller's own session rather than trusting an argument,
// and triggers T1 (release-date/future validation) and T3 (play_count) fire
// exactly as if this were any other insert into listening_history.
export async function recordListen(_userId, songId, deviceType = 'Web') {
    if (!songId) return;
    const { error } = await supabase.rpc('record_listen', { p_song_id: Number(songId), p_device_type: deviceType });
    if (error) console.warn('record_listen failed:', error.message);
}

// Create a new playlist (trigger T5 enforces the free-tier 5-playlist cap)
export async function createPlaylist(userId, playlistName) {
    const { data, error } = await supabase.from('playlist').insert([{
        playlist_name: playlistName,
        user_id: Number(userId)
    }]).select().single();
    if (error) throw new Error(`Create playlist failed: ${error.message}`);
    return data;
}

// Delete a playlist
export async function deletePlaylist(playlistId) {
    await supabase.from('playlist_song').delete().eq('playlist_id', Number(playlistId));
    const { data } = await supabase.from('playlist').delete().eq('playlist_id', Number(playlistId)).select().single();
    return data;
}

// Add a song to a playlist, via the add_to_playlist() RPC (ownership-checked,
// and a no-op — not an error — if the song's already there, per BR1).
export async function addToPlaylist(playlistId, songId) {
    const { data, error } = await supabase.rpc('add_to_playlist', {
        p_playlist_id: Number(playlistId),
        p_song_id: Number(songId),
    });
    return { data: { added: data }, error };
}

// Remove a song from a playlist
export async function removeFromPlaylist(playlistId, songId) {
    await supabase.from('playlist_song').delete()
        .eq('playlist_id', Number(playlistId))
        .eq('song_id', Number(songId));
}

// Get all songs for a specific artist
export async function getArtistSongs(artistId) {
    const { data: performs } = await supabase.from('performs').select('song_id, role').eq('artist_id', Number(artistId));
    if (!performs || performs.length === 0) return [];
    const songIds = performs.map(p => p.song_id);
    const { data: songs } = await supabase.from('song').select('*').in('song_id', songIds).order('song_id', { ascending: false });
    return (songs || []).map(s => {
        const p = performs.find(p => p.song_id === s.song_id);
        return { ...s, role: p?.role || 'Lead' };
    });
}

// Get all albums for a specific artist
export async function getArtistAlbums(artistId) {
    const { data } = await supabase.from('album').select('*').eq('artist_id', Number(artistId)).order('release_date', { ascending: false });
    return data || [];
}

// This artist's monthly listener count (v_artist_monthly_listeners — not a
// stored column, see 01_schema.sql's comment on why).
export async function getArtistMonthlyListeners(artistId) {
    const { data } = await supabase.from('v_artist_monthly_listeners').select('monthly_listeners').eq('artist_id', Number(artistId)).single();
    return data?.monthly_listeners || 0;
}

// Release an album (BR3, design doc W1): album + every song + every performer
// credit as one transaction via the release_album() RPC — it aborts the whole
// release if any song is missing a Lead performer, instead of leaving behind a
// half-released album the way three separate inserts could.
//
// songs: [{ title, duration_seconds, performers: [{ artist_id, role }] }, ...]
export async function releaseAlbum({ artistId, title, releaseDate, albumType, songs }) {
    const { data, error } = await supabase.rpc('release_album', {
        p_artist_id: Number(artistId),
        p_title: title,
        p_release_date: releaseDate,
        p_album_type: albumType,
        p_songs: songs,
    });
    if (error) throw new Error(`Release failed: ${error.message}`);
    return data; // album_id
}
