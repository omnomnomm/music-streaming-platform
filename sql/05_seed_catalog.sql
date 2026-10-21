-- =============================================
-- Spotify DBS — Seed data, part 1: the music catalogue
-- Run AFTER 04_views_and_queries.sql. No auth/users needed for this part.
-- 8 artists (5 verified majors + 3 unverified independents), 18 albums
-- (15 LPs/EPs + 3 EPs), 140 songs, 200 performance credits.
-- =============================================

-- ── Artists (8) ──────────────────────────────
INSERT INTO artist (artist_name, genre, country, verified_status) VALUES
('Nova Ray', 'Pop', 'USA', TRUE),
('Eclipse', 'R&B', 'UK', TRUE),
('Vortex', 'Hip-Hop', 'Canada', TRUE),
('Luna Skye', 'Indie', 'Australia', TRUE),
('Atlas', 'Electronic', 'Germany', TRUE),
('Drift Theory', 'Lo-Fi', 'USA', FALSE),
('Neon Fable', 'Synthwave', 'France', FALSE),
('Rust & Bloom', 'Folk', 'Ireland', FALSE);

-- ── Albums (18) ──────────────────────────────
INSERT INTO album (title, release_date, album_type, artist_id) VALUES
('Stellar Dreams', '2024-03-15', 'album', 1),
('Neon Horizons', '2024-09-20', 'album', 1),
('Midnight Sun EP', '2025-01-10', 'ep', 1),
('Shadows & Light', '2024-01-22', 'album', 2),
('Velvet Nights', '2024-07-14', 'album', 2),
('Golden Hour EP', '2025-02-28', 'ep', 2),
('Concrete Jungle', '2023-11-05', 'album', 3),
('Street Symphonies', '2024-06-18', 'album', 3),
('Raw Cuts EP', '2025-03-01', 'ep', 3),
('Wildflower', '2024-02-14', 'album', 4),
('Coastal Reverie', '2024-08-30', 'album', 4),
('Amber Glow EP', '2025-01-20', 'ep', 4),
('Digital Frontier', '2024-04-10', 'album', 5),
('Pulse Wave', '2024-10-05', 'album', 5),
('Circuit EP', '2025-02-15', 'ep', 5),
('Quiet Signals', '2025-02-01', 'album', 6),
('Chrome Dreams', '2025-01-15', 'album', 7),
('Hollow Wood', '2025-02-20', 'album', 8);

