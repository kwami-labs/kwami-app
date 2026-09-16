/**
 * Validated environment access.
 *
 * Every consumer used to fall back silently — `|| 'http://localhost:8080'` at
 * eleven call sites, `|| ''` for the LiveKit URL, and lib/supabase.ts built a
 * client with empty-string credentials after a console.warn. The result was
 * that a production build with a missing .env deployed successfully and then
 * failed at runtime with opaque network errors against localhost.
 *
 * Reads are resolved once at module load so a missing variable surfaces at
 * startup rather than on the first request that happens to need it.
 */

interface EnvShape {
  apiUrl: string;
  livekitUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

/** Vars without a sensible default. A build missing these cannot work. */
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

function read(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? '';
}

const missing = REQUIRED.filter((name) => !read(name));

/**
 * True when a required variable is absent. Callers render a configuration
 * error instead of a half-working app.
 */
export const isEnvValid = missing.length === 0;
export const missingEnvVars: readonly string[] = missing;

if (!isEnvValid) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.sample to .env and fill them in.',
  );
}

export const env: EnvShape = {
  // Localhost is a deliberate default: it is the documented dev backend, and
  // an unset API URL in dev is normal rather than an error.
  apiUrl: read('VITE_API_URL') || 'http://localhost:8080',
  livekitUrl: read('VITE_LIVEKIT_URL'),
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabasePublishableKey: read('VITE_SUPABASE_PUBLISHABLE_KEY'),
};
