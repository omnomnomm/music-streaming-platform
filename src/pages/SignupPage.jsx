import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Music2 } from 'lucide-react';

// Thirteen years ago today, as a max date_of_birth value — matches trigger T4
// (BR7) server-side, checked here too so the error shows up before a round trip.
function maxDob() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().split('T')[0];
}

export default function SignupPage() {
    const [form, setForm] = useState({ name: '', email: '', password: '', dateOfBirth: '', country: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await signUp(form);
        setLoading(false);
        if (result.success) navigate('/');
        else setError(result.error);
    };

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    return (
        <div className="min-h-screen bg-gradient-to-b from-spotify-card to-spotify-black flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fade-in">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-spotify-green flex items-center justify-center mb-4 animate-pulse-glow">
                        <Music2 size={32} className="text-black" />
                    </div>
                    <h1 className="text-3xl font-bold">Spotify <span className="text-spotify-green">DBS</span></h1>
                    <p className="text-spotify-subtle mt-2 text-sm">Create a listener account</p>
                </div>

                <div className="glass rounded-2xl p-8">
                    <h2 className="text-xl font-semibold mb-6 text-center">Sign up</h2>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-spotify-subtle mb-1.5">Name</label>
                            <input type="text" value={form.name} onChange={set('name')} minLength={2}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                        </div>
                        <div>
                            <label className="block text-sm text-spotify-subtle mb-1.5">Email address</label>
                            <input type="email" value={form.email} onChange={set('email')}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                        </div>
                        <div>
                            <label className="block text-sm text-spotify-subtle mb-1.5">Password</label>
                            <input type="password" value={form.password} onChange={set('password')} minLength={6}
                                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-spotify-subtle mb-1.5">Date of birth</label>
                                <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={maxDob()}
                                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                                <p className="text-[11px] text-spotify-subtle mt-1">Must be 13 or older</p>
                            </div>
                            <div>
                                <label className="block text-sm text-spotify-subtle mb-1.5">Country</label>
                                <input type="text" value={form.country} onChange={set('country')}
                                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-spotify-green transition" required />
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-3 rounded-full bg-spotify-green text-black font-semibold text-sm hover:bg-spotify-green-dark transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                            {loading ? 'Creating account...' : 'Sign Up'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-spotify-subtle mt-4">
                        Artist or admin account? Ask an admin to upgrade your profile from the Admin Panel.
                    </p>
                </div>

                <p className="text-center text-xs text-spotify-subtle mt-6">
                    Already have an account? <Link to="/login" className="text-spotify-green hover:underline">Log in</Link>
                </p>
            </div>
        </div>
    );
}
