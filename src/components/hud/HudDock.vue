<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useHudStore, type HudKind, type HudPrefs } from '@/stores/hud';

/**
 * The bar along the bottom of the HUD: every window folded away, the archive of
 * saved documents, and the HUD's own settings. Menus here float over everything, so
 * while one is open the native web views step aside (`hideNative`).
 */
const { t, d } = useI18n();
const hud = useHudStore();

const ICONS: Record<HudKind, string> = {
  task: 'ph:brain-duotone',
  document: 'ph:article-ny-times-duotone',
  video: 'ph:film-strip-duotone',
  web: 'ph:globe-hemisphere-west-duotone',
  image: 'ph:image-duotone',
  browser: 'ph:browser-duotone',
  tool: 'ph:plugs-connected-duotone',
};

const menu = ref<'archive' | 'settings' | null>(null);
watch(menu, (now, before) => {
  if (now && !before) hud.hideNative(true);
  if (!now && before) hud.hideNative(false);
});
onBeforeUnmount(() => {
  if (menu.value) hud.hideNative(false);
});

function toggle(which: 'archive' | 'settings') {
  menu.value = menu.value === which ? null : which;
}

const PREF_KEYS: Exclude<keyof HudPrefs, 'enabled' | 'glass'>[] = [
  'autoArrange',
  'moveAside',
  'tasks',
  'reports',
  'browser',
  'links',
  'actionLog',
  'tethers',
];

function newDocument() {
  const doc = hud.createDocument(t('hud.doc.untitled'), '');
  hud.openDocument(doc, 'user');
  menu.value = null;
}

function openDoc(id: string) {
  const doc = hud.documentById(id);
  if (doc) hud.openDocument(doc, 'user');
  menu.value = null;
}

const anything = computed(() => hud.widgets.length > 0);

// -- screens --------------------------------------------------------------------------

function screenLabel(index: number): string {
  return hud.screens[index]?.name || t('hud.screens.default', { n: index + 1 });
}

const editing = ref<string | null>(null);
const draft = ref('');
const editor = ref<HTMLInputElement[] | null>(null);

async function startRename(id: string, index: number) {
  editing.value = id;
  draft.value = screenLabel(index);
  await nextTick();
  editor.value?.[0]?.select();
}

function finishRename(save: boolean) {
  if (save && editing.value) hud.renameScreen(editing.value, draft.value);
  editing.value = null;
}

function addScreen() {
  const screen = hud.addScreen();
  if (screen) void startRename(screen.id, hud.screens.length - 1);
}

/** Centred on the free band and never wider than it: clear of the sidebar and its panel. */
const position = computed(() => {
  const { width, left = 0, right = 0 } = hud.viewport;
  const band = Math.max(0, width - left - right);
  return { left: `${left + band / 2}px`, maxWidth: `${Math.max(0, band - 32)}px` };
});
</script>

