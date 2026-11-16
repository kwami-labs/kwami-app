/**
 * The brain: the models that do the work the voice model hands over.
 *
 * The voice (a realtime model) only listens and speaks; anything that takes
 * work crosses a bridge to one of these. Each model has one role, and the
 * agent's router (`brain/router.py`) picks by role from the difficulty the
 * voice gives it. Field names and option values must match the agent's
 * parser (`brain/config.py`), which drops anything it does not recognise.
 *
 * Sent as a `config_update` of type `brain`; persisted with the voice store.
 */

export type BrainProvider =
  | 'anthropic'
  | 'google'
  | 'openai'
  | 'xai'
  | 'openrouter'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'local';
export type BrainRole = 'fast' | 'standard' | 'expert' | 'search' | 'x_search' | 'code';
/**
 * How a Claude model is reached. auto: the Claude account on the user's PC, and
 * the API key only when that cannot. account: never the key. api: never the account.
 */
export type BrainAccess = 'auto' | 'account' | 'api';
/** everything: the voice passes all the thinking on. work_only: it also answers what it knows. */
export type BrainRelay = 'everything' | 'work_only';
export type BrainCouncil = 'important' | 'on_request' | 'research';
export type BrainSearch = 'native' | 'tavily' | 'both';
export type BrainBudgetPolicy = 'inform' | 'downgrade' | 'stop';
export type BrainDelivery = 'next_pause' | 'interrupt' | 'on_request';
export type BrainOnHangup = 'finish' | 'cancel';
export type ExecutorPermissions = 'full_no_push' | 'edit_only' | 'read_only';

export interface BrainModel {
  id: string;
  label: string;
  provider: BrainProvider;
  model: string;
  /** The first of `roles`, kept for saves and agents from before a model held several. */
  role: BrainRole;
  roles: BrainRole[];
  access: BrainAccess;
  /** The user's brief for this model, added to whatever it is asked. */
  instructions: string;
  enabled: boolean;
  council: boolean;
}

export interface BrainConfig {
  enabled: boolean;
  routing: 'auto' | 'manual';
  defaultModel: string;
  council: BrainCouncil;
  search: BrainSearch;
  monthlyBudgetUsd: number;
  budgetPolicy: BrainBudgetPolicy;
  delivery: BrainDelivery;
  onHangup: BrainOnHangup;
  /** Split normal and hard tasks so each part runs on the cheapest model that can do it. */
  splitTasks: boolean;
  /** The model that plans and hands out the work. Empty: the router's choice. */
  director: string;
  relay: BrainRelay;
  /** The user's brief for the whole brain, added to every worker. */
  instructions: string;
  models: BrainModel[];
  executor: {
    folder: string;
    permissions: ExecutorPermissions;
    maxTurns: number;
    maxTaskUsd: number;
  };
}

/** What the agent reports about itself (`brain_status`). Never persisted to the kwami. */
export interface BrainTaskStatus {
  id: string;
  title: string;
  kind: string;
  difficulty: string;
  status: 'running' | 'done' | 'failed' | 'cancelled';
  council: boolean;
  models: string[];
  costUsd: number;
  /** Answered on the Claude account of the user's PC, not on an API key. */
  viaAccount?: boolean;
  startedAt: string;
  finishedAt: string;
  result?: string;
  steps?: { goal: string; difficulty: string; model: string; ok: boolean }[];
  /** Models whose prompt carried the user's instructions and answered. Absent from older agents. */
  briefed?: string[];
}

/** A stage of the voice pipeline, as the agent reports its providers. */
export type VoiceStage = 'stt' | 'tts' | 'llm' | 'realtime';
export const VOICE_STAGES: readonly VoiceStage[] = ['stt', 'tts', 'llm', 'realtime'];

