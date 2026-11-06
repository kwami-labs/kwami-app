<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import { panelIcons } from '@/constants/panel-icons';
import {
  SITE_ACCESS_LEVELS,
  SITE_ACCESS_META,
  SITE_SUGGESTIONS,
  siteHost,
  siteHue,
  type SiteAccessLevel,
} from '@/constants/siteAccess';
import {
  SITE_ACCESS_POLL_MS,
  useSiteAccess,
  type SiteCheck,
  type SiteRule,
} from '@/composables/useSiteAccess';
import PanelHeaderControls from '@/components/ui/PanelHeaderControls.vue';
import PanelSection from '@/components/ui/PanelSection.vue';
import AccessLevelPicker from './AccessLevelPicker.vue';

const { t } = useI18n();
const toast = useToast();
const access = useSiteAccess();
const { defaultLevel, sites, pending, loaded, unavailable, blockedCount } = access;

// -- adding --------------------------------------------------------------------
const newAddress = ref('');
const newLevel = ref<SiteAccessLevel>('browse');
const adding = ref(false);
const newHost = computed(() => siteHost(newAddress.value));
const newInvalid = computed(() => newAddress.value.trim() !== '' && newHost.value === null);
const suggestions = computed(() =>
  SITE_SUGGESTIONS.filter((s) => !sites.value.some((r) => r.pattern === s.host)).slice(0, 6),
);

async function addSite() {
  if (!newHost.value || adding.value) return;
  adding.value = true;
  try {
    const rule = await access.setSite(newAddress.value, newLevel.value);
    toast.success(t('siteAccess.add.added', { host: rule.pattern }));
    flash(rule.id);
    newAddress.value = '';
  } catch {
    toast.error(t('siteAccess.saveFailed'));
  } finally {
    adding.value = false;
  }
}

function useSuggestion(host: string, level: SiteAccessLevel) {
  newAddress.value = host;
  newLevel.value = level;
}

// -- the list --------------------------------------------------------------------
const filter = ref('');
const shown = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return q ? sites.value.filter((s) => s.pattern.includes(q)) : sites.value;
});
const confirming = ref<string | null>(null);
const justSaved = ref<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | undefined;

function flash(id: string) {
  justSaved.value = id;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (justSaved.value = null), 1400);
}

async function change(rule: SiteRule, level: SiteAccessLevel) {
  if (rule.access === level) return;
  try {
    await access.changeSite(rule, level);
    flash(rule.id);
  } catch {
    toast.error(t('siteAccess.saveFailed'));
  }
}

async function remove(rule: SiteRule) {
  if (confirming.value !== rule.id) {
    confirming.value = rule.id;
    return;
  }
  confirming.value = null;
  try {
    await access.removeSite(rule);
  } catch {
    toast.error(t('siteAccess.saveFailed'));
  }
}

async function changeDefault(level: SiteAccessLevel) {
  if (defaultLevel.value === level) return;
  try {
    await access.setDefault(level);
  } catch {
    toast.error(t('siteAccess.saveFailed'));
  }
}

// -- Jarvis's requests ---------------------------------------------------------------
const answerLevels = ref<Record<string, SiteAccessLevel>>({});
const answering = ref<string | null>(null);

async function answer(rule: SiteRule, approve: boolean) {
  answering.value = rule.id;
  try {
    await access.answer(rule, approve, answerLevels.value[rule.id]);
    const key = approve ? 'siteAccess.requests.approved' : 'siteAccess.requests.denied';
    toast.info(t(key, { host: rule.pattern }));
  } catch {
    toast.error(t('siteAccess.saveFailed'));
  } finally {
    answering.value = null;
  }
}

// -- testing an address --------------------------------------------------------------
const testAddress = ref('');
const testResult = ref<SiteCheck | null>(null);
const testing = ref(false);
const testInvalid = ref(false);

async function runTest() {
  testInvalid.value = false;
  testResult.value = null;
  if (!siteHost(testAddress.value)) {
    testInvalid.value = true;
    return;
  }
  testing.value = true;
  try {
    testResult.value = await access.check(testAddress.value);
  } catch {
    testInvalid.value = true;
  } finally {
    testing.value = false;
  }
}

