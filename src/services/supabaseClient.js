import { createClient } from '@supabase/supabase-js'

// Prefer .env (see .env.example) — falls back to the original hardcoded demo
// project so this keeps working if .env hasn't been set up yet.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kjfxctcornwtgalwemaq.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqZnhjdGNvcm53dGdhbHdlbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjQzNzgsImV4cCI6MjA4Nzk0MDM3OH0.QkD4QaIjod27AlY2CO7VYZ-0iymqdUmXTlAxaId8PUc'

// Workaround for a known supabase-js bug: when a session already exists,
// getSession()/onAuthStateChange can deadlock waiting on the browser's
// navigator.locks API (cross-tab session-refresh coordination this app, with
// one tab, doesn't need) — observed hanging the app forever on "Loading...".
// A no-op lock (just run the callback immediately) sidesteps it.
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { lock: async (_name, _acquireTimeout, fn) => fn() },
})