export interface BrainStatus {
  enabled: boolean;
  providers: Partial<Record<BrainProvider, boolean>>;
  /** Whether each provider has an API key, apart from the Claude account. */
  apiKeys?: Partial<Record<BrainProvider, boolean>>;
  /** The PC's work thread, and whether it is signed in to a Claude account. */
  account?: { pcOnline: boolean; loggedIn: boolean };
  /** The model that is planning the work now. */
  director?: string;
  /** Realtime providers by name (google, openai, aws): the agent's older, flat report. */
  voiceProviders: Record<string, boolean>;
  /** Every provider per stage and whether its key is on the agent; empty from older agents. */
  voiceKeys: Partial<Record<VoiceStage, Record<string, boolean>>>;
  tavily: boolean;
  usableModels: string[];
  spend: { month: string; usd: number; budgetUsd: number; byModel: Record<string, number> };
  tasks: BrainTaskStatus[];
  /**
   * Live models (by name prefix, per provider) that can answer in text for a
   * TTS to speak: the ones the panel allows on Live + TTS. Absent from older
   * agents, where lib/voiceEngines.ts keeps a copy.
   */
  hybridRealtime?: Record<string, string[]>;
  receivedAt: number;
}

export const BRAIN_PROVIDERS: readonly BrainProvider[] = [
  'anthropic',
  'google',
  'openai',
  'xai',
  'openrouter',
  'groq',
  'deepseek',
  'mistral',
  'local',
];
export const BRAIN_ROLES: readonly BrainRole[] = [
  'fast',
  'standard',
  'expert',
  'search',
  'x_search',
  'code',
];
export const BRAIN_ACCESS: readonly BrainAccess[] = ['auto', 'account', 'api'];

const THINKING: readonly BrainRole[] = ['fast', 'standard', 'expert'];
/**
 * What each provider can actually do. Mirrors the agent's `PROVIDER_ROLES`: a model
 * given a job it has no tool for would answer anyway, from memory.
 */
export const PROVIDER_ROLES: Record<BrainProvider, readonly BrainRole[]> = {
  anthropic: [...THINKING, 'search'],
  google: [...THINKING, 'search'],
  openai: [...THINKING, 'search'],
  xai: [...THINKING, 'search', 'x_search'],
  openrouter: THINKING,
  groq: THINKING,
  deepseek: THINKING,
  mistral: THINKING,
  local: ['code'],
};

/** Long enough for a real brief. Mirrors the agent's limit. */
export const MAX_INSTRUCTIONS = 2000;

/** The environment variable each provider needs on the agent. */
export const PROVIDER_KEY_NAME: Record<BrainProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  openai: 'OPENAI_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  local: 'ANTHROPIC_API_KEY',
};

export const PROVIDER_ICONS: Record<BrainProvider, string> = {
  anthropic: 'simple-icons:anthropic',
  google: 'simple-icons:googlegemini',
  openai: 'simple-icons:openai',
  xai: 'simple-icons:x',
  openrouter: 'simple-icons:openrouter',
  groq: 'ph:lightning-duotone',
  deepseek: 'game-icons:whale-tail',
  mistral: 'simple-icons:mistralai',
  local: 'ph:terminal-window-duotone',
};

/** Where to make a key, for the "connect" step. OpenRouter signs in instead. */
export const PROVIDER_KEY_PAGES: Partial<Record<BrainProvider, string>> = {
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/apikey',
  openai: 'https://platform.openai.com/api-keys',
  xai: 'https://console.x.ai',
  groq: 'https://console.groq.com/keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  mistral: 'https://console.mistral.ai/api-keys',
};