-- ── Songs (140) ──────────────────────────────
INSERT INTO song (title, duration_seconds, album_id) VALUES
('Fading Dreams', 204, 1),('Broken Roads', 190, 1),('Golden Ruins', 268, 1),('Crystal Waves', 212, 1),('Silent Fire', 195, 1),
('Hollow Stars', 234, 1),('Electric Rain', 187, 1),('Neon Pulse', 221, 1),('Lost Horizon', 243, 1),('Velvet Echoes', 256, 1),
('Midnight Glow', 198, 2),('Rising Tides', 215, 2),('Phantom Heart', 232, 2),('Crimson Skies', 201, 2),('Infinite Storm', 189, 2),
('Shattered Dawn', 247, 2),('Cosmic Whisper', 176, 2),('Radiant Bloom', 210, 2),('Fleeting Orbit', 228, 2),('Wild Signal', 195, 2),
('Solar Flare', 183, 3),('Dusk Runner', 197, 3),('Frozen Light', 211, 3),('Aurora Chase', 224, 3),('Twilight Fade', 188, 3),
('Burning Echoes', 219, 4),('Distant Fire', 205, 4),('Silver Rain', 238, 4),('Hollow Lights', 192, 4),('Velvet Heart', 217, 4),
('Shadow Bloom', 244, 4),('Neon Ocean', 186, 4),('Crystal Storm', 229, 4),('Lost Dawn', 201, 4),('Frozen Ruins', 253, 4),
('Golden Horizon', 208, 5),('Fading Mirror', 195, 5),('Electric Pulse', 232, 5),('Silent Whisper', 181, 5),('Broken Orbit', 226, 5),
('Crimson Tide', 240, 5),('Phantom Skies', 199, 5),('Radiant Haze', 214, 5),('Infinite Bloom', 237, 5),('Wild Echoes', 191, 5),
('Amber Waves', 186, 6),('Copper Sun', 203, 6),('Bronze Horizon', 218, 6),('Gold Rush', 194, 6),('Gilded Dreams', 207, 6),
('Street Lights', 225, 7),('Midnight Run', 198, 7),('Concrete Heart', 241, 7),('Urban Echo', 186, 7),('Neon Alley', 213, 7),
('Block Party', 247, 7),('Grind Mode', 192, 7),('City Pulse', 228, 7),('Corner Store', 205, 7),('Skyline View', 260, 7),
('Bass Drop', 189, 8),('Flow State', 216, 8),('Cold Nights', 234, 8),('Real Talk', 197, 8),('Crown Royal', 221, 8),
('Paper Trail', 243, 8),('Heavy Rotation', 185, 8),('Night Shift', 230, 8),('Loud Silence', 208, 8),('Final Round', 252, 8),
('Raw Energy', 195, 9),('Uncut Gems', 210, 9),('Pure Grit', 183, 9),('Rough Diamond', 226, 9),('No Filter', 198, 9),
('Petal Rain', 212, 10),('Garden Path', 195, 10),('Sunlit Meadow', 238, 10),('Ivy Wall', 184, 10),('Daisy Chain', 221, 10),
('Moss & Stone', 246, 10),('Firefly Night', 189, 10),('Willow Creek', 227, 10),('Thorn & Rose', 203, 10),('Bloom Season', 258, 10),
('Ocean Breeze', 201, 11),('Salt & Sand', 218, 11),('Tidal Pool', 235, 11),('Driftwood', 190, 11),('Sea Glass', 224, 11),
('Lighthouse', 241, 11),('Harbor Fog', 187, 11),('Coral Reef', 232, 11),('Sunset Pier', 206, 11),('Wave Rider', 249, 11),
('Honey Light', 194, 12),('Warm Ember', 211, 12),('Candle Flame', 183, 12),('Fireside', 228, 12),('Lantern Walk', 197, 12),
('Binary Star', 220, 13),('Pixel Storm', 198, 13),('Data Stream', 243, 13),('Cyber Pulse', 187, 13),('Quantum Leap', 215, 13),
('Matrix Rain', 248, 13),('Glitch Wave', 192, 13),('Code Runner', 231, 13),('Byte Crush', 205, 13),('System Override', 262, 13),
('Synth Drive', 196, 14),('Waveform', 219, 14),('Frequency Shift', 237, 14),('Bass Circuit', 183, 14),('Echo Chamber', 225, 14),
('Voltage Drop', 244, 14),('Signal Lost', 191, 14),('Amplitude', 228, 14),('Phase Lock', 207, 14),('Resonance Peak', 255, 14),
('Spark Plug', 188, 15),('Wire Mesh', 214, 15),('Transistor', 196, 15),('Capacitor Hum', 223, 15),('Ground Zero', 201, 15),
('Slow Current', 198, 16),('Paper Clouds', 215, 16),('Low Tide', 182, 16),('Warm Static', 224, 16),('Drift Away', 207, 16),
('Pixel Sunset', 196, 17),('Retrograde', 233, 17),('Neon Rain', 188, 17),('Cyber Bloom', 219, 17),('Electric Dusk', 201, 17),
('Morning Frost', 210, 18),('River Stone', 192, 18),('Open Field', 238, 18),('Iron Bells', 185, 18),('Last Light', 226, 18);

