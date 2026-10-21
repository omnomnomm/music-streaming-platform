import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { getArtistSongs, getArtistAlbums, getArtistById, getArtistMonthlyListeners, releaseAlbum, deleteSong } from '../services/api';
import { Mic2, Plus, Trash2, Play, Disc, Music, X, Album } from 'lucide-react';

export default function ArtistDashboard() {
    const { user } = useAuth();
    const { playSong } = usePlayer();
    const [artist, setArtist] = useState(null);
    const [songs, setSongs] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [monthlyListeners, setMonthlyListeners] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const artistId = user?.artist_id;

    useEffect(() => {
        if (!artistId) { setLoading(false); return; }
        async function load() {
            setLoading(true);
            const [a, s, al, ml] = await Promise.all([
                getArtistById(artistId),
                getArtistSongs(artistId),
                getArtistAlbums(artistId),
                getArtistMonthlyListeners(artistId),
            ]);
            setArtist(a);
            setSongs(s);
            setAlbums(al);
            setMonthlyListeners(ml);
            setLoading(false);
        }
        load();
    }, [artistId, refreshKey]);

    const handleDelete = async (songId) => {
        if (!confirm('Delete this song permanently?')) return;
        await deleteSong(songId);
        setRefreshKey(r => r + 1);
    };

    if (!artistId) return (
        <div className="p-6 pb-28 animate-fade-in text-center py-20">
            <Mic2 size={48} className="mx-auto text-spotify-subtle mb-4" />
            <p className="text-spotify-subtle text-lg">This account is not linked to an artist profile.</p>
            <p className="text-spotify-subtle text-sm mt-2">Log in with an artist account to manage your catalog.</p>
        </div>
    );

    if (loading) return <div className="p-6 text-spotify-subtle animate-pulse text-lg">Loading your catalog...</div>;

    return (
        <div className="p-6 pb-28 animate-fade-in space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-spotify-card">
                        <img src={`https://picsum.photos/seed/${(artist?.artist_name || '').toLowerCase().replace(/\s/g, '')}/128/128`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-spotify-green font-semibold">Artist Dashboard</p>
                        <h1 className="text-2xl font-bold">{artist?.artist_name}</h1>
                        <p className="text-spotify-subtle text-sm">{artist?.genre} · {artist?.country} {artist?.verified_status ? '✓ Verified' : '· Unverified'}</p>
                    </div>
                </div>
                <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green-dark transition">
                    <Plus size={16} /> Release
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-xl p-5 text-center">
                    <Music className="mx-auto text-spotify-green mb-2" size={22} />
                    <p className="text-2xl font-black">{songs.length}</p>
                    <p className="text-xs text-spotify-subtle">Songs</p>
                </div>
                <div className="glass rounded-xl p-5 text-center">
                    <Album className="mx-auto text-blue-400 mb-2" size={22} />
                    <p className="text-2xl font-black">{albums.length}</p>
                    <p className="text-xs text-spotify-subtle">Albums</p>
                </div>
                <div className="glass rounded-xl p-5 text-center">
                    <Disc className="mx-auto text-purple-400 mb-2" size={22} />
                    <p className="text-2xl font-black">{monthlyListeners}</p>
                    <p className="text-xs text-spotify-subtle">Monthly Listeners</p>
                </div>
            </div>

            {/* Albums */}
            {albums.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold mb-3">Your Albums</h2>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {albums.map(al => (
                            <div key={al.album_id} className="glass rounded-xl p-4 min-w-[160px] flex-shrink-0">
                                <img src={`https://picsum.photos/seed/album${al.album_id}/120/120`} alt="" className="w-full aspect-square rounded-lg object-cover mb-3" />
                                <p className="font-semibold text-sm truncate">{al.title}</p>
                                <p className="text-xs text-spotify-subtle capitalize">{al.album_type} · {al.release_date}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Songs */}
            <section>
                <h2 className="text-lg font-bold mb-3">Your Songs</h2>
                {songs.length === 0 ? (
                    <div className="glass rounded-xl p-8 text-center">
                        <p className="text-spotify-subtle">No songs yet. Click "Release" to add your first track!</p>
                    </div>
                ) : (
                    <div className="glass rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-spotify-subtle text-left">
                                    <th className="px-4 py-3 w-10">#</th>
                                    <th className="px-4 py-3">Title</th>
                                    <th className="px-4 py-3 hidden md:table-cell">Album</th>
                                    <th className="px-4 py-3">Duration</th>
                                    <th className="px-4 py-3">Plays</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {songs.map((song, i) => {
                                    const al = albums.find(a => a.album_id === song.album_id);
                                    return (
                                        <tr key={song.song_id} className="border-b border-white/5 hover:bg-white/5 transition group">
                                            <td className="px-4 py-3 text-spotify-subtle">
                                                <span className="group-hover:hidden">{i + 1}</span>
                                                <button onClick={() => playSong(song.song_id)} className="hidden group-hover:inline text-spotify-green"><Play size={14} /></button>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{song.title}</td>
                                            <td className="px-4 py-3 text-spotify-subtle hidden md:table-cell">{al?.title || '—'}</td>
                                            <td className="px-4 py-3 text-spotify-subtle">{Math.floor(song.duration_seconds / 60)}:{String(song.duration_seconds % 60).padStart(2, '0')}</td>
                                            <td className="px-4 py-3 text-spotify-subtle">{song.play_count || 0}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDelete(song.song_id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-spotify-subtle hover:text-red-400 transition">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {showModal && createPortal(
                <ReleaseModal artistId={artistId} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); setRefreshKey(r => r + 1); }} />,
                document.body
            )}
        </div>
    );
}

// ── Release modal: builds one release_album() call ──
// Every release — single or multi-track album — goes through release_album()
// as one transaction (design doc BR3/W1): it aborts the whole thing if any
// track is missing a Lead performer, instead of leaving a half-created album
// behind the way separate album/song/performs inserts could. That's also why
// there's no "add a song to an existing album" mode here — an album's track
// list is fixed at release time.
function ReleaseModal({ artistId, onClose, onSave }) {
    const [albumType, setAlbumType] = useState('single'); // 'single' or 'album'
    const [albumTitle, setAlbumTitle] = useState('');
    const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [tracks, setTracks] = useState([{ title: '', duration_seconds: 200 }]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const addTrack = () => setTracks(t => [...t, { title: '', duration_seconds: 200 }]);
    const removeTrack = (i) => setTracks(t => t.filter((_, idx) => idx !== i));
    const updateTrack = (i, field, value) => setTracks(t => t.map((tr, idx) => idx === i ? { ...tr, [field]: value } : tr));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const cleanTracks = tracks.map(t => ({ ...t, title: t.title.trim() })).filter(t => t.title);
        if (cleanTracks.length === 0) {
            setError('Add at least one track with a title');
            return;
        }

        setSaving(true);
        try {
            await releaseAlbum({
                artistId: Number(artistId),
                title: albumType === 'single' ? cleanTracks[0].title : albumTitle.trim(),
                releaseDate,
                albumType,
                songs: cleanTracks.map(t => ({
                    title: t.title,
                    duration_seconds: Number(t.duration_seconds),
                    performers: [{ artist_id: Number(artistId), role: 'Lead' }],
                })),
            });
            setSaving(false);
            onSave();
        } catch (err) {
            setSaving(false);
            setError(err.message || 'Release failed');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }} onClick={onClose}>
            <div className="bg-spotify-dark rounded-2xl p-6 w-full max-w-lg border border-white/10 animate-slide-up max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white">Release Music</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition text-white"><X size={18} /></button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Release Type */}
                    <div>
                        <label className="block text-xs text-spotify-subtle mb-2">Release Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { key: 'single', label: 'Single', icon: Disc },
                                { key: 'album', label: 'Album / EP', icon: Album },
                            ].map(m => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => { setAlbumType(m.key); if (m.key === 'single') setTracks([tracks[0] || { title: '', duration_seconds: 200 }]); }}
                                    className={`p-3 rounded-xl text-center text-xs font-medium transition border ${albumType === m.key
                                            ? 'bg-spotify-green/10 border-spotify-green text-spotify-green'
                                            : 'bg-white/5 border-white/10 text-spotify-subtle hover:bg-white/10'
                                        }`}
                                >
                                    <m.icon size={18} className="mx-auto mb-1" />
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {albumType === 'album' && (
                        <div>
                            <label className="block text-xs text-spotify-subtle mb-1.5">Album Title</label>
                            <input type="text" value={albumTitle} onChange={e => setAlbumTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required placeholder="Enter album title" />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-spotify-subtle mb-1.5">Release Date</label>
                        <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                    </div>

                    {/* Tracks */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs text-spotify-subtle">{albumType === 'single' ? 'Track' : 'Tracklist'}</label>
                            {albumType === 'album' && (
                                <button type="button" onClick={addTrack} className="text-xs text-spotify-green hover:underline flex items-center gap-1"><Plus size={12} /> Add track</button>
                            )}
                        </div>
                        {tracks.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={t.title}
                                    onChange={e => updateTrack(i, 'title', e.target.value)}
                                    placeholder={`Track ${i + 1} title`}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition"
                                    required
                                />
                                <input
                                    type="number"
                                    min={10}
                                    max={3600}
                                    value={t.duration_seconds}
                                    onChange={e => updateTrack(i, 'duration_seconds', e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition"
                                    required
                                    title="Duration (seconds)"
                                />
                                {albumType === 'album' && tracks.length > 1 && (
                                    <button type="button" onClick={() => removeTrack(i)} className="p-2 rounded-lg hover:bg-red-500/20 text-spotify-subtle hover:text-red-400 transition"><Trash2 size={14} /></button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button type="submit" disabled={saving} className="w-full py-3 rounded-full bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green-dark transition disabled:opacity-50">
                        {saving ? 'Releasing...' : 'Release'}
                    </button>
                </form>
            </div>
        </div>
    );
}
