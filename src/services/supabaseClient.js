import { createClient } from '@supabase/supabase-js'

// Credentials come from .env (see .env.example), which is never committed.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.')
}

// Workaround for a known supabase-js bug: when a session already exists,
// getSession()/onAuthStateChange can deadlock waiting on the browser's
// navigator.locks API (cross-tab session-refresh coordination this app, with
// one tab, doesn't need) — observed hanging the app forever on "Loading...".
// A no-op lock (just run the callback immediately) sidesteps it.
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { lock: async (_name, _acquireTimeout, fn) => fn() },
})
