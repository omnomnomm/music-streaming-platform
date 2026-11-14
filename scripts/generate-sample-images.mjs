// Generates the sample artwork in public/images/ (artist portraits, artist
// banners, album covers). Everything is plain SVG, so it works offline and
// needs no external image host. Re-run with:  node scripts/generate-sample-images.mjs
//
// The artists and albums mirror sql/05_seed_catalog.sql; album files are named
// by album_id (insert order in the seed).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');

const artists = [
    { name: 'Nova Ray', colors: ['#ff4ecd', '#7b2ff7', '#1a0b3d'] },
    { name: 'Eclipse', colors: ['#f7b733', '#c0392b', '#1b0a0a'] },
    { name: 'Vortex', colors: ['#00e5ff', '#2b5876', '#0a0f1f'] },
    { name: 'Luna Skye', colors: ['#a8e6cf', '#3d84a8', '#0e1c26'] },
    { name: 'Atlas', colors: ['#39ff14', '#0f9b8e', '#04140f'] },
    { name: 'Drift Theory', colors: ['#f6d6ad', '#b5838d', '#2a1f2d'] },
    { name: 'Neon Fable', colors: ['#ff6ec7', '#3a0ca3', '#0b0221'] },
    { name: 'Rust & Bloom', colors: ['#e9c46a', '#8a5a44', '#1f1510'] },
];

