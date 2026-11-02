<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import type { Voice } from '@/composables/useVoicesApi';
import { useVoicesApi } from '@/composables/useVoicesApi';
import { useKwami } from '@/composables/useKwami';
import { useVoicePreview } from '@/composables/useVoicePreview';
import { useVoiceStore } from '@/stores/voice';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { getFlagIcon } from '@/constants/language-flags';
import { GEMINI_CHARACTER_ES, catalogProvider, voiceLabel } from '@/lib/voicePersonas';
import {
  canHear,
  favoriteKey,
  inPickingOrder,
  languagesOf,
  matchesLanguage,
  matchesSearch,
  modelVoiceKey,
  speaksAnyLanguage,
  ttsVoicePatch,
  voicesForModel,
  withCharacterVoices,
  type PickableVoice,
  type VoiceKind,
} from '@/lib/voiceChoice';

/**
 * Every voice the selected model can speak with, to choose the one that suits it.
 * Each model keeps its own (`modelsUI.voiceByModel`). A character's direction does not
 * stop this: it keeps the agent from changing voice by itself, not the user.
 */
const props = defineProps<{ kind: VoiceKind }>();
const { t, locale } = useI18n();
const voiceStore = useVoiceStore();
const { tts, realtime, stt, modelsUI } = storeToRefs(voiceStore);
const { kwami, isConnected } = useKwami();
const { fetchTTSVoicesByProvider, fetchRealtimeVoicesByProvider } = useVoicesApi();

const PAGE = 40;

const config = computed(() => (props.kind === 'tts' ? tts.value : realtime.value));
const provider = computed(() => config.value.provider as string);
const model = computed(() => config.value.model as string);
const current = computed(() => (config.value.voice as string | undefined) ?? '');

const voices = ref<Voice[]>([]);
const live = ref(false);
const loading = ref(false);
const failed = ref(false);

const search = ref('');
const gender = ref<'all' | 'male' | 'female' | 'favorites'>('all');
const language = ref('all');
const shown = ref(PAGE);
const customId = ref('');

/** Set while a newer provider's list is on its way: an older answer is dropped. */
let asked = 0;
async function load() {
  const ticket = ++asked;
  loading.value = true;
  failed.value = false;
  // Gemini TTS speaks with the same voices as Gemini Live.
  const wanted = provider.value;
  const result =
    props.kind === 'realtime' || wanted === 'gemini'
      ? await fetchRealtimeVoicesByProvider(catalogProvider(wanted))
      : await fetchTTSVoicesByProvider(wanted);
  if (ticket !== asked) return;
  voices.value = result?.voices ?? [];
  live.value = result?.source === 'live';
  failed.value = result === null || result === undefined;
  loading.value = false;
  language.value = sessionLanguage();
}

const anyLanguage = computed(() => props.kind === 'realtime' || speaksAnyLanguage(provider.value));

/** The call's own language, when this provider has voices of it. */
function sessionLanguage(): string {
  const base = (stt.value.language ?? '').split('-')[0].toLowerCase();
  if (!base || anyLanguage.value) return 'all';
  return languagesOf(voices.value).includes(base) ? base : 'all';
}

watch(provider, load, { immediate: true });
watch([search, gender, language, model], () => {
  shown.value = PAGE;
});

const forModel = computed<PickableVoice[]>(() =>
  voicesForModel(
    provider.value,
    model.value,
    withCharacterVoices(props.kind, provider.value, voices.value, live.value),
  ),
);
const languages = computed(() => (anyLanguage.value ? [] : languagesOf(forModel.value)));
const languageOptions = computed(() => [
  { value: 'all', label: t('voicePicker.allLanguages') },
  ...languages.value.map((code) => ({ value: code, label: code, icon: getFlagIcon(code) })),
]);

function isFavorite(id: string): boolean {
  return modelsUI.value.favoriteVoices.includes(favoriteKey(provider.value, id));
}
function toggleFavorite(id: string) {
  const key = favoriteKey(provider.value, id);
  const list = modelsUI.value.favoriteVoices;
  modelsUI.value.favoriteVoices = list.includes(key)
    ? list.filter((k) => k !== key)
    : [...list, key];
}

