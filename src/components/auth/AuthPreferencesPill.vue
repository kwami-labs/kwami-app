<script setup lang="ts">
/**
 * The login screen's two preferences: what language it speaks and whether it is
 * light or dark. Both are decisions someone needs to make *before* signing in
 * -- the account panel that holds them afterwards is behind the very screen
 * they are looking at -- so they get a corner of their own, mirroring
 * `SoundtrackPill` across the bottom of the page.
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

const { t } = useI18n();
const themeStore = useThemeStore();

const locales = SUPPORTED_LOCALES;
const currentLocale = computed(() => getCurrentLocale());

/**
 * `mode` can be `system` or `auto`, neither of which answers "is the screen
 * light right now?" -- which is the only thing a two-state toggle can show.
 * `resolvedMode` is what the store actually wrote to `data-theme`.
 */
const isLight = computed(() => themeStore.resolvedMode === 'light');

const themeLabel = computed(() => (isLight.value ? t('auth.switchToDark') : t('auth.switchToLight')));

const languageLabel = computed(() =>
  t('auth.languageCurrent', { language: LOCALE_ENDONYMS[currentLocale.value] }),
);

// --- language menu ---------------------------------------------------------

const menuOpen = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const triggerEl = ref<HTMLButtonElement | null>(null);
const itemEls = ref<HTMLButtonElement[]>([]);

function setItemEl(el: Element | null, index: number) {
  if (el) itemEls.value[index] = el as HTMLButtonElement;
}

function openMenu() {
  menuOpen.value = true;
  void nextTick(() => {
    const active = locales.indexOf(currentLocale.value);
    itemEls.value[active >= 0 ? active : 0]?.focus();
  });
}

function closeMenu(refocus = true) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (refocus) triggerEl.value?.focus();
}

function toggleMenu() {
  if (menuOpen.value) closeMenu();
  else openMenu();
}

function chooseLocale(locale: SupportedLocale) {
  // localStorage only: nobody is signed in yet, so there is no row to write to.
  // `loadUserLocaleFromDb` seeds the table from whatever is live here the first
  // time this user signs in, so a choice made on this screen does carry over.
  setLocale(locale);
  closeMenu();
}

/** Roving focus, so the menu is usable without a pointer. */
function onMenuKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  const next = (index + delta + locales.length) % locales.length;
  itemEls.value[next]?.focus();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node)) closeMenu(false);
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu();
}

watch(menuOpen, (open) => {
  if (open) {
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
      <div v-if="menuOpen" class="lang-menu" role="menu" :aria-label="t('auth.languageMenu')">
        <button
          v-for="(locale, index) in locales"
          :key="locale"
          :ref="(el) => setItemEl(el as Element | null, index)"
          class="lang-item"
          :class="{ 'lang-item--active': locale === currentLocale }"
          type="button"
          role="menuitemradio"
          :aria-checked="locale === currentLocale"
          @click="chooseLocale(locale)"
          @keydown="onMenuKeydown($event, index)"
        >
          <iconify-icon :icon="getFlagIcon(locale)" class="lang-flag"></iconify-icon>
          <span class="lang-name">{{ LOCALE_ENDONYMS[locale] }}</span>
          <iconify-icon
            v-if="locale === currentLocale"
            icon="ph:check-bold"
            class="lang-check"
          ></iconify-icon>
        </button>
      </div>
    </Transition>

    <button
      ref="triggerEl"
      class="pill-btn pill-btn--flag"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :title="languageLabel"
      :aria-label="languageLabel"
      @click="toggleMenu"
    >
      <iconify-icon :icon="getFlagIcon(currentLocale)" class="flag-icon"></iconify-icon>
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
   a shade larger than the theme icon so the two read as the same weight. */
.flag-icon {
  font-size: 20px;
  border-radius: 999px;
}

.pill-btn--flag[aria-expanded='true'] {
  background: var(--auth-active-fill);
}

.lang-menu {
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

.lang-item {
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

.lang-item:hover {
  background: var(--auth-hover-fill);
  color: var(--auth-text);
}

.lang-item:focus-visible {
  outline: 2px solid var(--auth-focus-ring);
  outline-offset: -2px;
}

.lang-item--active {
  background: var(--auth-active-fill);
  color: var(--auth-text);
}

.lang-flag {
  flex: 0 0 auto;
  font-size: 18px;
  border-radius: 999px;
}

.lang-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lang-check {
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
  .lang-item,
  .menu-pop-enter-active,
  .menu-pop-leave-active {
    transition: none;
  }

  .pill-btn:hover {
    transform: none;
  }
}
</style>