function levelLabel(level: SiteAccessLevel) {
  return t(`siteAccess.levels.${level}`);
}

function monogram(host: string) {
  return host
    .replace(/^www\./, '')
    .charAt(0)
    .toUpperCase();
}

// While the panel is open, a request Jarvis makes during a call shows up here.
let poll: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void access.load();
  poll = setInterval(() => {
    if (document.visibilityState === 'visible') void access.load();
  }, SITE_ACCESS_POLL_MS);
});
onUnmounted(() => {
  clearInterval(poll);
  clearTimeout(flashTimer);
});
</script>

<template>
  <div class="panel-inner access-panel">
    <div class="panel-header">
      <iconify-icon :icon="panelIcons.access" class="panel-icon"></iconify-icon>
      <h2>{{ t('siteAccess.title') }}</h2>
      <PanelHeaderControls />
    </div>

    <div class="panel-body">
      <!-- Status: a shield that glows in the colour of the default level -->
      <div class="hero" :style="{ '--level': SITE_ACCESS_META[defaultLevel].color }">
        <div class="hero-orb" aria-hidden="true">
          <span class="ring r1"></span>
          <span class="ring r2"></span>
          <span class="ring r3"></span>
          <iconify-icon icon="ph:shield-checkered-duotone"></iconify-icon>
        </div>
        <div class="hero-text">
          <p class="hero-sub">{{ t('siteAccess.subtitle') }}</p>
          <div class="hero-stats">
            <span class="stat">
              <strong>{{ sites.length }}</strong> {{ t('siteAccess.stats.sites') }}
            </span>
            <span class="stat danger">
              <strong>{{ blockedCount }}</strong> {{ t('siteAccess.stats.blocked') }}
            </span>
            <span class="stat" :class="{ attention: pending.length > 0 }">
              <strong>{{ pending.length }}</strong> {{ t('siteAccess.stats.requests') }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="unavailable" class="notice">
        <iconify-icon icon="ph:plug-duotone"></iconify-icon>
        <span>{{ t('siteAccess.unavailable') }}</span>
        <button class="link" @click="access.load()">{{ t('siteAccess.retry') }}</button>
      </div>

      <template v-else-if="loaded">
        <!-- Jarvis's requests -->
        <TransitionGroup v-if="pending.length" name="req" tag="div" class="requests">
          <div class="requests-title" key="title">
            <span class="pulse-dot"></span>{{ t('siteAccess.requests.title') }}
          </div>
          <article v-for="req in pending" :key="req.id" class="request">
            <div class="request-head">
              <span class="monogram" :style="{ '--hue': siteHue(req.pattern) }">
                {{ monogram(req.pattern) }}
              </span>
              <div class="request-what">
                <span class="host">{{ req.pattern }}</span>
                <span class="wants">
                  {{ t('siteAccess.requests.wants') }}
                  <span class="chip" :style="{ '--c': SITE_ACCESS_META[req.access].color }">
                    <iconify-icon :icon="SITE_ACCESS_META[req.access].icon"></iconify-icon>
                    {{ levelLabel(req.access) }}
                  </span>
                </span>
              </div>
            </div>
            <p v-if="req.reason" class="reason">“{{ req.reason }}”</p>
            <AccessLevelPicker
              compact
              :model-value="answerLevels[req.id] ?? req.access"
              @update:model-value="answerLevels[req.id] = $event"
            />
            <div class="request-actions">
              <button
                class="btn ghost"
                :disabled="answering === req.id"
                @click="answer(req, false)"
              >
                <iconify-icon icon="ph:x-bold"></iconify-icon>{{ t('siteAccess.requests.deny') }}
              </button>
              <button
                class="btn primary"
                :disabled="answering === req.id"
                @click="answer(req, true)"
              >
                <iconify-icon icon="ph:check-bold"></iconify-icon
                >{{ t('siteAccess.requests.approve') }}
              </button>
            </div>
          </article>
        </TransitionGroup>

        <!-- Every other site -->
        <PanelSection
          :title="t('siteAccess.default.title')"
          icon="ph:globe-hemisphere-west-duotone"
        >
          <p class="hint">{{ t('siteAccess.default.hint') }}</p>
          <AccessLevelPicker
            :model-value="defaultLevel"
            show-hint
            @update:model-value="changeDefault"
          />
        </PanelSection>

        <!-- Add a site -->
        <PanelSection :title="t('siteAccess.add.title')" icon="ph:plus-circle-duotone">
          <form class="add" @submit.prevent="addSite">
            <div class="address" :class="{ invalid: newInvalid, ok: newHost }">
              <span
                class="monogram small"
                :style="{ '--hue': newHost ? siteHue(newHost) : 210 }"
                aria-hidden="true"
              >
                <template v-if="newHost">{{ monogram(newHost) }}</template>
                <iconify-icon v-else icon="ph:globe-simple"></iconify-icon>
              </span>
              <input
                v-model="newAddress"
                type="text"
                inputmode="url"
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('siteAccess.add.placeholder')"
                :aria-label="t('siteAccess.add.placeholder')"
              />
              <span v-if="newHost && newHost !== newAddress.trim()" class="preview">
                {{ newHost }}
              </span>
            </div>
            <p v-if="newInvalid" class="hint warn">{{ t('siteAccess.add.invalid') }}</p>
            <AccessLevelPicker v-model="newLevel" show-hint />
            <button class="btn primary wide" type="submit" :disabled="!newHost || adding">
              <iconify-icon
                :icon="adding ? 'ph:spinner-gap' : 'ph:plus-bold'"
                :class="{ spin: adding }"
              ></iconify-icon>
              {{ t('siteAccess.add.button') }}
            </button>
          </form>
          <div v-if="suggestions.length" class="suggestions">
            <span class="label">{{ t('siteAccess.add.suggestions') }}</span>
            <button
              v-for="s in suggestions"
              :key="s.host"
              class="suggestion"
              type="button"
              @click="useSuggestion(s.host, s.level)"
            >
              <span class="dot" :style="{ background: SITE_ACCESS_META[s.level].color }"></span>
              {{ s.host }}
            </button>
          </div>
        </PanelSection>

        <!-- The list -->
        <PanelSection :title="t('siteAccess.list.title')" icon="ph:list-checks-duotone">
          <div v-if="sites.length > 4" class="search">
            <iconify-icon icon="ph:magnifying-glass"></iconify-icon>
            <input v-model="filter" type="search" :placeholder="t('siteAccess.list.search')" />
          </div>
          <p v-if="!sites.length" class="empty">{{ t('siteAccess.list.empty') }}</p>
          <p v-else-if="!shown.length" class="empty">{{ t('siteAccess.list.noMatch') }}</p>
          <TransitionGroup name="row" tag="ul" class="sites">
            <li
              v-for="rule in shown"
              :key="rule.id"
              class="site"
              :class="{ saved: justSaved === rule.id }"
              :style="{ '--c': SITE_ACCESS_META[rule.access].color }"
            >
              <span class="monogram" :style="{ '--hue': siteHue(rule.pattern) }">
                {{ monogram(rule.pattern) }}
              </span>
              <div class="site-main">
                <div class="site-top">
                  <span class="host" :title="t('siteAccess.list.covers')">{{ rule.pattern }}</span>
                  <span class="level-tag">
                    <iconify-icon :icon="SITE_ACCESS_META[rule.access].icon"></iconify-icon>
                    {{ levelLabel(rule.access) }}
                  </span>
                </div>
                <AccessLevelPicker
                  compact
                  :model-value="rule.access"
                  @update:model-value="change(rule, $event)"
                />
              </div>
              <button
                class="remove"
                :class="{ confirm: confirming === rule.id }"
                :title="t('siteAccess.list.remove')"
                :aria-label="t('siteAccess.list.remove')"
                @click="remove(rule)"
                @blur="confirming = null"
              >
                <iconify-icon icon="ph:trash-duotone"></iconify-icon>
                <span v-if="confirming === rule.id">{{ t('siteAccess.list.confirmRemove') }}</span>
              </button>
            </li>
          </TransitionGroup>
        </PanelSection>

        <!-- Test an address -->
        <PanelSection
          :title="t('siteAccess.test.title')"
          icon="ph:flask-duotone"
          collapsible
          default-collapsed
        >
          <form class="tester" @submit.prevent="runTest">
            <input
              v-model="testAddress"
              type="text"
              inputmode="url"
              spellcheck="false"
              :placeholder="t('siteAccess.test.placeholder')"
              :aria-label="t('siteAccess.test.title')"
            />
            <button class="btn ghost" type="submit" :disabled="testing">
              <iconify-icon icon="ph:play-duotone"></iconify-icon>{{ t('siteAccess.test.button') }}
            </button>
          </form>
          <p v-if="testInvalid" class="hint warn">{{ t('siteAccess.add.invalid') }}</p>
          <Transition name="fade">
            <div
              v-if="testResult"
              class="test-result"
              :style="{ '--c': SITE_ACCESS_META[testResult.access].color }"
            >
              <span>{{ t('siteAccess.test.result', { host: testResult.host }) }}</span>
              <strong>
                <iconify-icon :icon="SITE_ACCESS_META[testResult.access].icon"></iconify-icon>
                {{ levelLabel(testResult.access) }}
              </strong>
              <small>{{ t(`siteAccess.levelHints.${testResult.access}`) }}</small>
              <small class="by">
                {{
                  testResult.pattern === '*'
                    ? t('siteAccess.test.byDefault')
                    : t('siteAccess.test.byRule', { pattern: testResult.pattern })
                }}
              </small>
            </div>
          </Transition>
        </PanelSection>

        <!-- Legend -->
        <PanelSection
          :title="t('siteAccess.legend')"
          icon="ph:info-duotone"
          collapsible
          default-collapsed
        >
          <ol class="legend">
            <li
              v-for="level in SITE_ACCESS_LEVELS"
              :key="level"
              :style="{ '--c': SITE_ACCESS_META[level].color }"
            >
              <iconify-icon :icon="SITE_ACCESS_META[level].icon"></iconify-icon>
              <strong>{{ levelLabel(level) }}</strong>
              <span>{{ t(`siteAccess.levelHints.${level}`) }}</span>
            </li>
          </ol>
        </PanelSection>
      </template>

      <div v-else class="skeleton" aria-busy="true">
        <span v-for="n in 4" :key="n" class="bar"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.access-panel .panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* The body scrolls; its blocks keep their height instead of squeezing to fit. */
.access-panel .panel-body > * {
  flex-shrink: 0;
}

/* -- hero ---------------------------------------------------------------------- */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--level) 35%, transparent);
  background:
    radial-gradient(
      120% 140% at 0% 0%,
      color-mix(in srgb, var(--level) 18%, transparent),
      transparent 60%
    ),
    var(--surface-1);
  overflow: hidden;
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 30%,
    color-mix(in srgb, var(--level) 12%, transparent) 50%,
    transparent 70%
  );
  transform: translateX(-100%);
  animation: sweep 5s ease-in-out infinite;
  pointer-events: none;
}
.hero-orb {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 26px;
  color: var(--level);
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--level) 60%, transparent));
}
.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--level) 45%, transparent);
  animation: ripple 3.2s ease-out infinite;
}
.r2 {
  animation-delay: 1.05s;
}
.r3 {
  animation-delay: 2.1s;
}
.hero-text {
  min-width: 0;
}
.hero-sub {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.stat {
  font-size: 11px;
  color: var(--text-tertiary);
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface-2);
}
.stat strong {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.stat.danger strong {
  color: #f87171;
}
.stat.attention {
  background: color-mix(in srgb, #fbbf24 18%, transparent);
  color: #fbbf24;
}
.stat.attention strong {
  color: #fbbf24;
}

/* -- requests --------------------------------------------------------------------- */
.requests {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.requests-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: #fbbf24;
}
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.6);
  animation: pulse 1.6s ease-out infinite;
}
.request {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(251, 191, 36, 0.4);
  background: linear-gradient(160deg, rgba(251, 191, 36, 0.1), transparent 70%), var(--surface-1);
}
.request-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.request-what {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.wants {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.reason {
  margin: 0;
  font-size: 12px;
  font-style: italic;
  color: var(--text-secondary);
}
.request-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* -- shared bits --------------------------------------------------------------------- */
.hint {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.hint.warn {
  color: #fbbf24;
  margin: 6px 0 0;
}
.monogram {
  --hue: 200;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: hsl(var(--hue) 90% 80%);
  background: linear-gradient(
    145deg,
    hsl(var(--hue) 70% 45% / 0.45),
    hsl(calc(var(--hue) + 40) 70% 30% / 0.35)
  );
  border: 1px solid hsl(var(--hue) 70% 60% / 0.35);
}
.monogram.small {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: 12px;
}
.host {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--c);
  background: color-mix(in srgb, var(--c) 16%, transparent);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    background var(--duration-fast) var(--ease-out);
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn.primary {
  color: #001018;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent-primary), #7c3aed);
  box-shadow: 0 4px 16px var(--accent-glow);
}
.btn.primary:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 22px var(--accent-glow);
}
.btn.ghost {
  color: var(--text-secondary);
  background: var(--surface-1);
}
.btn.ghost:not(:disabled):hover {
  color: var(--text-primary);
  background: var(--surface-2);
}
.btn.wide {
  width: 100%;
}
.link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--accent-primary);
  cursor: pointer;
}
.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  font-size: 12px;
  color: var(--text-secondary);
}