const matching = computed(() =>
  inPickingOrder(
    forModel.value.filter(
      (v) =>
        (gender.value === 'all' ||
          v.gender === gender.value ||
          (gender.value === 'favorites' && isFavorite(v.id))) &&
        matchesLanguage(v, language.value) &&
        matchesSearch(v, search.value),
    ),
    current.value,
    isFavorite,
  ),
);
const visible = computed(() => matching.value.slice(0, shown.value));

const currentName = computed(() => {
  if (!current.value) return t('voicePicker.noneChosen');
  return forModel.value.find((v) => v.id === current.value)?.name ?? voiceLabel(current.value);
});

function clearFilters() {
  search.value = '';
  gender.value = 'all';
  language.value = 'all';
}

function describe(voice: PickableVoice): string {
  const text = voice.description ?? '';
  return locale.value.startsWith('es') ? (GEMINI_CHARACTER_ES[text] ?? text) : text;
}

function choose(voice: string) {
  const instance = isConnected.value ? kwami.value : null;
  if (props.kind === 'tts') {
    const patch = ttsVoicePatch(provider.value, model.value, voice);
    modelsUI.value.voiceByModel[modelVoiceKey('tts', provider.value, patch.model)] = voice;
    voiceStore.updateTTS(patch);
    instance?.agent.updateTtsLive({ ...patch, provider: provider.value, speed: tts.value.speed });
  } else {
    modelsUI.value.voiceByModel[modelVoiceKey('realtime', provider.value, model.value)] = voice;
    voiceStore.updateRealtime({ voice });
    instance?.agent.updateRealtimeLive({ voice });
  }
}

function useCustomId() {
  const id = customId.value.trim();
  if (!id) return;
  choose(id);
  customId.value = '';
}

const preview = useVoicePreview();
watch(provider, preview.stop);
function playIcon(id: string): string {
  if (preview.waiting.value === id) return 'ph:circle-notch';
  return preview.playing.value === id ? 'ph:stop-fill' : 'ph:play-fill';
}
</script>

