/**
 * BlobXyz Sync Composable
 * 
 * Handles synchronization between the BlobXyz store state and the Kwami blob instance.
 * Extracts all watcher logic from AvatarPanel.vue for better separation of concerns.
 */

import { watch as vueWatch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useBlobXyzStore } from '@/stores/avatar.blob-xyz';
import { applyRoundedBlobGeometry } from '@/utils/blobGeometry';

// Local type for Kwami instance (avoid external dependency)
type KwamiInstance = ReturnType<typeof import('@/composables/useKwami').useKwami>['kwami']['value'];

// =====================================================
// TYPES
// =====================================================

export interface UseBlobXyzSyncOptions {
  /**
   * Register the reactive store -> renderer watchers. Defaults to true.
   *
   * Pass false when the caller only needs syncFromKwami/applyToKwami; App.vue
   * already owns the always-on watcher set, and AvatarPanel instantiating them
   * again doubled every setter call while the panel was open.
   */
  registerWatchers?: boolean;
    /** Reactive reference to the Kwami instance */
    kwami: Ref<KwamiInstance>;
    /** Function to get the blob renderer instance */
    getBlob: () => NonNullable<KwamiInstance> extends { avatar: { getBlob: () => infer R } } ? R | undefined : never;
}

// =====================================================
// COMPOSABLE
// =====================================================