/* -- add --------------------------------------------------------------------------- */
.add {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.address {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.address:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.address.invalid {
  border-color: #f87171;
}
.address input,
.tester input,
.search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}
.preview {
  font-size: 11px;
  color: var(--accent-primary);
  white-space: nowrap;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.suggestions .label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  margin-right: 2px;
}
.suggestion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.suggestion:hover {
  color: var(--text-primary);
  border-color: var(--accent-primary);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* -- list --------------------------------------------------------------------------- */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 8px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  color: var(--text-muted);
}
.empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 10px 0;
}
.sites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.site {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 10px 10px 13px;
  border-radius: var(--radius-md);
  background: var(--surface-1);
  border: 1px solid transparent;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow 0.4s var(--ease-out);
}
.site::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 3px;
  background: var(--c);
  box-shadow: 0 0 10px var(--c);
}
.site:hover {
  border-color: var(--glass-border);
}
.site.saved {
  box-shadow:
    0 0 0 1px var(--c),
    0 0 18px color-mix(in srgb, var(--c) 35%, transparent);
}
.site-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.site-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 2px 8px;
  min-width: 0;
}
.site-top .host {
  min-width: 0;
  flex: 1 1 auto;
}
.level-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--c);
  white-space: nowrap;
}
.remove {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.remove:hover,
.remove.confirm {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

/* -- tester and legend ----------------------------------------------------------------- */
.tester {
  display: flex;
  gap: 8px;
}
.tester input {
  padding: 7px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
}
.test-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  background: color-mix(in srgb, var(--c) 10%, var(--surface-1));
  font-size: 12px;
  color: var(--text-secondary);
}
.test-result strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: var(--c);
}
.test-result small {
  color: var(--text-tertiary);
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.legend li {
  display: grid;
  grid-template-columns: 18px 72px 1fr;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}
.legend iconify-icon,
.legend strong {
  color: var(--c);
}

/* -- loading ------------------------------------------------------------------------------- */
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bar {
  height: 54px;
  border-radius: var(--radius-md);
  background: linear-gradient(90deg, var(--surface-1), var(--surface-2), var(--surface-1));
  background-size: 200% 100%;
  animation: shimmer 1.3s linear infinite;
}
.spin {
  animation: spin 0.8s linear infinite;
}

/* -- motion ---------------------------------------------------------------------------- */
.row-enter-active,
.row-leave-active,
.req-enter-active,
.req-leave-active {
  transition: all 0.28s var(--ease-out);
}
.row-enter-from,
.req-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.row-leave-to,
.req-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes ripple {
  from {
    transform: scale(0.55);
    opacity: 0.9;
  }
  to {
    transform: scale(1.35);
    opacity: 0;
  }
}
@keyframes sweep {
  0%,
  35% {
    transform: translateX(-100%);
  }
  65%,
  100% {
    transform: translateX(100%);
  }
}
@keyframes pulse {
  to {
    box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
  }
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .ring,
  .hero::after,
  .pulse-dot,
  .bar {
    animation: none;
  }
}
</style>
