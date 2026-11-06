/**
 * The user's list of websites Jarvis may visit, and what it may do on each.
 *
 * Kept by the API (`/access`), read by the agent before every browser step. One
 * copy for the whole app, so the sidebar's badge and the panel agree on how many
 * of Jarvis's requests are waiting.
 */
import { computed, ref } from 'vue';
import { api } from '@/lib/apiClient';
import {
  DEFAULT_SITE_ACCESS,
  isSiteAccessLevel,
  type SiteAccessLevel,
} from '@/constants/siteAccess';

export interface SiteRule {
  id: string;
  pattern: string;
  access: SiteAccessLevel;
  reason: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AccessResponse {
  default: string;
  sites: SiteRule[];
  pending: SiteRule[];
}

export interface SiteCheck {
  host: string;
  access: SiteAccessLevel;
  pattern: string;
}

/** How often an open panel looks for requests Jarvis made during a call. */
export const SITE_ACCESS_POLL_MS = 15_000;

const defaultLevel = ref<SiteAccessLevel>(DEFAULT_SITE_ACCESS);
const sites = ref<SiteRule[]>([]);
const pending = ref<SiteRule[]>([]);
const loaded = ref(false);
const loading = ref(false);
const unavailable = ref(false);

function clean(rows: SiteRule[] | undefined): SiteRule[] {
  return (rows ?? []).filter((row) => isSiteAccessLevel(row.access));
}

function byPattern(a: SiteRule, b: SiteRule): number {
  return a.pattern.localeCompare(b.pattern);
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const body = await api.get<AccessResponse>('/access');
    defaultLevel.value = isSiteAccessLevel(body.default) ? body.default : DEFAULT_SITE_ACCESS;
    sites.value = clean(body.sites).sort(byPattern);
    pending.value = clean(body.pending);
    unavailable.value = false;
    loaded.value = true;
  } catch {
    // An API without this route (an older deployment) shows the panel as off
    // rather than as an empty list that would claim every site is open.
    unavailable.value = true;
  } finally {
    loading.value = false;
  }
}

async function setDefault(level: SiteAccessLevel): Promise<void> {
  const before = defaultLevel.value;
  defaultLevel.value = level;
  try {
    await api.put('/access/default', { access: level });
  } catch (e) {
    defaultLevel.value = before;
    throw e;
  }
}

async function setSite(address: string, level: SiteAccessLevel): Promise<SiteRule> {
  const rule = await api.put<SiteRule>('/access/sites', { address, access: level });
  const kept = { ...rule, access: level };
  sites.value = [...sites.value.filter((s) => s.pattern !== kept.pattern), kept].sort(byPattern);
  // Setting a site Jarvis asked for answers the request too.
  pending.value = pending.value.filter((p) => p.pattern !== kept.pattern);
  return kept;
}

async function changeSite(rule: SiteRule, level: SiteAccessLevel): Promise<void> {
  const before = rule.access;
  sites.value = sites.value.map((s) => (s.id === rule.id ? { ...s, access: level } : s));
  try {
    await api.put('/access/sites', { address: rule.pattern, access: level });
  } catch (e) {
    sites.value = sites.value.map((s) => (s.id === rule.id ? { ...s, access: before } : s));
    throw e;
  }
}

async function removeSite(rule: SiteRule): Promise<void> {
  const before = sites.value;
  sites.value = sites.value.filter((s) => s.id !== rule.id);
  try {
    await api.del(`/access/sites/${encodeURIComponent(rule.id)}`);
  } catch (e) {
    sites.value = before;
    throw e;
  }
}

async function answer(rule: SiteRule, approve: boolean, level?: SiteAccessLevel): Promise<void> {
  const body: { approve: boolean; access?: SiteAccessLevel } = { approve };
  if (approve && level) body.access = level;
  await api.post(`/access/requests/${encodeURIComponent(rule.id)}`, body);
  pending.value = pending.value.filter((p) => p.id !== rule.id);
  if (approve) {
    const kept = { ...rule, access: level ?? rule.access, reason: null };
    sites.value = [...sites.value.filter((s) => s.pattern !== kept.pattern), kept].sort(byPattern);
  }
}

async function check(address: string): Promise<SiteCheck> {
  return api.get<SiteCheck>(`/access/check?address=${encodeURIComponent(address)}`);
}

export function useSiteAccess() {
  const blockedCount = computed(() => sites.value.filter((s) => s.access === 'blocked').length);
  return {
    defaultLevel,
    sites,
    pending,
    loaded,
    loading,
    unavailable,
    blockedCount,
    load,
    setDefault,
    setSite,
    changeSite,
    removeSite,
    answer,
    check,
  };
}

/** Back to nothing loaded. For tests, and for signing out. */
export function resetSiteAccess(): void {
  defaultLevel.value = DEFAULT_SITE_ACCESS;
  sites.value = [];
  pending.value = [];
  loaded.value = false;
  loading.value = false;
  unavailable.value = false;
}
