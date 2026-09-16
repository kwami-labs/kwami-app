import { watch as vueWatch, type Ref } from 'vue';
import { useParticlesFaceStore } from '@/stores/avatar.particles-face';

type KwamiInstance = ReturnType<typeof import('@/composables/useKwami').useKwami>['kwami']['value'];

export interface UseParticlesFaceSyncOptions {
  /**
   * Register the reactive store -> renderer watchers. Defaults to true.
   *
   * Pass false when the caller only needs syncFromKwami/applyToKwami; App.vue
   * already owns the always-on watcher set, and AvatarPanel instantiating them
   * again doubled every setter call while the panel was open.
   */
  registerWatchers?: boolean;
  kwami: Ref<KwamiInstance>;
  getParticlesFace: () => any | undefined;
}

export function useParticlesFaceSync(options: UseParticlesFaceSyncOptions) {
  const { registerWatchers = true } = options;
  // A no-op stand-in keeps the ~25 watch() call sites below unchanged.
  const watch: typeof vueWatch = registerWatchers
    ? vueWatch
    : ((() => () => {}) as unknown as typeof vueWatch);

  const { getParticlesFace } = options;
  const s = useParticlesFaceStore();

  watch(() => s.state.color, (v) => getParticlesFace()?.setColor(v));
  watch(() => s.state.secondaryColor, (v) => getParticlesFace()?.setSecondaryColor(v));
  watch(() => s.state.particleSize, (v) => getParticlesFace()?.setParticleSize(v));
  watch(() => s.state.opacity, (v) => getParticlesFace()?.setOpacity(v));
  watch(() => s.state.faceScale, (v) => getParticlesFace()?.setFaceScale(v));
  watch(() => s.state.depthSpread, (v) => getParticlesFace()?.setDepthSpread(v));
  watch(() => s.state.mouthAmplitude, (v) => getParticlesFace()?.setMouthAmplitude(v));
  watch(() => s.state.breathingSpeed, (v) => getParticlesFace()?.setBreathingSpeed(v));
  watch(() => s.state.breathingAmplitude, (v) => getParticlesFace()?.setBreathingAmplitude(v));
  watch(() => s.state.driftSpeed, (v) => getParticlesFace()?.setDriftSpeed(v));
  watch(() => s.state.driftAmplitude, (v) => getParticlesFace()?.setDriftAmplitude(v));
  watch(() => s.state.speakingReactivity, (v) => getParticlesFace()?.setSpeakingReactivity(v));
  watch(() => s.state.listeningPulse, (v) => getParticlesFace()?.setListeningPulse(v));
  watch(() => s.state.thinkingSpeed, (v) => getParticlesFace()?.setThinkingSpeed(v));
  watch(() => s.state.scale, (v) => getParticlesFace()?.setScale(v));
  watch(() => s.state.ambientParticles, (v) => getParticlesFace()?.setAmbientParticles(v));
  watch(() => s.state.ambientRadius, (v) => getParticlesFace()?.setAmbientRadius(v));

  function syncFromKwami(): void {
    const pf = getParticlesFace();
    if (pf) s.syncFromKwami(pf);
  }

  function applyToKwami(): void {
    const pf = getParticlesFace();
    if (!pf) return;

    pf.setColor(s.state.color);
    pf.setSecondaryColor(s.state.secondaryColor);
    pf.setParticleSize(s.state.particleSize);
    pf.setOpacity(s.state.opacity);
    pf.setFaceScale(s.state.faceScale);
    pf.setDepthSpread(s.state.depthSpread);
    pf.setMouthAmplitude(s.state.mouthAmplitude);
    pf.setBreathingSpeed(s.state.breathingSpeed);
    pf.setBreathingAmplitude(s.state.breathingAmplitude);
    pf.setDriftSpeed(s.state.driftSpeed);
    pf.setDriftAmplitude(s.state.driftAmplitude);
    pf.setSpeakingReactivity(s.state.speakingReactivity);
    pf.setListeningPulse(s.state.listeningPulse);
    pf.setThinkingSpeed(s.state.thinkingSpeed);
    pf.setScale(s.state.scale);
    pf.setAmbientParticles(s.state.ambientParticles);
    pf.setAmbientRadius(s.state.ambientRadius);
  }

  return { syncFromKwami, applyToKwami };
}
