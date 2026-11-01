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

export type BrainProvider = 'anthropic' | 'google' | 'openai' | 'local';
export type BrainRole = 'fast' | 'standard' | 'expert' | 'search' | 'code';
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
  role: BrainRole;
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
  startedAt: string;
  finishedAt: string;
  result?: string;
  steps?: { goal: string; difficulty: string; model: string; ok: boolean }[];
}

/** A stage of the voice pipeline, as the agent reports its providers. */
export type VoiceStage = 'stt' | 'tts' | 'llm' | 'realtime';
export const VOICE_STAGES: readonly VoiceStage[] = ['stt', 'tts', 'llm', 'realtime'];

export interface BrainStatus {
  enabled: boolean;
  providers: Partial<Record<BrainProvider, boolean>>;
  /** Realtime providers by name (google, openai, aws): the agent's older, flat report. */
  voiceProviders: Record<string, boolean>;
  /** Every provider per stage and whether its key is on the agent; empty from older agents. */
  voiceKeys: Partial<Record<VoiceStage, Record<string, boolean>>>;
  tavily: boolean;
  usableModels: string[];
  spend: { month: string; usd: number; budgetUsd: number; byModel: Record<string, number> };
  tasks: BrainTaskStatus[];
  receivedAt: number;
}

export const BRAIN_PROVIDERS: readonly BrainProvider[] = ['anthropic', 'google', 'openai', 'local'];
export const BRAIN_ROLES: readonly BrainRole[] = ['fast', 'standard', 'expert', 'search', 'code'];

/** The environment variable each provider needs on the agent. */
export const PROVIDER_KEY_NAME: Record<BrainProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_API_KEY',
  openai: 'OPENAI_API_KEY',
  local: 'ANTHROPIC_API_KEY',
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
  local: [{ model: 'claude-sonnet-5-5', label: 'Claude Code (local)' }],
};

/** The only folder the agent lets the executor use (and subfolders). */
export const EXECUTOR_ROOT = 'C:\\Users\\Usuario\\Documents\\Jarvis';

/** The roster chosen on 2026-10-09. */
export function defaultBrainModels(): BrainModel[] {
  return [
    {
      id: 'claude-haiku',
      label: 'Claude Haiku 5.5',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      role: 'fast',
      enabled: true,
      council: false,
    },
    {
      id: 'claude-sonnet',
      label: 'Claude Sonnet 5.5',
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      role: 'standard',
      enabled: true,
      council: true,
    },
    {
      id: 'claude-opus',
      label: 'Claude Opus 5.5',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      role: 'expert',
      enabled: true,
      council: true,
    },
    {
      id: 'gemini-flash',
      label: 'Gemini 3.5 Flash',
      provider: 'google',
      model: 'gemini-3.5-flash',
      role: 'search',
      enabled: true,
      council: true,
    },
    {
      id: 'claude-code',
      label: 'Claude Code (local)',
      provider: 'local',
      model: 'claude-sonnet-5-5',
      role: 'code',
      enabled: true,
      council: false,
    },
  ];
}

export function defaultBrain(): BrainConfig {
  return {
    enabled: true,
    routing: 'auto',
    defaultModel: '',
    council: 'important',
    search: 'both',
    monthlyBudgetUsd: 50,
    budgetPolicy: 'inform',
    delivery: 'next_pause',
    onHangup: 'finish',
    splitTasks: true,
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
  if (!BRAIN_ROLES.includes(r.role as BrainRole)) return null;
  if (typeof r.model !== 'string' || !r.model.trim()) return null;
  const model = r.model.trim();
  return {
    id: typeof r.id === 'string' && r.id ? r.id : model,
    label: typeof r.label === 'string' ? r.label : model,
    provider: r.provider as BrainProvider,
    model,
    role: r.role as BrainRole,
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
    monthlyBudgetUsd: num(r.monthlyBudgetUsd, base.monthlyBudgetUsd, 0, 10_000),
    budgetPolicy: pick(r.budgetPolicy, ['inform', 'downgrade', 'stop'] as const, base.budgetPolicy),
    delivery: pick(r.delivery, ['next_pause', 'interrupt', 'on_request'] as const, base.delivery),
    onHangup: pick(r.onHangup, ['finish', 'cancel'] as const, base.onHangup),
    splitTasks: r.splitTasks !== false,
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
    models: config.models.map((m) => ({ ...m })),
    executor: { ...config.executor },
  };
}

/** Same table as the agent's router: which role a task of this shape lands on. */
export function roleFor(kind: string, difficulty: 'simple' | 'normal' | 'hard'): BrainRole {
  if (kind === 'code') return 'code';
  if (kind === 'research')
    return difficulty === 'simple' ? 'search' : difficulty === 'hard' ? 'expert' : 'standard';
  return difficulty === 'simple' ? 'fast' : difficulty === 'hard' ? 'expert' : 'standard';
}

/** Whether a model can run, given what the agent last reported. Unknown counts as usable. */
export function modelUsable(model: BrainModel, status: BrainStatus | null): boolean {
  if (!model.enabled) return false;
  if (!status) return true;
  return status.providers[model.provider] !== false;
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
    receivedAt: Date.now(),
  };
}

/** The voice chosen for Jarvis: Gemini Live speaks, the brain works. */
export const JARVIS_VOICE = {
  provider: 'google',
  model: 'gemini-3.1-flash-live-preview',
  voice: 'Charon',
} as const;
