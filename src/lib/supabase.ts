import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// env.ts already reports missing credentials at startup; creating the client
// with empty strings here keeps imports side-effect free and lets AuthGuard
// render the configuration error rather than crashing at module load.
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey);
