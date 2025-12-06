import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
export const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY; // MODIFIED: Export anonKey

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase Client Init: URL:', supabaseUrl ? 'Loaded' : 'MISSING');
console.log('Supabase Client Init: Anon Key (first 5 chars):', supabaseAnonKey ? supabaseAnonKey.substring(0, 5) + '...' : 'MISSING');