/** Suggestions for the "add a model" form. Any id the provider accepts works. */
export const MODEL_SUGGESTIONS: Record<BrainProvider, { model: string; label: string }[]> = {
  anthropic: [
    { model: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
    { model: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
    { model: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    { model: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  ],
  google: [
    { model: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { model: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  ],
  openai: [
    { model: 'gpt-5.2', label: 'GPT-5.2' },
    { model: 'gpt-5-mini', label: 'GPT-5 mini' },
  ],
  xai: [{ model: 'grok-4.7', label: 'Grok 4.7' }],
  openrouter: [{ model: 'openrouter/auto', label: 'OpenRouter Auto' }],
  groq: [{ model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)' }],
  deepseek: [{ model: 'deepseek-chat', label: 'DeepSeek Chat' }],
  mistral: [{ model: 'mistral-large-latest', label: 'Mistral Large' }],
  local: [{ model: 'claude-sonnet-5-5', label: 'Claude Code (local)' }],
};

/** The only folder the agent lets the executor use (and subfolders). */
export const EXECUTOR_ROOT = 'C:\\Users\\Usuario\\Documents\\Jarvis';

export function rosterModel(
  id: string,
  label: string,
  provider: BrainProvider,
  model: string,
  role: BrainRole,
  extra: Partial<BrainModel> = {},
): BrainModel {
  return {
    id,
    label,
    provider,
    model,
    role,
    roles: [role],
    access: 'auto',
    instructions: '',
    enabled: true,
    council: false,
    ...extra,
  };
}

/** The roster chosen on 2026-10-09. */
export function defaultBrainModels(): BrainModel[] {
  return [
    rosterModel('claude-haiku', 'Claude Haiku 5.5', 'anthropic', 'claude-haiku-5-5', 'fast'),
    rosterModel(
      'claude-sonnet',
      'Claude Sonnet 5.5',
      'anthropic',
      'claude-sonnet-5-5',
      'standard',
      {
        council: true,
      },
    ),
    rosterModel('claude-opus', 'Claude Opus 5.5', 'anthropic', 'claude-opus-5-5', 'expert', {
      council: true,
    }),
    rosterModel('gemini-flash', 'Gemini 3.5 Flash', 'google', 'gemini-3.5-flash', 'search', {
      council: true,
    }),
    rosterModel('claude-code', 'Claude Code (local)', 'local', 'claude-sonnet-5-5', 'code'),
  ];
}

export function defaultBrain(): BrainConfig {
  return {
    enabled: true,
    routing: 'auto',
    defaultModel: '',
    council: 'important',
    search: 'both',
    monthlyBudgetUsd: 150,
    budgetPolicy: 'stop',
    delivery: 'next_pause',
    onHangup: 'finish',
    splitTasks: true,
    director: '',
    relay: 'everything',
    instructions: '',
    models: defaultBrainModels(),
    executor: { folder: EXECUTOR_ROOT, permissions: 'full_no_push', maxTurns: 40, maxTaskUsd: 2 },
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function num(value: unknown, fallback: number, low: number, high: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, low), high)
    : fallback;
}

function normalizeModel(raw: unknown): BrainModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!BRAIN_PROVIDERS.includes(r.provider as BrainProvider)) return null;
  if (typeof r.model !== 'string' || !r.model.trim()) return null;
  const provider = r.provider as BrainProvider;
  const model = r.model.trim();
  const allowed = PROVIDER_ROLES[provider];
  const wanted = [...(Array.isArray(r.roles) ? r.roles : []), r.role];
  let roles = [...new Set(wanted)].filter((x): x is BrainRole => allowed.includes(x as BrainRole));
  if (!roles.length) {
    if (!BRAIN_ROLES.includes(r.role as BrainRole) && !Array.isArray(r.roles)) return null;
    roles = [allowed[0]];
  }
  return {
    id: typeof r.id === 'string' && r.id ? r.id : model,
    label: typeof r.label === 'string' ? r.label : model,
    provider,
    model,
    role: roles[0],
    roles,
    access: pick(r.access, BRAIN_ACCESS, 'auto'),
    instructions:
      typeof r.instructions === 'string' ? r.instructions.slice(0, MAX_INSTRUCTIONS) : '',
    enabled: r.enabled !== false,
    council: r.council === true,
  };
}

/** Tolerates saves from before the brain existed and from older shapes. */
export function normalizeBrain(raw: unknown): BrainConfig {
  const base = defaultBrain();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const models = Array.isArray(r.models)
    ? r.models.map(normalizeModel).filter((m): m is BrainModel => m !== null)
    : base.models;
  const ex = (r.executor && typeof r.executor === 'object' ? r.executor : {}) as Record<
    string,
    unknown
  >;
  return {
    enabled: r.enabled !== false,
    routing: pick(r.routing, ['auto', 'manual'] as const, base.routing),
    defaultModel: typeof r.defaultModel === 'string' ? r.defaultModel : '',
    council: pick(r.council, ['important', 'on_request', 'research'] as const, base.council),
    search: pick(r.search, ['native', 'tavily', 'both'] as const, base.search),
    // 50 $ that only informed was the old default, not a choice: it moves to the new one.
    ...(r.monthlyBudgetUsd === 50 && r.budgetPolicy === 'inform'
      ? { monthlyBudgetUsd: base.monthlyBudgetUsd, budgetPolicy: base.budgetPolicy }
      : {
          monthlyBudgetUsd: num(r.monthlyBudgetUsd, base.monthlyBudgetUsd, 0, 10_000),
          budgetPolicy: pick(
            r.budgetPolicy,
            ['inform', 'downgrade', 'stop'] as const,
            base.budgetPolicy,
          ),
        }),
    delivery: pick(r.delivery, ['next_pause', 'interrupt', 'on_request'] as const, base.delivery),
    onHangup: pick(r.onHangup, ['finish', 'cancel'] as const, base.onHangup),
    splitTasks: r.splitTasks !== false,
    director: typeof r.director === 'string' ? r.director : '',
    relay: pick(r.relay, ['everything', 'work_only'] as const, base.relay),
    instructions:
      typeof r.instructions === 'string' ? r.instructions.slice(0, MAX_INSTRUCTIONS) : '',
    models,
    executor: {
      folder: typeof ex.folder === 'string' && ex.folder ? ex.folder : base.executor.folder,
      permissions: pick(
        ex.permissions,
        ['full_no_push', 'edit_only', 'read_only'] as const,
        base.executor.permissions,
      ),
      maxTurns: num(ex.maxTurns, base.executor.maxTurns, 1, 200),
      maxTaskUsd: num(ex.maxTaskUsd, base.executor.maxTaskUsd, 0.05, 50),
    },
  };
}

/** A plain copy for the data channel and for snapshots. */
export function brainPayload(config: BrainConfig): BrainConfig {
  return {
    ...config,
    models: config.models.map((m) => ({ ...m, roles: [...m.roles] })),
    executor: { ...config.executor },
  };
}

/** Same table as the agent's router: which role a task of this shape lands on. */
export function roleFor(kind: string, difficulty: 'simple' | 'normal' | 'hard'): BrainRole {
  if (kind === 'code') return 'code';
  if (kind === 'x_search') return 'x_search';
  if (kind === 'research')
    return difficulty === 'simple' ? 'search' : difficulty === 'hard' ? 'expert' : 'standard';
  return difficulty === 'simple' ? 'fast' : difficulty === 'hard' ? 'expert' : 'standard';
}

/** Whether a model can run, given what the agent last reported. Unknown counts as usable. */
export function modelUsable(model: BrainModel, status: BrainStatus | null): boolean {
  if (!model.enabled) return false;
  if (!status) return true;
  if (model.provider !== 'anthropic' && model.provider !== 'local') {
    return status.providers[model.provider] !== false;
  }
  // An older agent reports neither: then "providers" is all there is to go on.
  if (!status.account || !status.apiKeys) return status.providers[model.provider] !== false;
  const hasKey = status.apiKeys[model.provider] !== false;
  const hasAccount = status.account.loggedIn;
  if (model.access === 'api') return hasKey;
  if (model.access === 'account') return hasAccount;
  return hasKey || hasAccount;
}

/** The env var each voice provider needs on the agent, for the "no key" hint. */
export const VOICE_KEY_NAMES: Record<VoiceStage, Record<string, string>> = {
  stt: {
    deepgram: 'DEEPGRAM_API_KEY',
    openai: 'OPENAI_API_KEY',
    assemblyai: 'ASSEMBLYAI_API_KEY',
    gemini: 'GOOGLE_API_KEY',
    google: 'GOOGLE_APPLICATION_CREDENTIALS',
    elevenlabs: 'ELEVEN_API_KEY',
    cartesia: 'CARTESIA_API_KEY',
  },
  tts: {
    openai: 'OPENAI_API_KEY',
    elevenlabs: 'ELEVEN_API_KEY',
    cartesia: 'CARTESIA_API_KEY',
    deepgram: 'DEEPGRAM_API_KEY',
    google: 'GOOGLE_APPLICATION_CREDENTIALS',
    gemini: 'GOOGLE_API_KEY',
    rime: 'LIVEKIT_API_KEY / LIVEKIT_API_SECRET',
  },
  llm: {
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    groq: 'GROQ_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    cerebras: 'CEREBRAS_API_KEY',
  },
  realtime: {
    google: 'GOOGLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    aws: 'AWS_ACCESS_KEY_ID',
  },
};

/**
 * Whether a voice provider can be picked, given what the agent last reported.
 * False only when the agent said its key is missing; unknown counts as usable,
 * so an older agent or a provider it does not list never locks the panel.
 */
export function voiceProviderHasKey(
  status: BrainStatus | null,
  stage: VoiceStage,
  provider: string,
): boolean {
  if (!status) return true;
  const name = provider.toLowerCase();
  // Optional chaining: a status cached by an older build has neither map.
  const stageKeys = status.voiceKeys?.[stage];
  if (stageKeys && name in stageKeys) return stageKeys[name] !== false;
  if (stage === 'realtime') return status.voiceProviders?.[name] !== false;
  return true;
}

/** The env var to name in the hint, or a generic label. */
export function voiceKeyName(stage: VoiceStage, provider: string): string {
  return VOICE_KEY_NAMES[stage][provider.toLowerCase()] ?? 'API key';
}

function booleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
    if (typeof flag === 'boolean') out[key] = flag;
  }
  return out;
}

/** `{provider: [prefix...]}` with string prefixes only; undefined when absent. */
function prefixMap(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [provider, prefixes] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(prefixes)) {
      out[provider] = prefixes.filter((p): p is string => typeof p === 'string');
    }
  }
  return out;
}

/** Splits the agent's report into the flat realtime keys and the per-stage maps. */
function parseVoiceProviders(raw: unknown): Pick<BrainStatus, 'voiceProviders' | 'voiceKeys'> {
  const voiceKeys: BrainStatus['voiceKeys'] = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    for (const stage of VOICE_STAGES) {
      if (record[stage] && typeof record[stage] === 'object') {
        voiceKeys[stage] = booleanMap(record[stage]);
      }
    }
  }
  return { voiceProviders: booleanMap(raw), voiceKeys };
}

