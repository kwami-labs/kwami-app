import { watch as vueWatch, type Ref } from 'vue';
import type { EyeIrisHandle } from './rendererTypes';
import { useEyeIrisStore } from '@/stores/avatar.eye-iris';

type KwamiInstance = ReturnType<typeof import('@/composables/useKwami').useKwami>['kwami']['value'];

export interface UseEyeIrisSyncOptions {
  /**
   * Register the reactive store -> renderer watchers. Defaults to true.
   *
   * Pass false when the caller only needs syncFromKwami/applyToKwami; App.vue
   * already owns the always-on watcher set, and AvatarPanel instantiating them
   * again doubled every setter call while the panel was open.
   */
  registerWatchers?: boolean;
  kwami: Ref<KwamiInstance>;
  getEyeIris: () => EyeIrisHandle | undefined;
}

export function useEyeIrisSync(options: UseEyeIrisSyncOptions) {
  const { registerWatchers = true } = options;
  // A no-op stand-in keeps the ~25 watch() call sites below unchanged.
  const watch: typeof vueWatch = registerWatchers
    ? vueWatch
    : ((() => () => {}) as unknown as typeof vueWatch);

  const { getEyeIris } = options;
  const eyeIrisStore = useEyeIrisStore();

  watch(() => eyeIrisStore.state.palettePreset, (v) => getEyeIris()?.setPalettePreset(v));
  watch(() => eyeIrisStore.state.geometry.irisRadius, (v) => getEyeIris()?.setIrisRadius(v));
  watch(() => eyeIrisStore.state.geometry.pupilRadius, (v) => getEyeIris()?.setPupilRadius(v));
  watch(() => eyeIrisStore.state.geometry.limbalRingWidth, (v) => getEyeIris()?.setLimbalRingWidth(v));
  watch(() => eyeIrisStore.state.detail.fiberDensity, (v) => getEyeIris()?.setFiberDensity(v));
  watch(() => eyeIrisStore.state.detail.fiberSharpness, (v) => getEyeIris()?.setFiberSharpness(v));
  watch(() => eyeIrisStore.state.detail.radialStreakStrength, (v) => getEyeIris()?.setRadialStreakStrength(v));
  watch(() => eyeIrisStore.state.detail.collaretteStrength, (v) => getEyeIris()?.setCollaretteStrength(v));
  watch(() => eyeIrisStore.state.detail.limbalIntensity, (v) => getEyeIris()?.setLimbalIntensity(v));
  watch(() => eyeIrisStore.state.detail.noiseStrength, (v) => getEyeIris()?.setNoiseStrength(v));
  watch(() => eyeIrisStore.state.detail.cryptStrength, (v) => getEyeIris()?.setCryptStrength(v));
  watch(() => eyeIrisStore.state.detail.furrowStrength, (v) => getEyeIris()?.setFurrowStrength(v));
  watch(() => eyeIrisStore.state.detail.ringContrast, (v) => getEyeIris()?.setRingContrast(v));
  watch(() => eyeIrisStore.state.detail.sectorMix, (v) => getEyeIris()?.setSectorMix(v));
  watch(() => eyeIrisStore.state.detail.pigmentMottleStrength, (v) => getEyeIris()?.setPigmentMottleStrength(v));
  watch(() => eyeIrisStore.state.detail.spokesStrength, (v) => getEyeIris()?.setSpokesStrength(v));
  watch(() => eyeIrisStore.state.detail.innerRingStrength, (v) => getEyeIris()?.setInnerRingStrength(v));
  watch(() => eyeIrisStore.state.animation.shimmerSpeed, (v) => getEyeIris()?.setShimmerSpeed(v));
  watch(() => eyeIrisStore.state.animation.shimmerStrength, (v) => getEyeIris()?.setShimmerStrength(v));
  watch(() => eyeIrisStore.state.animation.patternFlow, (v) => getEyeIris()?.setPatternFlow(v));
  watch(() => eyeIrisStore.state.animation.patternRotation, (v) => getEyeIris()?.setPatternRotation(v));
  watch(() => eyeIrisStore.state.follow.enabled, (v) => getEyeIris()?.setFollowEnabled(v));
  watch(() => eyeIrisStore.state.follow.sensitivity, (v) => getEyeIris()?.setFollowSensitivity(v));
  watch(() => eyeIrisStore.state.follow.pupilMotion, (v) => getEyeIris()?.setFollowPupilMotion(v));
  watch(() => eyeIrisStore.state.follow.pupilMotionStrength, (v) => getEyeIris()?.setFollowPupilMotionStrength(v));
  watch(() => eyeIrisStore.state.scale, (v) => getEyeIris()?.setScale(v));

  watch(
    () => eyeIrisStore.state.color,
    (v) => getEyeIris()?.setColors(v),
    { deep: true },
  );

  watch(
    () => eyeIrisStore.state.audio,
    (v) => {
      const iris = getEyeIris();
      if (!iris) return;
      iris.setAudioEnabled(v.enabled);
      iris.setAudioReactivity(v.reactivity);
      iris.setPupilResponse(v.pupilResponse);
      iris.setShimmerResponse(v.shimmerResponse);
      iris.setAudioSmoothing(v.smoothing);
    },
    { deep: true },
  );

  function syncFromKwami(): void {
    const renderer = getEyeIris();
    if (!renderer) return;
    eyeIrisStore.syncFromKwami(renderer);
  }

  function applyToKwami(): void {
    const renderer = getEyeIris();
    if (!renderer) return;
    const state = eyeIrisStore.state;
    renderer.setPalettePreset(state.palettePreset);
    renderer.setIrisRadius(state.geometry.irisRadius);
    renderer.setPupilRadius(state.geometry.pupilRadius);
    renderer.setLimbalRingWidth(state.geometry.limbalRingWidth);
    renderer.setFiberDensity(state.detail.fiberDensity);
    renderer.setFiberSharpness(state.detail.fiberSharpness);
    renderer.setRadialStreakStrength(state.detail.radialStreakStrength);
    renderer.setCollaretteStrength(state.detail.collaretteStrength);
    renderer.setLimbalIntensity(state.detail.limbalIntensity);
    renderer.setNoiseStrength(state.detail.noiseStrength);
    renderer.setCryptStrength(state.detail.cryptStrength);
    renderer.setFurrowStrength(state.detail.furrowStrength);
    renderer.setRingContrast(state.detail.ringContrast);
    renderer.setSectorMix(state.detail.sectorMix);
    renderer.setPigmentMottleStrength(state.detail.pigmentMottleStrength);
    renderer.setSpokesStrength(state.detail.spokesStrength);
    renderer.setInnerRingStrength(state.detail.innerRingStrength);
    renderer.setColors(state.color);
    renderer.setShimmerSpeed(state.animation.shimmerSpeed);
    renderer.setShimmerStrength(state.animation.shimmerStrength);
    renderer.setPatternFlow(state.animation.patternFlow);
    renderer.setPatternRotation(state.animation.patternRotation);
    renderer.setFollowEnabled(state.follow.enabled);
    renderer.setFollowSensitivity(state.follow.sensitivity);
    renderer.setFollowPupilMotion(state.follow.pupilMotion);
    renderer.setFollowPupilMotionStrength(state.follow.pupilMotionStrength);
    renderer.setScale(state.scale);
    renderer.setAudioEnabled(state.audio.enabled);
    renderer.setAudioReactivity(state.audio.reactivity);
    renderer.setPupilResponse(state.audio.pupilResponse);
    renderer.setShimmerResponse(state.audio.shimmerResponse);
    renderer.setAudioSmoothing(state.audio.smoothing);
  }

  return { syncFromKwami, applyToKwami };
}
