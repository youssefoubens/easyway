import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store session in localStorage for persistence
    storage: window.localStorage,
    
    // Automatically refresh the token before it expires
    autoRefreshToken: true,
    
    // Persist the session across browser tabs
    persistSession: true,
    
    // Detect session from URL (for OAuth callbacks)
    detectSessionInUrl: true,
    
    // Token will be refreshed this many seconds before expiry
    // Default is 600 seconds (10 minutes)
    storageKey: 'supabase.auth.token',
  }
});