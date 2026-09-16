/**
 * Renderer handle types, derived from the `kwami` SDK rather than restated.
 *
 * The concrete BlackHole / ParticlesFace / EyeIris classes are not exported
 * from the package root, but `Avatar`'s accessors are fully typed — so pull
 * the handle types off those return signatures. This keeps the sync
 * composables honest: if a setter is renamed in the SDK, these break at build
 * time instead of silently no-oping at runtime.
 */
import type { Avatar } from 'kwami';

export type BlackHoleHandle = NonNullable<ReturnType<Avatar['getBlackHole']>>;
export type ParticlesFaceHandle = NonNullable<ReturnType<Avatar['getParticlesFace']>>;
export type EyeIrisHandle = NonNullable<ReturnType<Avatar['getEyeIris']>>;
export type BlobXyzHandle = NonNullable<ReturnType<Avatar['getBlob']>>;
