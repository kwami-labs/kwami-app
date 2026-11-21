<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HudWindow from '../HudWindow.vue';
import { useHudStore, type HudWidget } from '@/stores/hud';
import { escapeHtml, htmlToMarkdown, renderMarkdown, wordCount } from '@/lib/hud/markdown';
import { safeHttpUrl } from '@/lib/hud/media';

/**
 * A document on Jarvis's screen: a report it wrote, notes it took, or one the user
 * started. Read it, edit it as rich text with a toolbar, or edit the Markdown itself;
 * every change is saved as you type. Copy it, download it as Markdown or HTML, or
 * print it to paper or PDF.
 *
 * Markdown is what is stored. The editor's HTML is turned back into Markdown on each
 * change, and pasted HTML goes through the same conversion, so nothing that was not
 * on screen (a script, an event attribute) is ever kept.
 */
const props = defineProps<{ widget: HudWidget; index: number }>();

const { t, d } = useI18n();
const hud = useHudStore();

const doc = computed(() => hud.documentById(props.widget.docId));
type Mode = 'view' | 'edit' | 'source';
const mode = ref<Mode>('view');
/** Shown instead of the names when the window is narrow. */
const MODE_ICONS: Record<Mode, string> = {
  view: 'ph:book-open-text',
  edit: 'ph:pencil-simple-line',
  source: 'ph:code',
};
const editor = ref<HTMLElement | null>(null);
const source = ref('');
const savedAt = ref<number | null>(null);
const saving = ref(false);
const menuOpen = ref(false);
const note = ref('');

const html = computed(() => renderMarkdown(doc.value?.markdown ?? ''));
const words = computed(() => wordCount(doc.value?.markdown ?? ''));
const code = computed(() => `DOC-${String(props.index + 1).padStart(2, '0')}`);

let timer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(read: () => string) {
  saving.value = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (!doc.value) return;
    hud.updateDocument(doc.value.id, { markdown: read() });
    saving.value = false;
    savedAt.value = Date.now();
  }, 500);
}

function flush() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  if (!doc.value) return;
  if (mode.value === 'edit' && editor.value) {
    hud.updateDocument(doc.value.id, { markdown: htmlToMarkdown(editor.value) });
  } else if (mode.value === 'source') {
    hud.updateDocument(doc.value.id, { markdown: source.value });
  }
  saving.value = false;
  savedAt.value = Date.now();
}

async function setMode(next: Mode) {
  flush();
  mode.value = next;
  if (next === 'source') source.value = doc.value?.markdown ?? '';
  await nextTick();
  if (next === 'edit' && editor.value) {
    editor.value.innerHTML = html.value || '<p><br></p>';
    editor.value.focus();
  }
}

function onEditorInput() {
  scheduleSave(() => (editor.value ? htmlToMarkdown(editor.value) : (doc.value?.markdown ?? '')));
}

function onSourceInput() {
  scheduleSave(() => source.value);
}

/** Pasted HTML comes back through Markdown: what can be shown is kept, nothing else. */
function onPaste(e: ClipboardEvent) {
  const data = e.clipboardData;
  if (!data) return;
  e.preventDefault();
  const pastedHtml = data.getData('text/html');
  const inserted = pastedHtml
    ? renderMarkdown(htmlToMarkdown(pastedHtml))
    : escapeHtml(data.getData('text/plain')).replace(/\n/g, '<br>');
  document.execCommand('insertHTML', false, inserted);
}

function exec(command: string, value?: string) {
  editor.value?.focus();
  document.execCommand(command, false, value);
  onEditorInput();
}

function block(tag: string) {
  exec('formatBlock', tag);
}

function link() {
  const raw = window.prompt(t('hud.doc.linkPrompt'), 'https://');
  const href = safeHttpUrl(raw);
  if (href) exec('createLink', href);
}

function onTitle(e: Event) {
  if (!doc.value) return;
  const title = (e.target as HTMLInputElement).value.trim() || t('hud.doc.untitled');
  hud.updateDocument(doc.value.id, { title });
}

function fileName(ext: string): string {
  const base = (doc.value?.title || 'documento')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'documento'}.${ext}`;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.setAttribute('data-hud-external', '');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function standalone(): string {
  const title = escapeHtml(doc.value?.title ?? '');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
body{font:15px/1.6 'Segoe UI',system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111}
h1,h2,h3{line-height:1.25}pre{background:#f4f4f6;padding:12px;overflow:auto}code{font-family:Consolas,monospace}
table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 10px}blockquote{border-left:3px solid #999;margin:0;padding:0 1em;color:#444}
</style></head><body>${html.value}</body></html>`;
}

function exportMarkdown() {
  flush();
  download(fileName('md'), doc.value?.markdown ?? '', 'text/markdown;charset=utf-8');
  menuOpen.value = false;
}

