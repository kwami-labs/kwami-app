/**
 * The user's list of websites Jarvis may visit, and what it may do on each.
 *
 * Kept by the API (`/access`), read by the agent before every browser step: the
 * voice's and the work thread's, in Jarvis's own Chrome and in the user's. One copy
 * for the whole app, so the sidebar's badge and the panel agree on how many of
 * Jarvis's requests are waiting.
 *
 * Changes show at once and are put back if the API refuses them. Two things keep
 * the list steady (2026-11-17):
 *
 * - A refresh that started before a change is dropped when it lands, so the panel's
 *   poll never puts back the level the user just moved away from.
 * - A refresh that fails once the list is loaded keeps the list and marks it
 *   `stale`; only a list that never loaded shows the panel as unavailable.
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

/** What setting a site did: added it, or moved one already in the list. */
export interface SiteSaved {
  rule: SiteRule;
  existed: boolean;
}

/** How often an open panel looks for requests Jarvis made during a call. */
export const SITE_ACCESS_POLL_MS = 15_000;

const defaultLevel = ref<SiteAccessLevel>(DEFAULT_SITE_ACCESS);
const sites = ref<SiteRule[]>([]);
const pending = ref<SiteRule[]>([]);
const loaded = ref(false);
const loading = ref(false);
const unavailable = ref(false);
/** The last refresh failed: what shows is the list as it was last read. */
const stale = ref(false);
/** Bumped by every change, so a refresh that began before one is not trusted. */
let changes = 0;
/** The newest request for each site's level, so only the newest one may put it back. */
const latest = new Map<string, number>();

function clean(rows: SiteRule[] | undefined): SiteRule[] {
  return (rows ?? []).filter((row) => isSiteAccessLevel(row.access));
}

function byPattern(a: SiteRule, b: SiteRule): number {
  return a.pattern.localeCompare(b.pattern);
}

function upsert(rule: SiteRule): void {
  sites.value = [...sites.value.filter((s) => s.pattern !== rule.pattern), rule].sort(byPattern);
}

async function load(): Promise<void> {
  const started = changes;
  loading.value = true;
  try {
    const body = await api.get<AccessResponse>('/access');
    if (started !== changes) return;
    defaultLevel.value = isSiteAccessLevel(body.default) ? body.default : DEFAULT_SITE_ACCESS;
    sites.value = clean(body.sites).sort(byPattern);
    pending.value = clean(body.pending);
    unavailable.value = false;
    stale.value = false;
    loaded.value = true;
  } catch {
    // Never read: an API without this route (an older deployment) shows the panel as
    // off rather than as an empty list that would claim every site is open. Read
    // before: a network blink keeps the list on screen.
    if (loaded.value) stale.value = true;
    else unavailable.value = true;
  } finally {
    loading.value = false;
  }
}

async function setDefault(level: SiteAccessLevel): Promise<void> {
  changes++;
  const before = defaultLevel.value;
  defaultLevel.value = level;
  try {
    await api.put('/access/default', { access: level });
  } catch (e) {
    if (defaultLevel.value === level) defaultLevel.value = before;
    throw e;
  }
}

async function setSite(address: string, level: SiteAccessLevel): Promise<SiteSaved> {
  changes++;
  const rule = await api.put<SiteRule>('/access/sites', { address, access: level });
  const kept = { ...rule, access: level };
  const existed = sites.value.some((s) => s.pattern === kept.pattern);
  upsert(kept);
  // Setting a site Jarvis asked for answers the request too.
  pending.value = pending.value.filter((p) => p.pattern !== kept.pattern);
  return { rule: kept, existed };
}

async function changeSite(rule: SiteRule, level: SiteAccessLevel): Promise<void> {
  changes++;
  const mine = (latest.get(rule.id) ?? 0) + 1;
  latest.set(rule.id, mine);
  const before = sites.value.find((s) => s.id === rule.id)?.access ?? rule.access;
  sites.value = sites.value.map((s) => (s.id === rule.id ? { ...s, access: level } : s));
  try {
    await api.put('/access/sites', { address: rule.pattern, access: level });
  } catch (e) {
    // A newer choice for the same site already went out: that one decides.
    if (latest.get(rule.id) === mine) {
      sites.value = sites.value.map((s) => (s.id === rule.id ? { ...s, access: before } : s));
    }
    throw e;
  }
}

async function removeSite(rule: SiteRule): Promise<void> {
  changes++;
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
  changes++;
  const body: { approve: boolean; access?: SiteAccessLevel } = { approve };
  if (approve && level) body.access = level;
  await api.post(`/access/requests/${encodeURIComponent(rule.id)}`, body);
  pending.value = pending.value.filter((p) => p.id !== rule.id);
  if (approve) upsert({ ...rule, access: level ?? rule.access, reason: null });
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
    stale,
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
  stale.value = false;
  changes = 0;
  latest.clear();
}
