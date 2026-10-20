import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { isTauri } from '@/lib/platform';

// env.ts already reports missing credentials at startup; creating the client
// with empty strings here keeps imports side-effect free and lets AuthGuard
// render the configuration error rather than crashing at module load.
//
// The desktop shell signs in through the system browser and a `kwami://` deep link. The
// implicit flow would put the tokens in that link's fragment; PKCE sends a one-time code
// instead, which only this webview (holding the verifier) can redeem. See desktopAuth.ts.
export const supabase = createClient(
  env.supabaseUrl,
  env.supabasePublishableKey,
  isTauri() ? { auth: { flowType: 'pkce' } } : undefined,
);