function exportHtml() {
  flush();
  download(fileName('html'), standalone(), 'text/html;charset=utf-8');
  menuOpen.value = false;
}

function print() {
  flush();
  menuOpen.value = false;
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  if (!win) return frame.remove();
  win.document.open();
  win.document.write(standalone());
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

async function copy() {
  flush();
  try {
    await navigator.clipboard.writeText(doc.value?.markdown ?? '');
    note.value = t('hud.doc.copied');
    setTimeout(() => (note.value = ''), 1600);
  } catch {
    // Clipboard blocked.
  }
  menuOpen.value = false;
}

function onKey(e: KeyboardEvent) {
  if (mode.value !== 'edit' || !(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key === 'b' || key === 'i') {
    e.preventDefault();
    exec(key === 'b' ? 'bold' : 'italic');
  } else if (key === 's') {
    e.preventDefault();
    flush();
  }
}

// A new report arriving for this document while it is being read shows at once.
watch(
  () => doc.value?.markdown,
  (markdown) => {
    if (mode.value === 'source' && !timer) source.value = markdown ?? '';
  },
);

onMounted(() => {
  if (!doc.value?.markdown.trim()) void setMode('edit');
});

onBeforeUnmount(flush);
</script>

<template>
  <HudWindow :widget="widget" :code="code" icon="ph:article-ny-times-duotone">
    <template #head>
      <div class="doc-modes" role="tablist">
        <button
          v-for="m in ['view', 'edit', 'source'] as const"
          :key="m"
          type="button"
          role="tab"
          class="mode-btn"
          :class="{ active: mode === m }"
          :aria-selected="mode === m"
          :title="t(`hud.doc.${m}`)"
          @click="setMode(m)"
        >
          <iconify-icon :icon="MODE_ICONS[m]"></iconify-icon>
          <span class="mode-label">{{ t(`hud.doc.${m}`) }}</span>
        </button>
      </div>
    </template>

    <div class="doc" @keydown="onKey">
      <div class="doc-titlebar" :class="{ reading: mode === 'view' }">
        <input
          class="doc-title"
          :value="doc?.title"
          :aria-label="t('hud.doc.titleLabel')"
          :placeholder="t('hud.doc.untitled')"
          @change="onTitle"
        />
        <div class="doc-menu">
          <button type="button" class="hud-icon-btn" :title="t('hud.doc.copy')" @click="copy">
            <iconify-icon icon="ph:copy"></iconify-icon>
          </button>
          <button
            type="button"
            class="hud-icon-btn"
            :class="{ 'is-on': menuOpen }"
            :title="t('hud.doc.exportMd')"
            :aria-expanded="menuOpen"
            @click="menuOpen = !menuOpen"
          >
            <iconify-icon icon="ph:download-simple"></iconify-icon>
          </button>
          <div v-if="menuOpen" class="doc-dropdown" role="menu">
            <button type="button" role="menuitem" @click="exportMarkdown">
              <iconify-icon icon="ph:markdown-logo"></iconify-icon>{{ t('hud.doc.exportMd') }}
            </button>
            <button type="button" role="menuitem" @click="exportHtml">
              <iconify-icon icon="ph:file-html"></iconify-icon>{{ t('hud.doc.exportHtml') }}
            </button>
            <button type="button" role="menuitem" @click="print">
              <iconify-icon icon="ph:printer"></iconify-icon>{{ t('hud.doc.print') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="mode === 'edit'" class="hud-toolbar">
        <button type="button" class="hud-icon-btn" :title="t('hud.doc.undo')" @click="exec('undo')">
          <iconify-icon icon="ph:arrow-u-up-left"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.doc.redo')" @click="exec('redo')">
          <iconify-icon icon="ph:arrow-u-up-right"></iconify-icon>
        </button>
        <span class="hud-sep"></span>
        <button
          type="button"
          class="hud-icon-btn txt"
          :title="t('hud.doc.h1')"
          @click="block('H1')"
        >
          H1
        </button>
        <button
          type="button"
          class="hud-icon-btn txt"
          :title="t('hud.doc.h2')"
          @click="block('H2')"
        >
          H2
        </button>
        <button
          type="button"
          class="hud-icon-btn txt"
          :title="t('hud.doc.h3')"
          @click="block('H3')"
        >
          H3
        </button>
        <span class="hud-sep"></span>
        <button type="button" class="hud-icon-btn" :title="t('hud.doc.bold')" @click="exec('bold')">
          <iconify-icon icon="ph:text-b-bold"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.italic')"
          @click="exec('italic')"
        >
          <iconify-icon icon="ph:text-italic"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.strike')"
          @click="exec('strikeThrough')"
        >
          <iconify-icon icon="ph:text-strikethrough"></iconify-icon>
        </button>
        <span class="hud-sep"></span>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.bullets')"
          @click="exec('insertUnorderedList')"
        >
          <iconify-icon icon="ph:list-bullets"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.numbers')"
          @click="exec('insertOrderedList')"
        >
          <iconify-icon icon="ph:list-numbers"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.quote')"
          @click="block('BLOCKQUOTE')"
        >
          <iconify-icon icon="ph:quotes"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.doc.code')" @click="block('PRE')">
          <iconify-icon icon="ph:code"></iconify-icon>
        </button>
        <button type="button" class="hud-icon-btn" :title="t('hud.doc.link')" @click="link">
          <iconify-icon icon="ph:link"></iconify-icon>
        </button>
        <button
          type="button"
          class="hud-icon-btn"
          :title="t('hud.doc.rule')"
          @click="exec('insertHorizontalRule')"
        >
          <iconify-icon icon="ph:minus"></iconify-icon>
        </button>
      </div>

      <!-- eslint-disable vue/no-v-html -- renderMarkdown escapes everything it is given -->
      <article
        v-if="mode === 'view'"
        class="doc-page hud-prose hud-scroll"
        @dblclick="setMode('edit')"
        v-html="html"
      ></article>
      <!-- eslint-enable vue/no-v-html -->
      <div
        v-else-if="mode === 'edit'"
        ref="editor"
        class="doc-page hud-prose hud-scroll editing"
        contenteditable="true"
        spellcheck="true"
        :data-placeholder="t('hud.doc.placeholder')"
        @input="onEditorInput"
        @paste="onPaste"
      ></div>
      <textarea
        v-else
        v-model="source"
        class="doc-page doc-source hud-scroll"
        spellcheck="false"
        @input="onSourceInput"
      ></textarea>
    </div>

    <template #footer>
      <span>{{ t('hud.doc.words', { n: words }) }}</span>
      <span v-if="doc?.taskId" class="from-task">· {{ t('hud.doc.fromTask') }}</span>
      <span class="spacer"></span>
      <span v-if="note">{{ note }}</span>
      <span v-else-if="saving">{{ t('hud.doc.saving') }}</span>
      <span v-else-if="savedAt || doc">
        {{ t('hud.doc.saved') }} ·
        {{
          d(new Date(savedAt ?? doc?.updatedAt ?? Date.now()), {
            hour: '2-digit',
            minute: '2-digit',
          })
        }}
      </span>
    </template>
  </HudWindow>
</template>

<style scoped>
.doc {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.doc-modes {
  display: flex;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--hud-line-soft);
}
.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border: 0;
  background: transparent;
  font-family: var(--hud-font);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--hud-dim);
  cursor: pointer;
}
.mode-btn.active {
  background: rgba(var(--hud-rgb), 0.18);
  color: var(--hud-text);
  box-shadow: inset 0 -2px 0 var(--hud-accent);
}
.mode-btn iconify-icon {
  display: none;
  font-size: 14px;
}
/* In a narrow window the modes keep their icons and drop their names (still in the tooltip). */
@container hud-win (max-width: 520px) {
  .mode-btn {
    padding: 3px 7px;
  }
  .mode-btn iconify-icon {
    display: inline-block;
  }
  .mode-label {
    display: none;
  }
}

.doc-titlebar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 6px 18px;
}
.doc-title {
  flex: 1;
  min-width: 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: #fff;
  font-family: var(--hud-font);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  outline: none;
}
.doc-title:focus {
  border-bottom-color: var(--hud-line);
}
/* Reading, the document's own first heading names it: the field shrinks to a label. */
.doc-titlebar.reading .doc-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--hud-faint);
}