-- ── Performs (200 credits — every song has >=1 Lead, matching BR3) ──
INSERT INTO performs (artist_id, song_id, role) VALUES
(1,1,'Lead'),(1,2,'Lead'),(1,3,'Lead'),(1,4,'Lead'),(1,5,'Lead'),(1,6,'Lead'),
(1,7,'Lead'),(2,7,'Featured'),(1,8,'Lead'),(3,8,'Featured'),(1,9,'Lead'),(4,9,'Featured'),
(1,10,'Lead'),(5,10,'Featured'),(2,10,'Featured'),(1,11,'Lead'),(1,12,'Lead'),(1,13,'Lead'),
(1,14,'Lead'),(1,15,'Lead'),(1,16,'Lead'),(1,17,'Lead'),(3,17,'Featured'),(1,18,'Lead'),
(4,18,'Featured'),(1,19,'Lead'),(5,19,'Featured'),(1,20,'Lead'),(2,20,'Featured'),(4,20,'Featured'),
(1,21,'Lead'),(1,22,'Lead'),(1,23,'Lead'),(1,24,'Lead'),(3,24,'Featured'),(1,25,'Lead'),
(5,25,'Featured'),(2,26,'Lead'),(2,27,'Lead'),(2,28,'Lead'),(2,29,'Lead'),(2,30,'Lead'),
(2,31,'Lead'),(2,32,'Lead'),(1,32,'Featured'),(2,33,'Lead'),(3,33,'Featured'),(2,34,'Lead'),
(4,34,'Featured'),(2,35,'Lead'),(5,35,'Featured'),(1,35,'Featured'),(2,36,'Lead'),(2,37,'Lead'),
(2,38,'Lead'),(2,39,'Lead'),(2,40,'Lead'),(2,41,'Lead'),(2,42,'Lead'),(3,42,'Featured'),
(2,43,'Lead'),(4,43,'Featured'),(2,44,'Lead'),(5,44,'Featured'),(2,45,'Lead'),(1,45,'Featured'),
(3,45,'Featured'),(2,46,'Lead'),(2,47,'Lead'),(2,48,'Lead'),(2,49,'Lead'),(1,49,'Featured'),
(2,50,'Lead'),(4,50,'Featured'),(3,51,'Lead'),(3,52,'Lead'),(3,53,'Lead'),(3,54,'Lead'),
(3,55,'Lead'),(3,56,'Lead'),(3,57,'Lead'),(1,57,'Featured'),(3,58,'Lead'),(2,58,'Featured'),
(3,59,'Lead'),(4,59,'Featured'),(3,60,'Lead'),(5,60,'Featured'),(1,60,'Featured'),(3,61,'Lead'),
(3,62,'Lead'),(3,63,'Lead'),(3,64,'Lead'),(3,65,'Lead'),(3,66,'Lead'),(3,67,'Lead'),
(2,67,'Featured'),(3,68,'Lead'),(4,68,'Featured'),(3,69,'Lead'),(5,69,'Featured'),(3,70,'Lead'),
(1,70,'Featured'),(2,70,'Featured'),(3,71,'Lead'),(3,72,'Lead'),(3,73,'Lead'),(3,74,'Lead'),
(4,74,'Featured'),(3,75,'Lead'),(5,75,'Featured'),(4,76,'Lead'),(4,77,'Lead'),(4,78,'Lead'),
(4,79,'Lead'),(4,80,'Lead'),(4,81,'Lead'),(4,82,'Lead'),(1,82,'Featured'),(4,83,'Lead'),
(2,83,'Featured'),(4,84,'Lead'),(3,84,'Featured'),(4,85,'Lead'),(5,85,'Featured'),(1,85,'Featured'),
(4,86,'Lead'),(4,87,'Lead'),(4,88,'Lead'),(4,89,'Lead'),(4,90,'Lead'),(4,91,'Lead'),
(4,92,'Lead'),(2,92,'Featured'),(4,93,'Lead'),(3,93,'Featured'),(4,94,'Lead'),(5,94,'Featured'),
(4,95,'Lead'),(1,95,'Featured'),(3,95,'Featured'),(4,96,'Lead'),(4,97,'Lead'),(4,98,'Lead'),
(4,99,'Lead'),(2,99,'Featured'),(4,100,'Lead'),(5,100,'Featured'),(5,101,'Lead'),(5,102,'Lead'),
(5,103,'Lead'),(5,104,'Lead'),(5,105,'Lead'),(5,106,'Lead'),(5,107,'Lead'),(1,107,'Featured'),
(5,108,'Lead'),(2,108,'Featured'),(5,109,'Lead'),(3,109,'Featured'),(5,110,'Lead'),(4,110,'Featured'),
(1,110,'Featured'),(5,111,'Lead'),(5,112,'Lead'),(5,113,'Lead'),(5,114,'Lead'),(5,115,'Lead'),
(5,116,'Lead'),(5,117,'Lead'),(2,117,'Featured'),(5,118,'Lead'),(3,118,'Featured'),(5,119,'Lead'),
(4,119,'Featured'),(5,120,'Lead'),(1,120,'Featured'),(3,120,'Featured'),(5,121,'Lead'),(5,122,'Lead'),
(5,123,'Lead'),(5,124,'Lead'),(1,124,'Featured'),(5,125,'Lead'),(4,125,'Featured'),(6, 126, 'Lead'),
(6, 127, 'Lead'),(6, 128, 'Lead'),(6, 129, 'Lead'),(6, 130, 'Lead'),(7, 131, 'Lead'),(7, 132, 'Lead'),
(7, 133, 'Lead'),(7, 134, 'Lead'),(7, 135, 'Lead'),(8, 136, 'Lead'),(8, 137, 'Lead'),(8, 138, 'Lead'),
(8, 139, 'Lead'),(8, 140, 'Lead');