export function parseBrainStatus(raw: unknown): BrainStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'brain_status') return null;
  const spend = (r.spend && typeof r.spend === 'object' ? r.spend : {}) as Record<string, unknown>;
  return {
    enabled: r.enabled !== false,
    providers: (r.providers as BrainStatus['providers']) ?? {},
    apiKeys: booleanMap(r.apiKeys) as BrainStatus['apiKeys'],
    account:
      r.account && typeof r.account === 'object'
        ? {
            pcOnline: (r.account as Record<string, unknown>).pcOnline === true,
            loggedIn: (r.account as Record<string, unknown>).loggedIn === true,
          }
        : undefined,
    director: typeof r.director === 'string' ? r.director : undefined,
    ...parseVoiceProviders(r.voiceProviders),
    tavily: r.tavily === true,
    usableModels: Array.isArray(r.usableModels) ? (r.usableModels as string[]) : [],
    spend: {
      month: typeof spend.month === 'string' ? spend.month : '',
      usd: typeof spend.usd === 'number' ? spend.usd : 0,
      budgetUsd: typeof spend.budgetUsd === 'number' ? spend.budgetUsd : 0,
      byModel: (spend.byModel as Record<string, number>) ?? {},
    },
    tasks: Array.isArray(r.tasks) ? (r.tasks as BrainTaskStatus[]) : [],
    hybridRealtime: prefixMap(r.hybridRealtime),
    receivedAt: Date.now(),
  };
}

/**
 * The user changed instructions by voice: the agent sends
 * `{type: 'brain_instructions', target: 'brain' | <model id>, instructions}`.
 * Returns the new config and who changed (empty label for the whole brain), or
 * null when the message is not one or names a model this roster does not have.
 */
export function applyInstructionsChange(
  config: BrainConfig,
  raw: unknown,
): { config: BrainConfig; label: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'brain_instructions' || typeof r.instructions !== 'string') return null;
  const instructions = r.instructions.slice(0, MAX_INSTRUCTIONS);
  if (r.target === 'brain') return { config: { ...config, instructions }, label: '' };
  const model = config.models.find((m) => m.id === r.target);
  if (!model) return null;
  return {
    config: {
      ...config,
      models: config.models.map((m) => (m.id === model.id ? { ...m, instructions } : m)),
    },
    label: model.label || model.model,
  };
}

/** The voice chosen for Jarvis: Gemini Live speaks, the brain works. */
export const JARVIS_VOICE = {
  provider: 'google',
  model: 'gemini-3.1-flash-live-preview',
  voice: 'Charon',
} as const;
