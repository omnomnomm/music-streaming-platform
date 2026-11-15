import { useState, useEffect } from 'react';
import { getTopSongs, getMostPopularArtist, getMostCollaborativeArtist, getDeviceDistribution, getSubscriptionRevenue, getSongArtists, getAlbumById, getGenreTrends, getListeningTrends, getTopSongsInCountry, getStandoutTracks } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { songCover } from '../utils/images';
import { useAuth } from '../context/AuthContext';
import { SongRow } from '../components/Cards';
import { BarChart3, Crown, Users, Smartphone, DollarSign, TrendingUp, Music, Globe2, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

const COLORS = ['#1DB954', '#1ed760', '#15803d', '#4ade80', '#86efac', '#a3e635', '#22d3ee', '#818cf8'];

export default function ChartsPage() {
    const { user } = useAuth();
    const { playSong } = usePlayer();
    const isAdmin = user?.account_type === 'admin';
    const [topSongs, setTopSongs] = useState([]);
    const [popArtist, setPopArtist] = useState(null);
    const [collabArtist, setCollabArtist] = useState(null);
    const [devices, setDevices] = useState([]);
    const [revenue, setRevenue] = useState(null);
    const [genreTrends, setGenreTrends] = useState([]);
    const [listeningTrends, setListeningTrends] = useState([]);
    const [countryTop, setCountryTop] = useState([]);
    const [standout, setStandout] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            // Subscription revenue is platform-wide financial data — RLS limits
            // a non-admin to their own subscription row, so fetching it for
            // anyone else would just compute a misleadingly wrong "total".
            // Skip the call entirely rather than show that.
            const [ts, pa, ca, dev, rev, gt, lt, ct, so] = await Promise.all([
                getTopSongs(10),
                getMostPopularArtist(),
                getMostCollaborativeArtist(),
                getDeviceDistribution(),
                isAdmin ? getSubscriptionRevenue() : Promise.resolve(null),
                getGenreTrends(),
                getListeningTrends(30),
                user?.country ? getTopSongsInCountry(user.country) : Promise.resolve([]),
                getStandoutTracks(8),
            ]);

            const enriched = await Promise.all(ts.map(async (s) => {
                const artists = await getSongArtists(s.song_id);
                const lead = artists.find(a => a.role === 'Lead');
                const featured = artists.filter(a => a.role === 'Featured');
                const album = await getAlbumById(s.album_id);
                return {
                    ...s,
                    artistNames: lead ? lead.artist_name + (featured.length ? ` ft. ${featured.map(a => a.artist_name).join(', ')}` : '') : '',
                    albumTitle: album?.title,
                    name: s.title.length > 18 ? s.title.slice(0, 18) + '…' : s.title,
                };
            }));

            setTopSongs(enriched);
            setPopArtist(pa);
            setCollabArtist(ca);
            setDevices(dev);
            setRevenue(rev);
            setGenreTrends(gt);
            setListeningTrends(lt);
            setCountryTop(ct);
            setStandout(so);
            setLoading(false);
        }
        load();
    }, [isAdmin, user?.country]);

    if (loading) return <div className="p-6 text-spotify-subtle animate-pulse text-lg">Loading analytics...</div>;

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-spotify-dark border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="text-white font-medium">{label}</p>
                {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
            </div>
        );
    };

    return (
        <div className="p-6 pb-28 animate-fade-in space-y-8">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="text-spotify-green" /> Global Charts & Analytics</h1>
                <p className="text-spotify-subtle text-sm mt-1">Platform-wide analytics from listening history</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-5">
                    <Crown className="text-yellow-500 mb-2" size={22} />
                    <p className="text-xs text-spotify-subtle mb-1">Most Popular Artist</p>
                    <p className="font-bold">{popArtist?.artist_name || '—'}</p>
                    <p className="text-xs text-spotify-subtle">{popArtist?.streams || 0} streams</p>
                </div>
                <div className="glass rounded-xl p-5">
                    <Users className="text-blue-400 mb-2" size={22} />
                    <p className="text-xs text-spotify-subtle mb-1">Most Collaborative</p>
                    <p className="font-bold">{collabArtist?.artist_name || '—'}</p>
                    <p className="text-xs text-spotify-subtle">{collabArtist?.collaborations || 0} distinct collaborators</p>
                </div>
                <div className="glass rounded-xl p-5">
                    <TrendingUp className="text-spotify-green mb-2" size={22} />
                    <p className="text-xs text-spotify-subtle mb-1">Total Streams</p>
                    <p className="font-bold">{topSongs.reduce((sum, s) => sum + (s.streams || 0), 0).toLocaleString()}</p>
                    <p className="text-xs text-spotify-subtle">top 10 combined</p>
                </div>
                {isAdmin && revenue && (
                    <div className="glass rounded-xl p-5">
                        <DollarSign className="text-emerald-400 mb-2" size={22} />
                        <p className="text-xs text-spotify-subtle mb-1">Subscription Revenue</p>
                        <p className="font-bold">${revenue.total}</p>
                        <p className="text-xs text-spotify-subtle">{revenue.breakdown.Premium}P / {revenue.breakdown.Family}F</p>
                    </div>
                )}
            </div>

            {/* Listening Trends - Area Chart */}
            {listeningTrends.length > 0 && (
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-spotify-green" /> Listening Trends (Last 30 Days)
                    </h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={listeningTrends}>
                            <defs>
                                <linearGradient id="colorPlays" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#1DB954" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#1DB954" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#a7a7a7" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                            <YAxis stroke="#a7a7a7" tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="plays" stroke="#1DB954" strokeWidth={2} fill="url(#colorPlays)" name="Plays" />
                        </AreaChart>
                    </ResponsiveContainer>
                </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Songs - Bar Chart */}
                {topSongs.length > 0 && (
                    <section className="glass rounded-xl p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Music size={18} className="text-spotify-green" /> Top 10 Most Streamed
                        </h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={topSongs} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                <XAxis type="number" stroke="#a7a7a7" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" width={120} stroke="#a7a7a7" tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="streams" name="Streams" radius={[0, 6, 6, 0]}>
                                    {topSongs.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </section>
                )}

                {/* Device Distribution - Pie Chart */}
                {devices.length > 0 && (
                    <section className="glass rounded-xl p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Smartphone size={18} className="text-blue-400" /> Device Distribution
                        </h2>
                        <div className="flex items-center justify-center gap-6">
                            <ResponsiveContainer width="60%" height={250}>
                                <PieChart>
                                    <Pie data={devices} dataKey="count" nameKey="device" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} strokeWidth={0}>
                                        {devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2">
                                {devices.map((d, i) => (
                                    <div key={d.device} className="flex items-center gap-2 text-sm">
                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-spotify-subtle">{d.device}</span>
                                        <span className="font-semibold ml-1">{d.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {/* Genre Popularity - Horizontal Bar */}
            {genreTrends.length > 0 && (
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <BarChart3 size={18} className="text-purple-400" /> Genre Popularity (Last 30 Days)
                    </h2>
                    <ResponsiveContainer width="100%" height={Math.max(150, genreTrends.length * 50)}>
                        <BarChart data={genreTrends} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                            <XAxis type="number" stroke="#a7a7a7" tick={{ fontSize: 11 }} />
                            <YAxis dataKey="genre" type="category" width={100} stroke="#a7a7a7" tick={{ fontSize: 12 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Plays" radius={[0, 8, 8, 0]}>
                                {genreTrends.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </section>
            )}

            {/* Admin: monthly revenue by plan (Q5, v_monthly_revenue) */}
            {isAdmin && revenue?.rows?.length > 0 && (
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-emerald-400" /> Monthly Revenue by Plan
                    </h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-spotify-subtle border-b border-white/10">
                                <th className="py-2 font-medium">Month</th>
                                <th className="py-2 font-medium">Plan</th>
                                <th className="py-2 font-medium text-right">Paying subscribers</th>
                                <th className="py-2 font-medium text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {revenue.rows.map(r => (
                                <tr key={`${r.month}-${r.plan_type}`} className="border-b border-white/5">
                                    <td className="py-2">{r.month}</td>
                                    <td className="py-2">{r.plan_type}</td>
                                    <td className="py-2 text-right">{r.paying_subscribers}</td>
                                    <td className="py-2 text-right">${r.revenue.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top songs in the viewer's country (Q1, v_top_songs_by_country) */}
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                        <Globe2 size={18} className="text-cyan-400" /> Top in {user?.country || 'your country'}
                    </h2>
                    <p className="text-xs text-spotify-subtle mb-4">Last 30 days, ranked within the country</p>
                    {countryTop.length > 0 ? (
                        <div className="space-y-1">
                            {countryTop.map(s => (
                                <button key={s.song_id} onClick={() => playSong(s.song_id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
                                    <span className="w-6 text-center font-bold text-spotify-green">{s.rank}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{s.title}</p>
                                        <p className="text-xs text-spotify-subtle truncate">{s.artist_name}</p>
                                    </div>
                                    <span className="text-xs text-spotify-subtle">{s.plays} plays</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-spotify-subtle">No plays from {user?.country || 'your country'} in the last 30 days.</p>
                    )}
                </section>

                {/* Songs beating their own album's average (Q8, v_songs_above_album_avg) */}
                <section className="glass rounded-xl p-6">
                    <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                        <Sparkles size={18} className="text-yellow-400" /> Standout Tracks
                    </h2>
                    <p className="text-xs text-spotify-subtle mb-4">Played more than the average song on their own album</p>
                    <div className="space-y-1">
                        {standout.map(s => (
                            <button key={s.song_id} onClick={() => playSong(s.song_id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left">
                                <img src={songCover(s)} alt="" className="w-9 h-9 rounded object-cover" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{s.title}</p>
                                    <p className="text-xs text-spotify-subtle">album average {s.album_avg} plays</p>
                                </div>
                                <span className="text-xs text-spotify-green font-semibold">{s.play_count} plays</span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* Top Songs List */}
            {topSongs.length > 0 && (
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-spotify-green" /> Top Streamed — Full List
                    </h2>
                    <div className="glass rounded-xl overflow-hidden">
                        {topSongs.map((song, i) => (
                            <SongRow key={song.song_id} song={song} index={i + 1} showAlbum />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
