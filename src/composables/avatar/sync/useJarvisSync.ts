import { watch as vueWatch, type Ref } from 'vue';
import type { JarvisHandle } from './rendererTypes';
import { useJarvisStore } from '@/stores/avatar.jarvis';

type KwamiInstance = ReturnType<typeof import('@/composables/useKwami').useKwami>['kwami']['value'];

export interface UseJarvisSyncOptions {
  /** See `UseEyeIrisSyncOptions.registerWatchers`. */
  registerWatchers?: boolean;
  kwami: Ref<KwamiInstance>;
  getJarvis: () => JarvisHandle | undefined;
}

export function useJarvisSync(options: UseJarvisSyncOptions) {
  const { registerWatchers = true, getJarvis } = options;
  const watch: typeof vueWatch = registerWatchers
    ? vueWatch
    : ((() => () => {}) as unknown as typeof vueWatch);

  const jarvisStore = useJarvisStore();
  const state = jarvisStore.state;

  watch(
    () => state.color,
    (v) => getJarvis()?.setColors(v),
    { deep: true },
  );
  watch(
    () => state.intensity,
    (v) => getJarvis()?.setIntensity(v),
  );
  watch(
    () => state.reactivity,
    (v) => getJarvis()?.setReactivity(v),
  );
  watch(
    () => state.rotationSpeed,
    (v) => getJarvis()?.setRotationSpeed(v),
  );
  watch(
    () => state.parallax,
    (v) => getJarvis()?.setParallax(v),
  );
  watch(
    () => state.quality,
    (v) => getJarvis()?.setQuality(v),
  );
  watch(
    () => state.backdrop,
    (v) => getJarvis()?.setBackdrop(v),
  );
  watch(
    () => state.labels,
    (v) => getJarvis()?.setLabels(v),
  );
  watch(
    () => state.title,
    (v) => getJarvis()?.setTitle(v),
  );
  watch(
    () => state.scale,
    (v) => getJarvis()?.setScale(v),
  );

  function syncFromKwami(): void {
    const renderer = getJarvis();
    if (!renderer) return;
    jarvisStore.syncFromKwami(renderer);
  }

  function applyToKwami(): void {
    const renderer = getJarvis();
    if (!renderer) return;
    renderer.setColors(state.color);
    renderer.setIntensity(state.intensity);
    renderer.setReactivity(state.reactivity);
    renderer.setRotationSpeed(state.rotationSpeed);
    renderer.setParallax(state.parallax);
    renderer.setQuality(state.quality);
    renderer.setBackdrop(state.backdrop);
    renderer.setLabels(state.labels);
    renderer.setTitle(state.title);
    renderer.setScale(state.scale);
  }

  return { syncFromKwami, applyToKwami };
}
