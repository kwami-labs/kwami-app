/**
 * The charter: the standing rules that make a kwami behave like a chief of
 * staff rather than a polite search box -- how it addresses the user, when it
 * pushes back, how much initiative it takes, and the profile it keeps on them.
 *
 * Sent to the agent inside `soul.charter`; the agent's `domain/charter.py` is
 * the only reader of what each option means. The field names and option
 * values here must match that module's parser, which ignores anything it does
 * not recognise rather than guessing.
 */

export type CharterWit = 'none' | 'subtle' | 'marked';
export type CharterPushback = 'off' | 'once' | 'firm';
export type CharterOpinions = 'always' | 'on_request' | 'never';
export type CharterInitiative = 'act' | 'propose' | 'wait';
export type CharterLearn = 'announce' | 'silent' | 'off';
export type CharterGreeting = 'brief_pending' | 'brief' | 'briefing' | 'none';
export type CharterWatchTopic = 'money' | 'privacy' | 'impulse' | 'health' | 'commitments';

export interface CharterConfig {
  enabled: boolean;
  addressAs: string;
  formal: boolean;
  wit: CharterWit;
  pushback: CharterPushback;
  opinions: CharterOpinions;
  initiative: CharterInitiative;
  watch: CharterWatchTopic[];
  learn: CharterLearn;
  greeting: CharterGreeting;
  adaptiveLength: boolean;
  userProfile: string;
}

export const CHARTER_WATCH_TOPICS: readonly CharterWatchTopic[] = [
  'money',
  'privacy',
  'impulse',
  'health',
  'commitments',
];

/** Mirrors the agent's prompt cap, so the panel and the tool agree on "full". */
export const CHARTER_PROFILE_MAX_CHARS = 1800;

/** Off, with neutral options: a kwami that never opts in is unchanged. */
export function defaultCharter(): CharterConfig {
  return {
    enabled: false,
    addressAs: '',
    formal: false,
    wit: 'subtle',
    pushback: 'once',
    opinions: 'always',
    initiative: 'act',
    watch: [],
    learn: 'announce',
    greeting: 'brief_pending',
    adaptiveLength: true,
    userProfile: '',
  };
}

/**
 * The charter the user specified for their assistant on 2026-10-08: addressed
 * as "señor" with usted, marked dry wit, objects once and then complies, opinions
 * when they help, researches on its own initiative, watches money, privacy and
 * impulsive decisions, learns about the user out loud, and greets briefly with
 * anything pending.
 */
export function chiefOfStaffCharter(): CharterConfig {
  return {
    ...defaultCharter(),
    enabled: true,
    addressAs: 'señor',
    formal: true,
    wit: 'marked',
    pushback: 'once',
    opinions: 'always',
    initiative: 'act',
    watch: ['money', 'privacy', 'impulse'],
    learn: 'announce',
    greeting: 'brief_pending',
    adaptiveLength: true,
  };
}

/** A stored charter merged over the defaults, so older saves gain new fields. */
export function normalizeCharter(value: unknown): CharterConfig {
  const base = defaultCharter();
  if (!value || typeof value !== 'object') return base;
  const merged = { ...base, ...(value as Partial<CharterConfig>) };
  merged.watch = Array.isArray(merged.watch)
    ? merged.watch.filter((topic): topic is CharterWatchTopic =>
        CHARTER_WATCH_TOPICS.includes(topic as CharterWatchTopic),
      )
    : [];
  merged.userProfile = typeof merged.userProfile === 'string' ? merged.userProfile : '';
  merged.addressAs = typeof merged.addressAs === 'string' ? merged.addressAs : '';
  return merged;
}

/**
 * The charter a soul preset leaves in place when it is applied.
 *
 * A preset that ships rules (Jarvis) brings them; one without leaves the
 * current charter untouched. The user profile is never the preset's: it is
 * what the agent learnt about this user, so it survives either way.
 */
export function charterForPreset(presetCharter: unknown, current: CharterConfig): CharterConfig {
  if (!presetCharter || typeof presetCharter !== 'object') return current;
  return normalizeCharter({ ...presetCharter, userProfile: current.userProfile });
}

function normalizeNote(note: unknown): string {
  if (typeof note !== 'string') return '';
  // One line per note: the profile is a list, and a note with a newline in it
  // would read as two.
  return note
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-*•]\s*/, '');
}

function comparable(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type AppendResult =
  | { status: 'added'; profile: string; note: string }
  | { status: 'duplicate' }
  | { status: 'empty' }
  | { status: 'full' };

/**
 * Add one note to the profile as a bullet line.
 *
 * A note already present (ignoring case, accents and punctuation) is not added
 * twice: the agent re-learns the same preference often, and a profile that
 * repeats itself spends the prompt budget on nothing. A note that would push
 * the profile over its cap is refused rather than silently truncated, so the
 * agent can tell the user it needs tidying.
 */
export function appendProfileNote(profile: string, note: unknown): AppendResult {
  const clean = normalizeNote(note);
  if (!clean) return { status: 'empty' };
  const lines = profile
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const key = comparable(clean);
  if (lines.some((line) => comparable(line.replace(/^[-*•]\s*/, '')) === key)) {
    return { status: 'duplicate' };
  }
  const next = [...lines, `- ${clean}`].join('\n');
  if (next.length > CHARTER_PROFILE_MAX_CHARS) return { status: 'full' };
  return { status: 'added', profile: next, note: clean };
}

/** Remove every profile line containing `text` (case- and accent-insensitive). */
export function removeProfileNotes(
  profile: string,
  text: unknown,
): { profile: string; removed: number } {
  const needle = typeof text === 'string' ? comparable(text) : '';
  const lines = profile.split('\n');
  if (!needle) return { profile, removed: 0 };
  const kept = lines.filter((line) => !comparable(line).includes(needle));
  return { profile: kept.join('\n').trim(), removed: lines.length - kept.length };
}