<template>
  <section class="picker">
    <header class="head">
      <span class="title"
        ><iconify-icon icon="ph:user-sound-duotone" /> {{ t('voicePicker.title') }}</span
      >
      <span class="model">{{ provider }} · {{ model }}</span>
      <span class="in-use">{{ t('voicePicker.inUse', { name: currentName }) }}</span>
    </header>

    <input
      v-model="search"
      class="search"
      type="search"
      :aria-label="t('voicePicker.search')"
      :placeholder="t('voicePicker.search')"
    />
    <div class="filters">
      <div class="segments" role="group">
        <button
          v-for="g in ['all', 'male', 'female', 'favorites'] as const"
          :key="g"
          class="segment"
          :class="{ active: gender === g }"
          :aria-pressed="gender === g"
          @click="gender = g"
        >
          {{ t(`voicePicker.${g}`) }}
        </button>
      </div>
      <BaseSelect v-if="languages.length > 1" v-model="language" :options="languageOptions" block />
      <p v-else-if="anyLanguage" class="hint">{{ t('voicePicker.speaksAnyLanguage') }}</p>
    </div>

    <p v-if="loading" class="hint">{{ t('voicePicker.loading') }}</p>
    <div v-else-if="failed" class="none">
      <p class="hint warn">{{ t('voicePicker.failed') }}</p>
      <button class="link" @click="load">{{ t('voicePicker.retry') }}</button>
    </div>
    <p v-else-if="!forModel.length" class="hint">{{ t('voicePicker.noCatalog') }}</p>
    <div v-else-if="!matching.length" class="none">
      <p class="hint">{{ t('voicePicker.empty') }}</p>
      <button class="link" @click="clearFilters">{{ t('voicePicker.clearFilters') }}</button>
    </div>

    <ul v-if="visible.length" class="voices">
      <li v-for="voice in visible" :key="voice.id" class="row">
        <button
          class="voice"
          :class="{ chosen: voice.id === current }"
          :aria-pressed="voice.id === current"
          @click="choose(voice.id)"
        >
          <span class="line">
            <span class="name">{{ voice.name }}</span>
            <span
              v-if="voice.character"
              class="tag character"
              :title="voice.suggested ? t('voicePicker.suggested', { name: voice.character }) : ''"
              >{{ voice.character }}<template v-if="voice.suggested"> ★</template></span
            >
            <iconify-icon
              v-if="voice.gender === 'male' || voice.gender === 'female'"
              class="gender"
              :icon="voice.gender === 'male' ? 'ph:gender-male' : 'ph:gender-female'"
            />
            <span v-if="voice.language && voice.language !== 'multilingual'" class="tag">{{
              voice.language
            }}</span>
            <iconify-icon
              v-if="voice.id === current"
              class="check"
              icon="ph:check-circle-duotone"
            />
          </span>
          <span v-if="voice.description" class="description">{{ describe(voice) }}</span>
        </button>
        <div class="side">
          <button
            v-if="canHear(provider, voice)"
            class="play"
            :class="{ spinning: preview.waiting.value === voice.id }"
            :aria-label="t('voicePicker.listen', { voice: voice.name })"
            :title="t('voicePicker.listen', { voice: voice.name })"
            @click="preview.toggle(provider, voice, locale)"
          >
            <iconify-icon :icon="playIcon(voice.id)" />
          </button>
          <button
            class="star"
            :class="{ on: isFavorite(voice.id) }"
            :aria-pressed="isFavorite(voice.id)"
            :aria-label="t('voicePicker.favorite', { voice: voice.name })"
            :title="t('voicePicker.favorite', { voice: voice.name })"
            @click="toggleFavorite(voice.id)"
          >
            <iconify-icon :icon="isFavorite(voice.id) ? 'ph:star-fill' : 'ph:star'" />
          </button>
        </div>
        <p v-if="preview.problem.value?.voice === voice.id" class="hint warn problem">
          {{
            t(`voicePicker.${preview.problem.value.kind === 'noKey' ? 'noSampleKey' : 'noSample'}`)
          }}
        </p>
      </li>
    </ul>

    <div v-if="matching.length" class="foot">
      <span class="hint">{{
        t('voicePicker.count', { shown: visible.length, total: matching.length })
      }}</span>
      <button v-if="visible.length < matching.length" class="link" @click="shown += PAGE">
        {{ t('voicePicker.showMore') }}
      </button>
    </div>

    <details class="custom">
      <summary>{{ t('voicePicker.customId') }}</summary>
      <div class="custom-row">
        <input
          v-model="customId"
          class="search mono"
          :aria-label="t('voicePicker.customPlaceholder')"
          :placeholder="t('voicePicker.customPlaceholder')"
          spellcheck="false"
          @keydown.enter="useCustomId"
        />
        <BaseButton size="sm" :disabled="!customId.trim()" @click="useCustomId">{{
          t('voicePicker.use')
        }}</BaseButton>
      </div>
    </details>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  border: 1px solid var(--glass-border);
}
.head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.model {
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.in-use {
  font-size: 11px;
  color: var(--accent-primary);
  overflow-wrap: anywhere;
}
.search {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--surface-2);
  border: 1px solid var(--surface-2);
  border-radius: 6px;
}
.search.mono {
  font-family: var(--font-mono, monospace);
}
.filters {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.segments {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--surface-2);
}
.segment {
  flex: 1 1 0;
  min-width: 0;
  padding: 5px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
}
.segment.active {
  background: var(--accent-primary);
  color: white;
}
.hint {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-tertiary);
}
.hint.warn {
  color: #fbbf24;
}
.none {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.voices {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 4px;
}
.problem {
  flex-basis: 100%;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  width: 28px;
}
.voice {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  text-align: left;
  border-radius: 6px;
  border: 1px solid transparent;
  background: var(--surface-2);
  color: var(--text-primary);
  cursor: pointer;
}
.voice.chosen {
  border-color: var(--accent-primary);
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.name {
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.tag {
  padding: 0 5px;
  border-radius: 999px;
  font-size: 9px;
  background: var(--surface-1);
  color: var(--text-secondary);
}
.tag.character {
  color: var(--accent-primary);
}
.gender {
  font-size: 11px;
  color: var(--text-tertiary);
}
.check {
  margin-left: auto;
  font-size: 14px;
  color: var(--accent-primary);
}
.description {
  font-size: 10px;
  line-height: 1.35;
  color: var(--text-tertiary);
}
.play,
.star {
  flex: 1;
  min-height: 24px;
  border: none;
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
}
.star.on {
  color: #fbbf24;
}
.spinning iconify-icon {
  animation: picker-spin 1s linear infinite;
}
@keyframes picker-spin {
  to {
    transform: rotate(360deg);
  }
}
.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.link {
  padding: 0;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--accent-primary);
  cursor: pointer;
  white-space: nowrap;
}
.custom summary {
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}
.custom-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
</style>