export function useBlobXyzSync(options: UseBlobXyzSyncOptions) {
    const { registerWatchers = true } = options;
    // A no-op stand-in keeps the ~25 watch() call sites below unchanged.
    const watch: typeof vueWatch = registerWatchers
      ? vueWatch
      : ((() => () => {}) as unknown as typeof vueWatch);

    const { kwami, getBlob } = options;
    const blobStore = useBlobXyzStore();
    const { skin, shape, animation, cursorTouch, audio } = storeToRefs(blobStore);

    // =====================================================
    // SKIN WATCHERS
    // =====================================================

    watch(
        () => skin.value.type,
        (v) => kwami.value?.avatar.setSkin(v)
    );

    watch(
        () => skin.value.colors,
        (v) => getBlob()?.setColors(v.x, v.y, v.z),
        { deep: true }
    );

    watch(
        () => skin.value.opacity,
        (v) => kwami.value?.avatar.setOpacity(v)
    );

    watch(
        () => skin.value.shininess,
        (v) => kwami.value?.avatar.setShininess(v)
    );

    watch(
        () => skin.value.lightIntensity,
        (v) => getBlob()?.setLightIntensity(v)
    );

    watch(
        () => skin.value.wireframe,
        (v) => kwami.value?.avatar.setWireframe(v)
    );

    watch(
        () => skin.value.glassMode,
        (v) => getBlob()?.setGlassMode(v)
    );

    watch(
        () => skin.value.resolution,
        (v) => {
            const b = getBlob();
            if (!b) return;
            b.setResolution(v);
            applyRoundedBlobGeometry(b.getMesh(), v);
        }
    );

    // =====================================================
    // SHAPE WATCHERS
    // =====================================================

    watch(
        () => shape.value.scale,
        (v) => kwami.value?.avatar.setScale(v)
    );

    watch(
        () => shape.value.spikes,
        (v) => getBlob()?.setSpikes(v.x, v.y, v.z),
        { deep: true }
    );

    watch(
        () => shape.value.amplitude,
        (v) => getBlob()?.setAmplitude(v.x, v.y, v.z),
        { deep: true }
    );

    // Position (convert degrees to radians)
    watch(
        () => shape.value.position,
        (v) => {
            const b = getBlob();
            if (b) {
                const mesh = b.getMesh();
                if (mesh) {
                    const degToRad = (deg: number) => (deg * Math.PI) / 180;
                    mesh.rotation.x = degToRad(v.x);
                    mesh.rotation.y = degToRad(v.y);
                    mesh.rotation.z = degToRad(v.z);
                }
            }
        },
        { deep: true }
    );

    // =====================================================
    // ANIMATION WATCHERS
    // =====================================================

    watch(
        () => animation.value.time,
        (v) => getBlob()?.setTime(v.x, v.y, v.z),
        { deep: true }
    );

    watch(
        () => animation.value.rotation,
        (v) => kwami.value?.avatar.setRotation(v.x, v.y, v.z),
        { deep: true }
    );

    watch(
        () => animation.value.breathing,
        (v) => {
            const b = getBlob();
            if (b && b.audioEffects) b.audioEffects.breathing = v;
        }
    );

    // =====================================================
    // CURSOR & TOUCH WATCHERS
    // =====================================================

    watch(
        () => cursorTouch.value.touch.strength,
        (v) => getBlob()?.setTouchStrength(v)
    );

    watch(
        () => cursorTouch.value.touch.duration,
        (v) => getBlob()?.setTouchDuration(v)
    );

    watch(
        () => cursorTouch.value.touch.maxPoints,
        (v) => getBlob()?.setMaxTouchPoints(v)
    );

    watch(
        () => cursorTouch.value.cursorFollow.enabled,
        (v) => getBlob()?.setCursorFollowEnabled(v)
    );

    watch(
        () => cursorTouch.value.cursorFollow.sensitivity,
        (v) => getBlob()?.setCursorFollowSensitivity(v)
    );

    // =====================================================
    // AUDIO WATCHERS
    // =====================================================

    watch(
        () => audio.value,
        (a) => {
            const b = getBlob();
            if (!b || !b.audioEffects) return;

            b.audioEffects.enabled = a.enabled;
            b.audioEffects.reactivity = a.reactivity;
            b.audioEffects.sensitivity = a.sensitivity;
            b.audioEffects.responseSpeed = a.responseSpeed;
            b.audioEffects.transientBoost = a.transientBoost;
            b.audioEffects.spikeDensity = a.spikeDensity;
            b.audioEffects.rotateWhilePlaying = a.rotateWhilePlaying;
            b.audioEffects.bassSpike = a.frequencySpikes.bass;
            b.audioEffects.midSpike = a.frequencySpikes.mid;
            b.audioEffects.highSpike = a.frequencySpikes.high;
        },
        { deep: true }
    );

    // =====================================================
    // SYNC FROM KWAMI
    // =====================================================

    function syncFromKwami(): void {
        const blobInstance = getBlob();
        if (!blobInstance) return;
        blobStore.syncFromKwami(blobInstance);
        // Sync mesh rotation (visual orientation from user drag) into store so opening the avatar panel doesn't overwrite it
        const mesh = blobInstance.getMesh();
        if (mesh) {
            const radToDeg = (rad: number) => (rad * 180) / Math.PI;
            const x = radToDeg(mesh.rotation.x);
            const y = radToDeg(mesh.rotation.y);
            const z = radToDeg(mesh.rotation.z);
            const normalize = (d: number) => ((d % 360) + 360) % 360;
            shape.value.position.x = Math.round(normalize(x));
            shape.value.position.y = Math.round(normalize(y));
            shape.value.position.z = Math.round(normalize(z));
        }
    }

    // =====================================================
    // APPLY TO KWAMI
    // =====================================================

    /**
     * Apply all current store values to the Kwami blob instance.
     * Useful after applying presets or resetting.
     */
    function applyToKwami(): void {
        const b = getBlob();
        if (!b || !kwami.value) return;

        // Skin
        kwami.value.avatar.setSkin(skin.value.type);
        b.setColors(skin.value.colors.x, skin.value.colors.y, skin.value.colors.z);
        kwami.value.avatar.setOpacity(skin.value.opacity);
        kwami.value.avatar.setShininess(skin.value.shininess);
        b.setLightIntensity(skin.value.lightIntensity);
        kwami.value.avatar.setWireframe(skin.value.wireframe);
        b.setGlassMode(skin.value.glassMode);
        b.setResolution(skin.value.resolution);
        applyRoundedBlobGeometry(b.getMesh(), skin.value.resolution);

        // Shape
        kwami.value.avatar.setScale(shape.value.scale);
        b.setSpikes(shape.value.spikes.x, shape.value.spikes.y, shape.value.spikes.z);
        b.setAmplitude(shape.value.amplitude.x, shape.value.amplitude.y, shape.value.amplitude.z);

        const mesh = b.getMesh();
        if (mesh) {
            const degToRad = (deg: number) => (deg * Math.PI) / 180;
            mesh.rotation.x = degToRad(shape.value.position.x);
            mesh.rotation.y = degToRad(shape.value.position.y);
            mesh.rotation.z = degToRad(shape.value.position.z);
        }

        // Animation
        b.setTime(animation.value.time.x, animation.value.time.y, animation.value.time.z);
        kwami.value.avatar.setRotation(
            animation.value.rotation.x,
            animation.value.rotation.y,
            animation.value.rotation.z
        );
        if (b.audioEffects) {
            b.audioEffects.breathing = animation.value.breathing;
        }

        // Touch
        b.setTouchStrength(cursorTouch.value.touch.strength);
        b.setTouchDuration(cursorTouch.value.touch.duration);
        b.setMaxTouchPoints(cursorTouch.value.touch.maxPoints);
        b.setCursorFollowEnabled(cursorTouch.value.cursorFollow.enabled);
        b.setCursorFollowSensitivity(cursorTouch.value.cursorFollow.sensitivity);

        // Audio
        if (b.audioEffects) {
            b.audioEffects.enabled = audio.value.enabled;
            b.audioEffects.reactivity = audio.value.reactivity;
            b.audioEffects.sensitivity = audio.value.sensitivity;
            b.audioEffects.responseSpeed = audio.value.responseSpeed;
            b.audioEffects.transientBoost = audio.value.transientBoost;
            b.audioEffects.spikeDensity = audio.value.spikeDensity;
            b.audioEffects.rotateWhilePlaying = audio.value.rotateWhilePlaying;
            b.audioEffects.bassSpike = audio.value.frequencySpikes.bass;
            b.audioEffects.midSpike = audio.value.frequencySpikes.mid;
            b.audioEffects.highSpike = audio.value.frequencySpikes.high;
        }
    }

    return {
        syncFromKwami,
        applyToKwami,
    };
}