const albums = [
    ['Stellar Dreams', 0, 'stars'], ['Neon Horizons', 0, 'horizon'], ['Midnight Sun EP', 0, 'sun'],
    ['Shadows & Light', 1, 'eclipse'], ['Velvet Nights', 1, 'waves'], ['Golden Hour EP', 1, 'sun'],
    ['Concrete Jungle', 2, 'city'], ['Street Symphonies', 2, 'bars'], ['Raw Cuts EP', 2, 'stripes'],
    ['Wildflower', 3, 'petals'], ['Coastal Reverie', 3, 'waves'], ['Amber Glow EP', 3, 'rings'],
    ['Digital Frontier', 4, 'grid'], ['Pulse Wave', 4, 'pulse'], ['Circuit EP', 4, 'circuit'],
    ['Quiet Signals', 5, 'rings'], ['Chrome Dreams', 6, 'horizon'], ['Hollow Wood', 7, 'trees'],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Small deterministic PRNG so the artwork is stable between runs.
function rng(seed) {
    let t = seed;
    return () => {
        t = (t + 0x6d2b79f5) | 0;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function motif(kind, [a, b], rand) {
    const out = [];
    switch (kind) {
        case 'stars':
            for (let i = 0; i < 70; i++) {
                out.push(`<circle cx="${rand() * 600}" cy="${rand() * 600}" r="${rand() * 2.6 + 0.4}" fill="#fff" opacity="${rand() * 0.8 + 0.2}"/>`);
            }
            out.push(`<circle cx="400" cy="210" r="90" fill="${a}" opacity="0.9"/><circle cx="430" cy="190" r="80" fill="url(#bg)"/>`);
            break;
        case 'horizon':
            out.push(`<circle cx="300" cy="330" r="150" fill="url(#sun)"/>`);
            for (let i = 0; i < 6; i++) out.push(`<rect x="140" y="${345 + i * 22}" width="320" height="${4 + i * 2}" fill="url(#bg)"/>`);
            for (let i = 0; i < 12; i++) out.push(`<line x1="${i * 60 - 30}" y1="600" x2="300" y2="420" stroke="${a}" stroke-opacity="0.45" stroke-width="2"/>`);
            for (let i = 0; i < 6; i++) out.push(`<line x1="0" y1="${430 + i * i * 6}" x2="600" y2="${430 + i * i * 6}" stroke="${a}" stroke-opacity="0.45" stroke-width="2"/>`);
            break;
        case 'sun':
            out.push(`<circle cx="300" cy="260" r="130" fill="url(#sun)"/>`);
            for (let i = 0; i < 24; i++) {
                const ang = (i / 24) * Math.PI * 2;
                out.push(`<line x1="${300 + Math.cos(ang) * 150}" y1="${260 + Math.sin(ang) * 150}" x2="${300 + Math.cos(ang) * 210}" y2="${260 + Math.sin(ang) * 210}" stroke="${a}" stroke-width="5" stroke-linecap="round" opacity="0.7"/>`);
            }
            break;
        case 'eclipse':
            out.push(`<circle cx="300" cy="270" r="170" fill="${a}" opacity="0.25"/><circle cx="300" cy="270" r="140" fill="url(#sun)"/><circle cx="330" cy="250" r="135" fill="#000" opacity="0.88"/>`);
            break;
        case 'waves':
            for (let i = 0; i < 9; i++) {
                const y = 170 + i * 38;
                out.push(`<path d="M0 ${y} C 150 ${y - 50}, 300 ${y + 50}, 450 ${y} S 600 ${y - 30}, 650 ${y}" fill="none" stroke="${i % 2 ? a : b}" stroke-width="6" opacity="${0.35 + i * 0.07}"/>`);
            }
            break;
        case 'city':
            for (let x = 0; x < 600;) {
                const w = 40 + rand() * 60, h = 120 + rand() * 260;
                out.push(`<rect x="${x}" y="${600 - h}" width="${w - 6}" height="${h}" fill="#000" opacity="0.55"/>`);
                for (let wy = 600 - h + 14; wy < 580; wy += 22) {
                    for (let wx = x + 8; wx < x + w - 14; wx += 14) {
                        if (rand() > 0.55) out.push(`<rect x="${wx}" y="${wy}" width="6" height="9" fill="${a}" opacity="0.85"/>`);
                    }
                }
                x += w;
            }
            break;
        case 'bars':
            for (let i = 0; i < 24; i++) {
                const h = 40 + rand() * 300;
                out.push(`<rect x="${30 + i * 23}" y="${430 - h}" width="15" height="${h}" rx="7" fill="${i % 3 ? a : b}" opacity="0.85"/>`);
            }
            break;
        case 'stripes':
            for (let i = -6; i < 14; i++) out.push(`<rect x="${i * 60}" y="-100" width="26" height="900" fill="${i % 2 ? a : b}" opacity="0.55" transform="rotate(30 300 300)"/>`);
            break;
        case 'petals':
            for (let i = 0; i < 12; i++) out.push(`<ellipse cx="300" cy="180" rx="44" ry="110" fill="${i % 2 ? a : b}" opacity="0.75" transform="rotate(${i * 30} 300 280)"/>`);
            out.push(`<circle cx="300" cy="280" r="40" fill="#fff3b0"/>`);
            break;
        case 'rings':
            for (let i = 12; i > 0; i--) out.push(`<circle cx="300" cy="270" r="${i * 22}" fill="none" stroke="${i % 2 ? a : b}" stroke-width="7" opacity="${0.2 + (12 - i) * 0.06}"/>`);
            break;
        case 'grid':
            for (let i = 0; i <= 600; i += 40) {
                out.push(`<line x1="${i}" y1="0" x2="${i}" y2="600" stroke="${a}" stroke-opacity="0.25"/><line x1="0" y1="${i}" x2="600" y2="${i}" stroke="${a}" stroke-opacity="0.25"/>`);
            }
            for (let i = 0; i < 26; i++) out.push(`<rect x="${Math.floor(rand() * 15) * 40}" y="${Math.floor(rand() * 15) * 40}" width="40" height="40" fill="${rand() > 0.5 ? a : b}" opacity="${rand() * 0.6 + 0.2}"/>`);
            break;
        case 'pulse': {
            let d = 'M0 300';
            for (let x = 0; x <= 600; x += 20) d += ` L${x} ${300 + (x > 200 && x < 420 ? (rand() - 0.5) * 320 : (rand() - 0.5) * 30)}`;
            out.push(`<path d="${d}" fill="none" stroke="${a}" stroke-width="6" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${a}" stroke-width="20" opacity="0.2"/>`);
            break;
        }
        case 'circuit':
            for (let i = 0; i < 22; i++) {
                const x = 40 + rand() * 520, y = 40 + rand() * 520, x2 = x + (rand() - 0.5) * 240;
                out.push(`<path d="M${x} ${y} H${x2} V${y + (rand() - 0.5) * 200}" fill="none" stroke="${a}" stroke-width="4" opacity="0.7"/><circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${b}" stroke-width="4"/>`);
            }
            break;
        case 'trees':
            for (let i = 0; i < 14; i++) {
                const x = rand() * 600, h = 180 + rand() * 260, w = 50 + rand() * 50;
                out.push(`<polygon points="${x},${600 - h} ${x - w},600 ${x + w},600" fill="#000" opacity="${0.35 + rand() * 0.4}"/>`);
            }
            out.push(`<circle cx="450" cy="150" r="55" fill="${a}" opacity="0.9"/>`);
            break;
    }
    return out.join('');
}

function defs([a, b, c]) {
    return `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#fff6d5"/><stop offset="0.5" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></linearGradient>
</defs>`;
}

function albumSvg(title, artist, kind, seed) {
    const rand = rng(seed * 7919);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${defs(artist.colors)}
<rect width="600" height="600" fill="url(#bg)"/>${motif(kind, artist.colors, rand)}
<rect width="600" height="600" fill="url(#shade)"/>
<text x="36" y="530" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="800" fill="#fff">${esc(title)}</text>
<text x="36" y="568" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="500" fill="#fff" opacity="0.75" letter-spacing="3">${esc(artist.name.toUpperCase())}</text>
</svg>`;
}

function artistSvg(artist, seed) {
    const rand = rng(seed * 104729);
    const [a] = artist.colors;
    const dots = Array.from({ length: 40 }, () => `<circle cx="${rand() * 600}" cy="${rand() * 600}" r="${rand() * 30 + 4}" fill="${a}" opacity="${rand() * 0.25}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${defs(artist.colors)}
<rect width="600" height="600" fill="url(#bg)"/>${dots}
<circle cx="300" cy="300" r="250" fill="none" stroke="${a}" stroke-width="3" opacity="0.4"/>
<g fill="#000" opacity="0.72"><circle cx="300" cy="240" r="96"/><path d="M110 600 C 120 420, 210 360, 300 360 S 480 420, 490 600 Z"/></g>
<circle cx="300" cy="240" r="96" fill="none" stroke="${a}" stroke-width="4" opacity="0.8"/>
</svg>`;
}

function bannerSvg(artist, seed) {
    const rand = rng(seed * 15485863);
    const [a, b] = artist.colors;
    const blobs = Array.from({ length: 18 }, () => `<circle cx="${rand() * 1200}" cy="${rand() * 400}" r="${rand() * 120 + 30}" fill="${rand() > 0.5 ? a : b}" opacity="${rand() * 0.35 + 0.1}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400" preserveAspectRatio="xMidYMid slice">${defs(artist.colors)}
<rect width="1200" height="400" fill="url(#bg)"/>${blobs}
<g fill="#000" opacity="0.55"><circle cx="930" cy="170" r="90"/><path d="M760 400 C 770 290, 850 260, 930 260 S 1090 290, 1100 400 Z"/></g>
</svg>`;
}

function write(rel, content) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
}

artists.forEach((artist, i) => {
    write(`artists/${slug(artist.name)}.svg`, artistSvg(artist, i + 1));
    write(`artists/${slug(artist.name)}-banner.svg`, bannerSvg(artist, i + 1));
});
albums.forEach(([title, artistIdx, kind], i) => {
    write(`albums/album-${i + 1}.svg`, albumSvg(title, artists[artistIdx], kind, i + 1));
});

// Fallbacks for artists/albums created later through the app.
const fallback = { name: '', colors: ['#1db954', '#1e3264', '#121212'] };
write('artists/default.svg', artistSvg(fallback, 99));
write('artists/default-banner.svg', bannerSvg(fallback, 99));
['rings', 'waves', 'grid', 'sun', 'stripes', 'bars'].forEach((kind, i) => {
    write(`albums/default-${i + 1}.svg`, albumSvg('', fallback, kind, 100 + i).replace(/<text[^>]*><\/text>/g, ''));
});

console.log('Sample images written to', root);