<template>
  <nav class="dock" :style="position" :aria-label="t('hud.dock.archive')">
    <div class="dock-screens" role="tablist" :aria-label="t('hud.screens.title')">
      <div
        v-for="(screen, i) in hud.screens"
        :key="screen.id"
        class="screen-tab"
        :class="{ active: screen.id === hud.activeScreen }"
        role="tab"
        :aria-selected="screen.id === hud.activeScreen"
        :title="`${screenLabel(i)} · Ctrl+Alt+${i + 1}`"
        @click="hud.switchScreen(screen.id)"
        @dblclick="startRename(screen.id, i)"
      >
        <span class="screen-n">{{ i + 1 }}</span>
        <input
          v-if="editing === screen.id"
          ref="editor"
          v-model="draft"
          class="screen-input"
          :aria-label="t('hud.screens.rename')"
          @click.stop
          @keydown.enter.prevent="finishRename(true)"
          @keydown.esc.prevent="finishRename(false)"
          @blur="finishRename(true)"
        />
        <span v-else class="screen-name">{{ screenLabel(i) }}</span>
        <i v-if="hud.windowsOn(screen.id)" class="screen-count">{{ hud.windowsOn(screen.id) }}</i>
        <button
          v-if="hud.screens.length > 1"
          type="button"
          class="screen-close"
          :title="t('hud.screens.remove')"
          @click.stop="hud.removeScreen(screen.id)"
        >
          <iconify-icon icon="ph:x"></iconify-icon>
        </button>
      </div>
      <button
        type="button"
        class="screen-add"
        :title="`${t('hud.screens.new')} · Ctrl+Alt+N`"
        @click="addScreen"
      >
        <iconify-icon icon="ph:plus"></iconify-icon>
      </button>
    </div>

    <TransitionGroup name="chip" tag="div" class="dock-chips">
      <button
        v-for="w in hud.docked"
        :key="w.id"
        type="button"
        class="dock-chip"
        :class="w.kind"
        :title="w.title"
        @click="hud.restore(w.id)"
      >
        <iconify-icon :icon="ICONS[w.kind]"></iconify-icon>
        <span class="chip-title">{{ w.title }}</span>
      </button>
    </TransitionGroup>

    <div class="dock-tools">
      <button
        type="button"
        class="dock-btn"
        :class="{ active: hud.editing }"
        :disabled="!hud.editing && !hud.visible.length"
        :aria-pressed="hud.editing"
        :title="hud.editing ? t('hud.dock.editDone') : `${t('hud.dock.edit')} · Ctrl+Alt+E`"
        @click="hud.setEditing(!hud.editing)"
      >
        <iconify-icon
          :icon="hud.editing ? 'ph:check-bold' : 'ph:pencil-ruler-duotone'"
        ></iconify-icon>
        <span v-if="hud.editing">{{ t('hud.dock.editDoneShort') }}</span>
      </button>
      <button
        type="button"
        class="dock-btn"
        :class="{ active: hud.tiled }"
        :disabled="!hud.tiled && hud.visible.length < 2"
        :aria-pressed="hud.tiled"
        :title="hud.tiled ? t('hud.dock.untile') : `${t('hud.dock.organize')} · Ctrl+Alt+O`"
        @click="hud.tiled ? hud.leaveGrid(hud.activeScreen, true) : hud.organize()"
      >
        <iconify-icon icon="ph:squares-four-duotone"></iconify-icon>
      </button>
      <button
        type="button"
        class="dock-btn"
        :class="{ active: menu === 'archive' }"
        :title="t('hud.dock.documents')"
        :aria-expanded="menu === 'archive'"
        @click="toggle('archive')"
      >
        <iconify-icon icon="ph:archive-duotone"></iconify-icon>
        <span>{{ t('hud.dock.archive') }}</span>
        <i v-if="hud.documents.length">{{ hud.documents.length }}</i>
      </button>
      <button
        type="button"
        class="dock-btn"
        :class="{ active: menu === 'settings' }"
        :title="t('hud.dock.settings')"
        :aria-expanded="menu === 'settings'"
        @click="toggle('settings')"
      >
        <iconify-icon icon="ph:sliders-horizontal-duotone"></iconify-icon>
      </button>
      <button
        type="button"
        class="dock-btn"
        :disabled="!anything"
        :title="t('hud.dock.closeAll')"
        @click="hud.closeAll()"
      >
        <iconify-icon icon="ph:x-square-duotone"></iconify-icon>
      </button>
    </div>

    <div v-if="menu === 'archive'" class="dock-menu archive" role="menu">
      <header>
        <span class="hud-label">{{ t('hud.dock.documents') }}</span>
        <button type="button" class="hud-action-btn" @click="newDocument">
          <iconify-icon icon="ph:plus"></iconify-icon>{{ t('hud.dock.newDocument') }}
        </button>
      </header>
      <p v-if="!hud.documents.length" class="menu-empty">{{ t('hud.dock.noDocuments') }}</p>
      <ul v-else class="hud-scroll">
        <li v-for="doc in hud.documents" :key="doc.id">
          <button type="button" class="doc-row" role="menuitem" @click="openDoc(doc.id)">
            <iconify-icon
              :icon="doc.taskId ? 'ph:brain-duotone' : 'ph:article-duotone'"
            ></iconify-icon>
            <span class="doc-name">{{ doc.title }}</span>
            <span class="doc-date">{{
              d(new Date(doc.updatedAt), {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}</span>
          </button>
          <button
            type="button"
            class="hud-icon-btn danger"
            :title="t('hud.dock.delete')"
            @click="hud.deleteDocument(doc.id)"
          >
            <iconify-icon icon="ph:trash"></iconify-icon>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="menu === 'settings'" class="dock-menu settings" role="menu">
      <span class="hud-label">{{ t('hud.prefs.title') }}</span>
      <label class="pref">
        <input
          type="checkbox"
          :checked="hud.prefs.enabled"
          @change="hud.setPref('enabled', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t('hud.prefs.enabled') }}</span>
      </label>
      <label v-for="key in PREF_KEYS" :key="key" class="pref" :class="{ off: !hud.prefs.enabled }">
        <input
          type="checkbox"
          :checked="hud.prefs[key]"
          :disabled="!hud.prefs.enabled"
          @change="hud.setPref(key, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t(`hud.prefs.${key}`) }}</span>
      </label>
      <label class="pref glass" :class="{ off: !hud.prefs.enabled }">
        <span>{{ t('hud.prefs.glass') }}</span>
        <input
          type="range"
          min="0.4"
          max="1"
          step="0.02"
          :value="hud.prefs.glass"
          :disabled="!hud.prefs.enabled"
          @input="hud.setPref('glass', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <p class="pref-hint">{{ t('hud.prefs.arrangeHint') }}</p>
    </div>
  </nav>
</template>

<style scoped>
.dock {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 32px);
  pointer-events: auto;
  z-index: 900;
}

.dock-screens {
  display: flex;
  flex-shrink: 0;
  max-width: 40%;
  overflow-x: auto;
  scrollbar-width: none;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--hud-line-soft);
  background: var(--hud-fill);
  backdrop-filter: blur(10px);
}
.screen-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 170px;
  padding: 5px 6px 5px 8px;
  color: var(--hud-dim);
  font-family: var(--hud-font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.screen-tab:hover {
  color: var(--hud-text);
  background: rgba(var(--hud-rgb), 0.08);
}
.screen-tab.active {
  color: var(--hud-text);
  background: rgba(var(--hud-rgb), 0.18);
  box-shadow: inset 0 -2px 0 var(--hud-accent);
}
.screen-n {
  font-family: var(--hud-mono);
  font-size: 10px;
  color: var(--hud-accent);
}
.screen-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.screen-input {
  width: 100px;
  padding: 1px 4px;
  border: 1px solid var(--hud-line);
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font: inherit;
  outline: none;
}
.screen-count {
  font-style: normal;
  font-family: var(--hud-mono);
  font-size: 9.5px;
  color: var(--hud-faint);
}
.screen-close {
  display: inline-flex;
  padding: 1px;
  border: 0;
  background: none;
  color: var(--hud-faint);
  cursor: pointer;
  opacity: 0;
}
.screen-tab:hover .screen-close {
  opacity: 1;
}
.screen-close:hover {
  color: var(--hud-red);
}
.screen-add {
  display: inline-flex;
  padding: 5px 7px;
  border: 0;
  background: none;
  color: var(--hud-dim);
  cursor: pointer;
}
.screen-add:hover {
  color: var(--hud-text);
  background: rgba(var(--hud-rgb), 0.12);
}

.dock-chips {
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.dock-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 190px;
  padding: 7px 12px 7px 10px;
  border: 1px solid var(--hud-line-soft);
  background: var(--hud-fill);
  backdrop-filter: blur(10px);
  cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition:
    border-color 0.15s,
    background 0.15s;
}
.dock-chip:hover {
  border-color: var(--hud-line);
  background: rgba(var(--hud-rgb), 0.14);
}
.dock-chip iconify-icon {
  font-size: 16px;
  color: var(--hud-accent);
  flex-shrink: 0;
}
.chip-title {
  font-family: var(--hud-font);
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dock-tools {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--hud-line-soft);
  background: var(--hud-fill);
  backdrop-filter: blur(10px);
}
.dock-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: var(--hud-dim);
  font-family: var(--hud-font);
  font-weight: 600;
  font-size: 12.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.dock-btn iconify-icon {
  font-size: 17px;
}
.dock-btn:hover,
.dock-btn.active {
  color: var(--hud-text);
  background: rgba(var(--hud-rgb), 0.14);
}
.dock-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.dock-btn i {
  font-style: normal;
  font-family: var(--hud-mono);
  font-size: 10px;
  color: var(--hud-accent);
}

.dock-menu {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  width: 360px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--hud-line);
  background: var(--hud-fill-strong);
  box-shadow:
    0 0 24px rgba(var(--hud-rgb), 0.15),
    0 20px 40px rgba(0, 0, 0, 0.6);
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
  animation: menu-in 0.18s ease-out;
}
@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
.dock-menu header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dock-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 46vh;
}
.dock-menu li {
  display: flex;
  align-items: center;
}
.doc-row {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 7px 6px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.doc-row:hover {
  background: rgba(var(--hud-rgb), 0.1);
}
.doc-row iconify-icon {
  color: var(--hud-accent);
}
.doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.doc-date {
  font-family: var(--hud-mono);
  font-size: 10px;
  color: var(--hud-faint);
}
.menu-empty {
  margin: 4px 0;
  font-size: 12.5px;
  color: var(--hud-faint);
}

.dock-menu.settings {
  width: 300px;
}
.pref {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  cursor: pointer;
}
.pref input {
  accent-color: var(--hud-accent);
}
.pref.off {
  opacity: 0.45;
}
.pref.glass {
  justify-content: space-between;
}
.pref.glass input {
  width: 130px;
}
.pref-hint {
  margin: 4px 0 0;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--hud-faint);
}

.chip-enter-active,
.chip-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
</style>
