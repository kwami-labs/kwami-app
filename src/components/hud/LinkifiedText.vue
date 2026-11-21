<script setup lang="ts">
import { computed } from 'vue';

/**
 * Plain text with its web addresses made clickable. The links are ordinary anchors:
 * the HUD's click handler (`useHud`) opens them on Jarvis's screen, and Ctrl-click in
 * the system browser. No HTML is built from the text, so nothing in it can run.
 */
const props = defineProps<{ text: string }>();

const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"»”]/g;

const parts = computed(() => {
  const out: { link: boolean; value: string }[] = [];
  let last = 0;
  for (const match of props.text.matchAll(URL_RE)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ link: false, value: props.text.slice(last, at) });
    out.push({ link: true, value: match[0] });
    last = at + match[0].length;
  }
  if (last < props.text.length) out.push({ link: false, value: props.text.slice(last) });
  return out;
});
</script>

<template>
  <template v-for="(part, i) in parts" :key="i"
    ><a
      v-if="part.link"
      :href="part.value"
      class="inline-link"
      target="_blank"
      rel="noopener noreferrer"
      >{{ part.value }}</a
    ><template v-else>{{ part.value }}</template></template
  >
</template>

<style scoped>
.inline-link {
  color: var(--accent-primary);
  text-decoration: none;
  border-bottom: 1px dashed rgba(var(--accent-primary-rgb), 0.5);
  word-break: break-all;
}
.inline-link:hover {
  border-bottom-style: solid;
}
</style>
