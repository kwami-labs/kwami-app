<script setup lang="ts">
/**
 * The login screen's three preferences: what language it speaks, whether it is
 * light or dark, and what it is painted with. All are decisions someone needs
 * to make *before* signing in -- the settings panels that hold them afterwards
 * are behind the very screen they are looking at -- so they get a corner of
 * their own, mirroring `SoundtrackPill` across the bottom of the page.
 *
 * Styled from the `--auth-*` tokens in `variables.css`, like the rest of this
 * screen, rather than the `--surface-*` / `--accent-*` tokens the signed-in
 * chrome uses.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  LOCALE_ENDONYMS,
  SUPPORTED_LOCALES,
  getCurrentLocale,
  setLocale,
  type SupportedLocale,
} from '@/i18n';
import { getFlagIcon } from '@/constants/language-flags';
import { useThemeStore } from '@/stores/theme';
import { useWelcomeBackground } from '@/composables/useWelcomeBackground';

const { t } = useI18n();
const themeStore = useThemeStore();
const { videoId, video, presets, setVideo, shuffle } = useWelcomeBackground();

const locales = SUPPORTED_LOCALES;
const currentLocale = computed(() => getCurrentLocale());

/**
 * `mode` can be `system` or `auto`, neither of which answers "is the screen
 * light right now?" -- which is the only thing a two-state toggle can show.
 * `resolvedMode` is what the store actually wrote to `data-theme`.
 */
const isLight = computed(() => themeStore.resolvedMode === 'light');

const themeLabel = computed(() =>
  isLight.value ? t('auth.switchToDark') : t('auth.switchToLight'),
);

const languageLabel = computed(() =>
  t('auth.languageCurrent', { language: LOCALE_ENDONYMS[currentLocale.value] }),
);

const backgroundLabel = computed(() =>
  video.value ? t('auth.backgroundCurrent', { name: video.value.name }) : t('auth.backgroundMenu'),
);

// --- menus -----------------------------------------------------------------

/**
 * One slot, not a flag per menu: two popovers anchored to the same corner must
 * never be open at once, and a single value makes that true by construction
 * rather than by remembering to close the other one.
 */
type MenuName = 'language' | 'background';

const openMenu = ref<MenuName | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const languageTriggerEl = ref<HTMLButtonElement | null>(null);
const backgroundTriggerEl = ref<HTMLButtonElement | null>(null);
const itemEls = ref<HTMLButtonElement[]>([]);

/** Item index the menu should land on when it opens. */
const languageIndex = computed(() => Math.max(0, locales.indexOf(currentLocale.value)));
/** Offset by the two fixed rows (gradient, shuffle) that precede the clips. */
const backgroundIndex = computed(() => {
  const found = presets.findIndex((preset) => preset.id === videoId.value);
  return found >= 0 ? found + 2 : 0;
});

function setItemEl(el: Element | null, index: number) {
  if (el) itemEls.value[index] = el as HTMLButtonElement;
}

function triggerFor(menu: MenuName) {
  return menu === 'language' ? languageTriggerEl.value : backgroundTriggerEl.value;
}

function open(menu: MenuName) {
  itemEls.value = [];
  openMenu.value = menu;
  void nextTick(() => {
    const index = menu === 'language' ? languageIndex.value : backgroundIndex.value;
    (itemEls.value[index] ?? itemEls.value[0])?.focus();
  });
}

function close(refocus: MenuName | null = openMenu.value) {
  if (!openMenu.value) return;
  const trigger = refocus ? triggerFor(refocus) : null;
  openMenu.value = null;
  trigger?.focus();
}

function toggle(menu: MenuName) {
  if (openMenu.value === menu) close();
  else open(menu);
}

function chooseLocale(locale: SupportedLocale) {
  // localStorage only: nobody is signed in yet, so there is no row to write to.
  // `loadUserLocaleFromDb` seeds the table from whatever is live here the first
  // time this user signs in, so a choice made on this screen does carry over.
  setLocale(locale);
  close();
}

