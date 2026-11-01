/**
 * Whether this browser will hand out a WebGL context at all.
 *
 * Every avatar renderer draws through Three.js, so without WebGL there is no
 * avatar. The usual cause is not the device: Chrome with "Use graphics
 * acceleration when available" switched off (chrome://settings/system) gives
 * no page a WebGL context, and since Chrome stopped falling back to software
 * WebGL, that is a hard "no" rather than a slow avatar.
 *
 * The probe context is released straight away: browsers cap live WebGL
 * contexts per page, and a leaked probe would count against the avatar's.
 */
export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
      WebGL2RenderingContext | WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Why the avatar could not start, for the notice shown in its place. */
export type AvatarUnavailableReason = 'webgl' | 'error';
