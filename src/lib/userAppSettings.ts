import { supabase } from '@/lib/supabase';
import { getCurrentLocale, normalizeLocale, setLocale, type SupportedLocale } from '@/i18n';

/**
 * Load saved locale for the signed-in user and apply it. If no row exists yet,
 * seed the table with the current UI locale (localStorage / browser).
 */
export async function loadUserLocaleFromDb(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('user_app_settings')
    .select('locale')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Failed to load user app settings:', error.message);
    return;
  }

  if (data?.locale) {
    setLocale(normalizeLocale(data.locale));
    return;
  }

  const current = getCurrentLocale();
  const { error: seedError } = await supabase
    .from('user_app_settings')
    .upsert({ user_id: userId, locale: current }, { onConflict: 'user_id' });
  if (seedError) {
    console.warn('Failed to seed user app settings:', seedError.message);
  }
}

export async function saveUserLocaleToDb(userId: string, locale: SupportedLocale): Promise<void> {
  const { error } = await supabase
    .from('user_app_settings')
    .upsert({ user_id: userId, locale }, { onConflict: 'user_id' });
  if (error) {
    console.warn('Failed to save locale:', error.message);
  }
}