function chooseBackground(id: string | null) {
  setVideo(id);
  close();
}

function shuffleBackground() {
  shuffle();
  // Deliberately left open: shuffling is a "show me another" gesture, and
  // reopening the menu for every reroll would make trying a few unbearable.
}

/** Roving focus, so either menu is usable without a pointer. */
function onMenuKeydown(event: KeyboardEvent, index: number, count: number) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  itemEls.value[(index + delta + count) % count]?.focus();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node)) close(null);
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close();
}

watch(openMenu, (menu) => {
  if (menu) {
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeydown);
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    document.removeEventListener('keydown', onDocumentKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});

function toggleTheme() {
  themeStore.setMode(isLight.value ? 'dark' : 'light');
}
</script>

<template>
  <div ref="rootEl" class="prefs-pill" :aria-label="t('auth.preferences')" role="group">
    <Transition name="menu-pop">
      <div
        v-if="openMenu === 'language'"
        class="pill-menu"
        role="menu"
        :aria-label="t('auth.languageMenu')"
      >
        <button
          v-for="(locale, index) in locales"
          :key="locale"
          :ref="(el) => setItemEl(el as Element | null, index)"
          class="menu-item"
          :class="{ 'menu-item--active': locale === currentLocale }"
          type="button"
          role="menuitemradio"
          :aria-checked="locale === currentLocale"
          @click="chooseLocale(locale)"
          @keydown="onMenuKeydown($event, index, locales.length)"
        >
          <iconify-icon :icon="getFlagIcon(locale)" class="menu-flag"></iconify-icon>
          <span class="menu-name">{{ LOCALE_ENDONYMS[locale] }}</span>
          <iconify-icon
            v-if="locale === currentLocale"
            icon="ph:check-bold"
            class="menu-check"
          ></iconify-icon>
        </button>
      </div>
    </Transition>

    <Transition name="menu-pop">
      <div
        v-if="openMenu === 'background'"
        class="pill-menu pill-menu--tall"
        role="menu"
        :aria-label="t('auth.backgroundMenu')"
      >
        <button
          :ref="(el) => setItemEl(el as Element | null, 0)"
          class="menu-item"
          :class="{ 'menu-item--active': !video }"
          type="button"
          role="menuitemradio"
          :aria-checked="!video"
          @click="chooseBackground(null)"
          @keydown="onMenuKeydown($event, 0, presets.length + 2)"
        >
          <iconify-icon icon="ph:paint-brush-broad-duotone" class="menu-flag"></iconify-icon>
          <span class="menu-name">{{ t('auth.backgroundGradient') }}</span>
          <iconify-icon v-if="!video" icon="ph:check-bold" class="menu-check"></iconify-icon>
        </button>

        <button
          :ref="(el) => setItemEl(el as Element | null, 1)"
          class="menu-item"
          type="button"
          role="menuitem"
          @click="shuffleBackground"
          @keydown="onMenuKeydown($event, 1, presets.length + 2)"
        >
          <iconify-icon icon="ph:shuffle-duotone" class="menu-flag"></iconify-icon>
          <span class="menu-name">{{ t('auth.backgroundShuffle') }}</span>
        </button>

        <div class="menu-rule" role="separator"></div>

        <button
          v-for="(preset, index) in presets"
          :key="preset.id"
          :ref="(el) => setItemEl(el as Element | null, index + 2)"
          class="menu-item"
          :class="{ 'menu-item--active': preset.id === videoId }"
          type="button"
          role="menuitemradio"
          :aria-checked="preset.id === videoId"
          @click="chooseBackground(preset.id)"
          @keydown="onMenuKeydown($event, index + 2, presets.length + 2)"
        >
          <iconify-icon icon="ph:film-strip-duotone" class="menu-flag"></iconify-icon>
          <span class="menu-name">{{ preset.name }}</span>
          <iconify-icon
            v-if="preset.id === videoId"
            icon="ph:check-bold"
            class="menu-check"
          ></iconify-icon>
        </button>
      </div>
    </Transition>

    <button
      ref="languageTriggerEl"
      class="pill-btn pill-btn--flag"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="openMenu === 'language'"
      :title="languageLabel"
      :aria-label="languageLabel"
      @click="toggle('language')"
    >
      <iconify-icon :icon="getFlagIcon(currentLocale)" class="flag-icon"></iconify-icon>
    </button>

    <button
      ref="backgroundTriggerEl"
      class="pill-btn pill-btn--video"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="openMenu === 'background'"
      :title="backgroundLabel"
      :aria-label="backgroundLabel"
      @click="toggle('background')"
    >
      <iconify-icon :icon="video ? 'ph:film-strip-fill' : 'ph:film-strip'"></iconify-icon>
    </button>

    <button
      class="pill-btn pill-btn--theme"
      type="button"
      :aria-pressed="isLight"
      :title="themeLabel"
      :aria-label="themeLabel"
      @click="toggleTheme"
    >
      <iconify-icon :icon="isLight ? 'ph:moon-fill' : 'ph:sun-fill'"></iconify-icon>
    </button>
  </div>
</template>

<style scoped>
.prefs-pill {
  /* Same layer as SoundtrackPill, above AuthPage's own stack (which tops out at
     46), so both corners stay live while the login panel is open. */
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 47;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--auth-glass-border);
  background: var(--auth-glass-bg);
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow: var(--auth-glass-shadow);
  pointer-events: auto;
  transition:
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.pill-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--auth-icon);
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.pill-btn:hover {
  background: var(--auth-hover-fill);
  color: var(--auth-icon-strong);
  transform: translateY(-1px);
}