.doc-menu {
  position: relative;
  display: flex;
  gap: 2px;
}
.doc-dropdown {
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 230px;
  padding: 4px;
  border: 1px solid var(--hud-line);
  background: var(--hud-fill-strong);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}
.doc-dropdown button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 13px;
  cursor: pointer;
}
.doc-dropdown button:hover {
  background: rgba(var(--hud-rgb), 0.14);
}

.hud-icon-btn.txt {
  font-family: var(--hud-font);
  font-weight: 700;
  font-size: 12.5px;
}

.doc-page {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 8px 22px 22px 20px;
  outline: none;
}
.doc-page.editing {
  caret-color: var(--hud-accent);
  background: rgba(0, 0, 0, 0.18);
  box-shadow: inset 0 0 0 1px var(--hud-line-faint);
  margin: 6px 10px 10px;
  padding: 12px 16px;
}
.doc-page.editing:empty::before {
  content: attr(data-placeholder);
  color: var(--hud-faint);
}

.doc-source {
  margin: 6px 10px 10px;
  padding: 12px 14px;
  resize: none;
  border: 1px solid var(--hud-line-faint);
  background: rgba(0, 0, 0, 0.35);
  color: var(--hud-text);
  font-family: var(--hud-mono);
  font-size: 12.5px;
  line-height: 1.6;
}

.from-task {
  color: var(--hud-accent);
}
.spacer {
  flex: 1;
}
</style>
