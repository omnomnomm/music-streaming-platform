import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getSongById, getSongArtists, getSongs, recordListen } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PlayerContext = createContext(null);

// Royalty-free sample audio URLs
const SAMPLE_AUDIO = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
];

// The sample MP3s don't match each song's real length, so the timeline always
// uses the song's duration_seconds from the database as the track length and
// moves to the next song when either that length or the sample file runs out.
// Elapsed time is read straight from audio.currentTime, so the bar and the
// clock move at real speed.

export function PlayerProvider({ children }) {
    const { user } = useAuth();
    const [currentSong, setCurrentSong] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // seconds
    const [volume, setVolume] = useState(0.7);
    const [queue, setQueue] = useState([]);
    const [history, setHistory] = useState([]); // tracks played songs for "previous"
    const audioRef = useRef(new Audio());

    // Simulated playback, used only when the audio file genuinely cannot play.
    const simulateRef = useRef(null);
    const simulatingRef = useRef(false);

    // Refs read from audio event callbacks, which are registered once.
    const queueRef = useRef(queue);
    const currentSongRef = useRef(currentSong);
    const currentTimeRef = useRef(0);
    const userRef = useRef(user);
    const volumeRef = useRef(volume);
    const playTokenRef = useRef(0); // bumps on every new play request; stale loads are dropped
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
    useEffect(() => { userRef.current = user; }, [user]);

    const updateTime = (t) => {
        currentTimeRef.current = t;
        setCurrentTime(t);
    };

    const stopSimulation = () => {
        if (simulateRef.current) clearInterval(simulateRef.current);
        simulateRef.current = null;
    };

    // Resumes from the current position instead of restarting at 0.
    const startSimulation = () => {
        stopSimulation();
        simulatingRef.current = true;
        simulateRef.current = setInterval(() => {
            const song = currentSongRef.current;
            if (!song) return stopSimulation();
            const t = currentTimeRef.current + 1;
            if (t >= song.duration_seconds) {
                updateTime(song.duration_seconds);
                finishTrack();
            } else {
                updateTime(t);
            }
        }, 1000);
    };

    // Starts the audio element; falls back to simulation only on real failures.
    const startAudio = (token) => {
        const audio = audioRef.current;
        audio.play().then(() => {
            if (token === playTokenRef.current) setIsPlaying(true);
        }).catch((err) => {
            // AbortError = this play() was superseded by a newer load/pause.
            if (err?.name === 'AbortError' || token !== playTokenRef.current) return;
            if (err?.name === 'NotAllowedError') {
                // Autoplay blocked: wait for the user to press play.
                setIsPlaying(false);
                return;
            }
            setIsPlaying(true);
            startSimulation();
        });
    };

    const playById = async (songId) => {
        const token = ++playTokenRef.current;
        stopSimulation();
        simulatingRef.current = false;

        const song = await getSongById(songId);
        if (!song || token !== playTokenRef.current) return;
        const artists = await getSongArtists(songId);
        if (token !== playTokenRef.current) return;

        const fullSong = { ...song, artists };
        setCurrentSong(fullSong);
        currentSongRef.current = fullSong;
        updateTime(0);

        if (userRef.current) {
            recordListen(userRef.current.user_id, songId, 'Web');
        }

        const audio = audioRef.current;
        audio.src = SAMPLE_AUDIO[(songId - 1) % SAMPLE_AUDIO.length];
        audio.volume = volumeRef.current;
        startAudio(token);
    };

    const advanceQueue = () => {
        const q = queueRef.current;
        if (q.length > 0) {
            const nextId = q[0];
            setQueue(q.slice(1));
            queueRef.current = q.slice(1);
            // Save current to history
            if (currentSongRef.current) {
                setHistory(h => [...h, currentSongRef.current.song_id]);
            }
            playById(nextId);
        }
    };

    const finishTrack = () => {
        stopSimulation();
        audioRef.current.pause();
        setIsPlaying(false);
        advanceQueue();
    };

    // Audio event listeners — registered once
    useEffect(() => {
        const audio = audioRef.current;

        const onTimeUpdate = () => {
            if (simulatingRef.current) return;
            const song = currentSongRef.current;
            const t = audio.currentTime;
            if (song && t >= song.duration_seconds) {
                updateTime(song.duration_seconds);
                finishTrack();
                return;
            }
            updateTime(t);
        };

        const onEnded = () => {
            if (simulatingRef.current) return;
            finishTrack();
        };

        const onError = () => {
            if (!audio.src || !currentSongRef.current || simulatingRef.current) return;
            console.warn('Audio load error, falling back to simulation');
            setIsPlaying(true);
            startSimulation();
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.pause();
            stopSimulation();
        };
    }, []); // empty deps — register once

    // Public: play a single song, auto-build queue from all songs
    const playSong = useCallback(async (songId) => {
        // Save current to history
        if (currentSongRef.current) {
            setHistory(h => [...h, currentSongRef.current.song_id]);
        }
        // Build a queue from all songs starting after this one
        try {
            const allSongs = await getSongs();
            const idx = allSongs.findIndex(s => s.song_id === songId);
            if (idx >= 0) {
                const rest = allSongs.slice(idx + 1).map(s => s.song_id);
                setQueue(rest);
                queueRef.current = rest;
            }
        } catch {
            // If song list fails, just play the single song
        }
        playById(songId);
    }, []);

    // Public: play a list of songs (album, playlist, etc.)
    const playAlbum = useCallback((songIds) => {
        if (songIds.length === 0) return;
        if (currentSongRef.current) {
            setHistory(h => [...h, currentSongRef.current.song_id]);
        }
        const rest = songIds.slice(1);
        setQueue(rest);
        queueRef.current = rest;
        playById(songIds[0]);
    }, []);

    // Public: skip to next
    const skipNext = useCallback(() => {
        advanceQueue();
    }, []);

    // Public: skip to previous
    const skipBack = useCallback(() => {
        // If more than 3 seconds in, restart current song
        if (currentTimeRef.current > 3) {
            if (!simulatingRef.current) audioRef.current.currentTime = 0;
            updateTime(0);
            return;
        }
        // Otherwise go to previous song
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const prevId = prev[prev.length - 1];
            // Push current song back to front of queue
            if (currentSongRef.current) {
                setQueue(q => {
                    const newQ = [currentSongRef.current.song_id, ...q];
                    queueRef.current = newQ;
                    return newQ;
                });
            }
            playById(prevId);
            return prev.slice(0, -1);
        });
    }, []);

    const togglePlay = useCallback(() => {
        if (!currentSongRef.current) return;
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
            stopSimulation();
            setIsPlaying(false);
        } else if (simulatingRef.current) {
            setIsPlaying(true);
            startSimulation();
        } else {
            setIsPlaying(true);
            startAudio(playTokenRef.current);
        }
    }, [isPlaying]);

    const seek = useCallback((pct) => {
        const song = currentSongRef.current;
        if (!song) return;
        const audio = audioRef.current;
        let t = (pct / 100) * song.duration_seconds;
        if (!simulatingRef.current && audio.duration) {
            t = Math.min(t, audio.duration);
            audio.currentTime = t;
        }
        updateTime(t);
    }, []);

    const changeVolume = useCallback((v) => {
        setVolume(v);
        volumeRef.current = v;
        audioRef.current.volume = v;
    }, []);

    const duration = currentSong?.duration_seconds || 0;
    const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

    return (
        <PlayerContext.Provider value={{
            currentSong, isPlaying, progress, currentTime, duration, volume, queue,
            playSong, togglePlay, playAlbum, seek, changeVolume, skipNext, skipBack,
        }}>
            {children}
        </PlayerContext.Provider>
    );
}

export const usePlayer = () => useContext(PlayerContext);