.pill-btn:focus-visible {
  outline: 2px solid var(--auth-focus-ring);
  outline-offset: 2px;
}

.pill-btn iconify-icon {
  font-size: 16px;
}

/* The flag is artwork, not a glyph: it keeps its own colours on hover and sits
   a shade larger than the other icons so the three read as the same weight. */
.flag-icon {
  font-size: 20px;
  border-radius: 999px;
}

.pill-btn[aria-expanded='true'] {
  background: var(--auth-active-fill);
  color: var(--auth-icon-strong);
}

/* A filled strip says a clip is playing; the outline says the screen is on its
   painted gradient. */
.pill-btn--video[aria-expanded='false'] {
  background: transparent;
}

.pill-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  min-width: 168px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
  border-radius: 14px;
  border: 1px solid var(--auth-glass-border);
  background: var(--auth-glass-bg-open);
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: var(--auth-glass-shadow);
}

/* The clip list is 70-odd long, so it scrolls rather than running off the top
   of the viewport. Capped against the viewport, not a fixed pixel count, so it
   still fits on a short laptop screen. */
.pill-menu--tall {
  min-width: 210px;
  max-height: min(340px, calc(100vh - 110px));
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--auth-text-dim);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.menu-item:hover {
  background: var(--auth-hover-fill);
  color: var(--auth-text);
}

.menu-item:focus-visible {
  outline: 2px solid var(--auth-focus-ring);
  outline-offset: -2px;
}

.menu-item--active {
  background: var(--auth-active-fill);
  color: var(--auth-text);
}

.menu-rule {
  flex: 0 0 auto;
  height: 1px;
  margin: 4px 6px;
  background: var(--auth-rule);
}

.menu-flag {
  flex: 0 0 auto;
  font-size: 18px;
  border-radius: 999px;
}

.menu-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-check {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--auth-icon-dim);
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
  transform-origin: bottom right;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .prefs-pill,
  .pill-btn,
  .menu-item,
  .menu-pop-enter-active,
  .menu-pop-leave-active {
    transition: none;
  }

  .pill-btn:hover {
    transform: none;
  }
}
</style>
