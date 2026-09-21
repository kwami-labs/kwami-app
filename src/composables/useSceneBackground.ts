import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useKwami } from '@/composables/useKwami';
import { useSceneStore, type BlendMode, type GradientOrb } from '@/stores/scene';
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const COMPOSITE_SIZE = 1536;

type VideoFrameCallback = (now: number, metadata: unknown) => void;
type ManagedVideoElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: VideoFrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

// Singleton state
let initialized = false;
let currentHdriTexture: THREE.DataTexture | null = null;
let currentHdriEnvironment: THREE.Texture | null = null;
let currentImageElement: HTMLImageElement | null = null;
let currentImageUrl = '';
let videoElement: ManagedVideoElement | null = null;
let videoAnimationFrame: number | null = null;
let videoFrameCallbackHandle: number | null = null;
let compositeCanvas: HTMLCanvasElement | null = null;
let compositeContext: CanvasRenderingContext2D | null = null;
let compositeTexture: THREE.CanvasTexture | null = null;
let gradientCanvas: HTMLCanvasElement | null = null;
let gradientContext: CanvasRenderingContext2D | null = null;
let gradientDirty = true;
let imageLoadToken = 0;

/** Offscreen WebGL: equirect HDR → LDR canvas for 2D composite + gradient overlay */
let hdriRasterCanvas: HTMLCanvasElement | null = null;
let hdriBlitRenderer: THREE.WebGLRenderer | null = null;
let hdriBlitScene: THREE.Scene | null = null;
let hdriBlitCamera: THREE.OrthographicCamera | null = null;
let hdriBlitMesh: THREE.Mesh | null = null;
let hdriBlitMaterial: THREE.ShaderMaterial | null = null;

const hdriBlitVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const hdriBlitFragmentShader = `
precision highp float;
precision highp sampler2D;
uniform sampler2D envMap;
uniform float backgroundIntensity;
varying vec2 vUv;

vec2 equirectUv(vec3 dir) {
  vec2 uv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
  uv *= vec2(0.15915494, 0.31830988);
  uv += 0.5;
  return uv;
}

void main() {
  float lon = (vUv.x - 0.5) * 6.2831853;
  float lat = (0.5 - vUv.y) * 3.14159265;
  float coslat = cos(lat);
  vec3 dir = normalize(vec3(coslat * sin(lon), sin(lat), coslat * cos(lon)));
  vec3 rgb = texture2D(envMap, equirectUv(dir)).rgb * backgroundIntensity;
  rgb = rgb / (rgb + vec3(1.0));
  gl_FragColor = vec4(pow(rgb, vec3(0.4545)), 1.0);
}
`;

const hdriLoading = ref(false);

export function useSceneBackground() {
  const { kwami } = useKwami();
  const sceneStore = useSceneStore();
  const { background } = storeToRefs(sceneStore);

  function getScene() {
    return kwami.value?.avatar.getScene();
  }

  function hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  function getCanvasBlendMode(blendMode: BlendMode): GlobalCompositeOperation {
    const mapping: Record<BlendMode, GlobalCompositeOperation> = {
      normal: 'source-over',
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      'soft-light': 'soft-light',
    };
    return mapping[blendMode] || 'source-over';
  }

  function ensureCompositeResources() {
    if (!compositeCanvas || !compositeContext) {
      compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = COMPOSITE_SIZE;
      compositeCanvas.height = COMPOSITE_SIZE;
      compositeContext = compositeCanvas.getContext('2d');
    }
    if (!compositeTexture && compositeCanvas) {
      compositeTexture = new THREE.CanvasTexture(compositeCanvas);
      compositeTexture.colorSpace = THREE.SRGBColorSpace;
    }
  }

  function ensureGradientCanvas(width: number, height: number) {
    if (!gradientCanvas || !gradientContext) {
      gradientCanvas = document.createElement('canvas');
      gradientContext = gradientCanvas.getContext('2d');
      gradientDirty = true;
    }

    if (gradientCanvas.width !== width || gradientCanvas.height !== height) {
      gradientCanvas.width = width;
      gradientCanvas.height = height;
      gradientDirty = true;
    }
  }

  function disposeHdriResources() {
    if (hdriBlitMaterial?.uniforms?.envMap) {
      hdriBlitMaterial.uniforms.envMap.value = null;
    }

    if (currentHdriEnvironment && currentHdriEnvironment !== currentHdriTexture) {
      currentHdriEnvironment.dispose();
    }
    currentHdriEnvironment = null;

    if (currentHdriTexture) {
      currentHdriTexture.dispose();
      currentHdriTexture = null;
    }
  }

  function disposeHdriBlitPipeline() {
    if (hdriBlitMaterial) {
      if (hdriBlitMaterial.uniforms?.envMap) {
        hdriBlitMaterial.uniforms.envMap.value = null;
      }
      hdriBlitMaterial.dispose();
      hdriBlitMaterial = null;
    }
    if (hdriBlitMesh) {
      hdriBlitMesh.geometry.dispose();
      hdriBlitMesh = null;
    }
    if (hdriBlitRenderer) {
      hdriBlitRenderer.dispose();
      hdriBlitRenderer = null;
    }
    hdriBlitScene = null;
    hdriBlitCamera = null;
    hdriRasterCanvas = null;
  }

  function ensureHdriBlitPipeline(): boolean {
    if (hdriBlitRenderer && hdriRasterCanvas) return true;

    hdriRasterCanvas = document.createElement('canvas');
    hdriRasterCanvas.width = COMPOSITE_SIZE;
    hdriRasterCanvas.height = COMPOSITE_SIZE;

    const gl = hdriRasterCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      console.warn('useSceneBackground: WebGL2 unavailable for HDRI composite');
      hdriRasterCanvas = null;
      return false;
    }

    hdriBlitRenderer = new THREE.WebGLRenderer({
      canvas: hdriRasterCanvas,
      context: gl,
      alpha: false,
      antialias: false,
    });
    hdriBlitRenderer.setSize(COMPOSITE_SIZE, COMPOSITE_SIZE, false);
    hdriBlitRenderer.outputColorSpace = THREE.SRGBColorSpace;
    hdriBlitRenderer.toneMapping = THREE.NoToneMapping;

    hdriBlitScene = new THREE.Scene();
    hdriBlitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    hdriBlitCamera.position.z = 1;

    hdriBlitMaterial = new THREE.ShaderMaterial({
      uniforms: {
        envMap: { value: null },
        backgroundIntensity: { value: 1 },
      },
      vertexShader: hdriBlitVertexShader,
      fragmentShader: hdriBlitFragmentShader,
      depthTest: false,
      depthWrite: false,
    });

    const geom = new THREE.PlaneGeometry(2, 2);
    hdriBlitMesh = new THREE.Mesh(geom, hdriBlitMaterial);
    hdriBlitScene.add(hdriBlitMesh);

    return true;
  }

  /** Rasterize equirectangular HDR (or LDR) texture to the WebGL canvas; encodes opacity in shader. */
  function rasterizeHdriEquirectToCanvas(texture: THREE.Texture): HTMLCanvasElement | null {
    if (
      !ensureHdriBlitPipeline() ||
      !hdriBlitRenderer ||
      !hdriBlitMaterial ||
      !hdriBlitCamera ||
      !hdriBlitScene
    ) {
      return null;
    }

    const opacity = Math.max(0, Math.min(1, background.value.media.hdri.opacity));
    const envMapUniform = hdriBlitMaterial.uniforms?.envMap;
    const intensityUniform = hdriBlitMaterial.uniforms?.backgroundIntensity;
    if (!envMapUniform || !intensityUniform) return null;

    envMapUniform.value = texture;
    intensityUniform.value = opacity;
    hdriBlitMaterial.needsUpdate = true;

    hdriBlitRenderer.render(hdriBlitScene, hdriBlitCamera);
    return hdriRasterCanvas;
  }

  /**
   * HDRI visible background: either raw equirect texture (no overlay) or canvas composite (overlay on).
   */
  function refreshHdriBackgroundDisplay() {
    if (!initialized || background.value.media.type !== 'hdri' || !currentHdriTexture) return;

    const scene = getScene();
    if (!scene) return;

    const { gradient } = background.value;

    if (gradient.enabled) {
      const raster = rasterizeHdriEquirectToCanvas(currentHdriTexture);
      if (!raster) {
        scene.scene.background = currentHdriTexture;
        applyHdriPresentation();
        return;
      }

      ensureCompositeResources();
      if (!compositeCanvas || !compositeContext || !compositeTexture) return;

      const ctx = compositeContext;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, COMPOSITE_SIZE, COMPOSITE_SIZE);
      ctx.drawImage(raster, 0, 0, COMPOSITE_SIZE, COMPOSITE_SIZE);

      const gradientLayer = renderGradientLayer(COMPOSITE_SIZE, COMPOSITE_SIZE);
      if (gradientLayer) {
        ctx.globalCompositeOperation = getCanvasBlendMode(gradient.blendMode);
        ctx.drawImage(gradientLayer, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
      }

      compositeTexture.needsUpdate = true;
      scene.scene.background = compositeTexture;
    } else {
      scene.scene.background = currentHdriTexture;
    }

    applyHdriPresentation();
  }

  function getHiddenVideoElement(): ManagedVideoElement | null {
    return document.getElementById('scene-bg-video') as ManagedVideoElement | null;
  }

  function clearImageCache() {
    currentImageElement = null;
    currentImageUrl = '';
  }

  function stopVideoLoop() {
    if (videoAnimationFrame) {
      cancelAnimationFrame(videoAnimationFrame);
      videoAnimationFrame = null;
    }
    if (videoElement?.cancelVideoFrameCallback && videoFrameCallbackHandle !== null) {
      videoElement.cancelVideoFrameCallback(videoFrameCallbackHandle);
      videoFrameCallbackHandle = null;
    }
  }

  function cleanupVideoElement() {
    stopVideoLoop();
    const existingVideo = getHiddenVideoElement();
    if (existingVideo) {
      existingVideo.pause();
      existingVideo.src = '';
      existingVideo.remove();
    }
    videoElement = null;
  }

  function renderOrbGradient(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    orb: GradientOrb,
  ) {
    const cx = (orb.x / 100) * width;
    const cy = (orb.y / 100) * height;
    const maxDim = Math.max(width, height);
    const radius = (orb.size / 100) * maxDim;
    const soft = orb.softness / 100;
    const a = orb.opacity;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

    gradient.addColorStop(0.0, hexToRgba(orb.color, a));
    gradient.addColorStop(0.1, hexToRgba(orb.color, a * 0.92));
    gradient.addColorStop(0.25, hexToRgba(orb.color, a * (0.7 + soft * 0.15)));
    gradient.addColorStop(0.45, hexToRgba(orb.color, a * (0.35 + soft * 0.1)));
    gradient.addColorStop(0.65, hexToRgba(orb.color, a * (0.12 + soft * 0.05)));
    gradient.addColorStop(0.85, hexToRgba(orb.color, a * 0.03));
    gradient.addColorStop(1.0, hexToRgba(orb.color, 0));

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function renderGradientLayer(width: number, height: number): HTMLCanvasElement | null {
    const { gradient } = background.value;
    if (!gradient.enabled) return null;

    ensureGradientCanvas(width, height);
    if (!gradientCanvas || !gradientContext) return null;
    if (!gradientDirty) return gradientCanvas;

    const ctx = gradientContext;
    const { type, solidColor, angle, radialCenter, radialSize, stops, orbs, opacity } = gradient;

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'source-over';

    if (type === 'solid') {
      ctx.fillStyle = solidColor;
      ctx.fillRect(0, 0, width, height);
    } else if (type === 'orbs') {
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const orb of orbs) {
        renderOrbGradient(ctx, width, height, orb);
      }
      ctx.restore();
    } else {
      const sortedStops = [...stops].sort((a, b) => a.position - b.position);
      let canvasGradient: CanvasGradient;

      if (type === 'radial') {
        const cx = (radialCenter.x / 100) * width;
        const cy = (radialCenter.y / 100) * height;
        const radius = (radialSize / 100) * Math.max(width, height);
        canvasGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      } else {
        const rad = (angle * Math.PI) / 180;
        const centerX = width / 2;
        const centerY = height / 2;
        const length = Math.max(width, height);
        const x1 = centerX - Math.cos(rad) * length;
        const y1 = centerY - Math.sin(rad) * length;
        const x2 = centerX + Math.cos(rad) * length;
        const y2 = centerY + Math.sin(rad) * length;
        canvasGradient = ctx.createLinearGradient(x1, y1, x2, y2);
      }

      for (const stop of sortedStops) {
        canvasGradient.addColorStop(stop.position / 100, hexToRgba(stop.color, stop.opacity));
      }

      ctx.fillStyle = canvasGradient;
      ctx.fillRect(0, 0, width, height);
    }

    gradientDirty = false;
    return gradientCanvas;
  }

  function renderMediaToCanvas(
    canvas: HTMLCanvasElement,
    mediaImage: HTMLImageElement | HTMLVideoElement | null,
    mediaOpacity: number,
    fit: 'cover' | 'contain' | 'stretch' = 'cover',
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !mediaImage) return;

    ctx.save();
    ctx.globalAlpha = mediaOpacity;
    ctx.globalCompositeOperation = 'source-over';

    const imgWidth =
      mediaImage instanceof HTMLVideoElement ? mediaImage.videoWidth : mediaImage.width;
    const imgHeight =
      mediaImage instanceof HTMLVideoElement ? mediaImage.videoHeight : mediaImage.height;

    if (!imgWidth || !imgHeight) {
      ctx.restore();
      return;
    }

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = imgWidth / imgHeight;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (fit === 'stretch') {
      drawWidth = canvas.width;
      drawHeight = canvas.height;
      offsetX = 0;
      offsetY = 0;
    } else if (fit === 'contain') {
      if (imgRatio > canvasRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgRatio;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      }
    } else if (imgRatio > canvasRatio) {
      drawHeight = canvas.height;
      drawWidth = imgWidth * (canvas.height / imgHeight);
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = imgHeight * (canvas.width / imgWidth);
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    ctx.drawImage(mediaImage, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();
  }

  function compositeBackground(
    mediaImage: HTMLImageElement | HTMLVideoElement | null = null,
    mediaOpacity: number = 1,
    mediaFit: 'cover' | 'contain' | 'stretch' = 'cover',
  ) {
    const scene = getScene();
    if (!scene) return;

    const { media, gradient } = background.value;

    if (media.type === 'none' && !gradient.enabled) {
      scene.scene.background = null;
      return;
    }

    ensureCompositeResources();
    if (!compositeCanvas || !compositeContext || !compositeTexture) return;

    const ctx = compositeContext;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);

    if (media.type !== 'none' && mediaImage) {
      renderMediaToCanvas(compositeCanvas, mediaImage, mediaOpacity, mediaFit);
    }

    const gradientLayer = renderGradientLayer(compositeCanvas.width, compositeCanvas.height);
    if (gradient.enabled && gradientLayer) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = getCanvasBlendMode(gradient.blendMode);
      ctx.drawImage(gradientLayer, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    compositeTexture.needsUpdate = true;
    scene.scene.background = compositeTexture;
  }

  function renderVideoFrame() {
    if (!videoElement || background.value.media.type !== 'video') return;
    const { opacity, fit } = background.value.media.video;
    compositeBackground(videoElement, opacity, fit);
  }

  function scheduleNextVideoFrame() {
    if (!videoElement || background.value.media.type !== 'video') return;

    if (videoElement.requestVideoFrameCallback) {
      videoFrameCallbackHandle = videoElement.requestVideoFrameCallback(() => {
        videoFrameCallbackHandle = null;
        renderVideoFrame();
        scheduleNextVideoFrame();
      });
      return;
    }

    videoAnimationFrame = requestAnimationFrame(() => {
      videoAnimationFrame = null;
      renderVideoFrame();
      scheduleNextVideoFrame();
    });
  }

  function startVideoLoop() {
    stopVideoLoop();
    renderVideoFrame();
    scheduleNextVideoFrame();
  }

  /**
   * HDRI: drive Three.js scene fields only — do not use renderer.toneMappingExposure (that affects
   * the whole frame including the avatar). When the sky is a canvas composite, opacity is baked in the
   * blit shader; otherwise backgroundIntensity scales the raw equirect texture.
   */
  function applyHdriPresentation() {
    if (!initialized) return;
    if (background.value.media.type !== 'hdri') return;

    const scene = getScene();
    if (!scene) return;

    const { intensity, opacity } = background.value.media.hdri;
    scene.renderer.toneMappingExposure = 1;
    const compositeSky =
      background.value.gradient.enabled && scene.scene.background === compositeTexture;
    scene.scene.backgroundIntensity = compositeSky ? 1 : Math.max(0, Math.min(1, opacity));
    scene.scene.environmentIntensity = Math.max(0, intensity);
  }

  function loadHdriEnvironment() {
    if (!initialized) return;
    if (background.value.media.type !== 'hdri') return;

    const scene = getScene();
    if (!scene) return;

    const { hdri } = background.value.media;

    if (!hdri.url) {
      disposeHdriResources();
      scene.scene.background = null;
      scene.scene.environment = null;
      scene.renderer.toneMappingExposure = 1;
      scene.scene.backgroundIntensity = 1;
      scene.scene.environmentIntensity = 1;
      return;
    }

    hdriLoading.value = true;

    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      hdri.url,
      (texture) => {
        disposeHdriResources();

        texture.mapping = THREE.EquirectangularReflectionMapping;
        currentHdriTexture = texture;
        currentHdriEnvironment = texture;

        scene.scene.environment = texture;

        if (hdri.blur > 0) {
          const pmremGenerator = new THREE.PMREMGenerator(scene.renderer);
          pmremGenerator.compileEquirectangularShader();
          currentHdriEnvironment = pmremGenerator.fromEquirectangular(texture).texture;
          scene.scene.environment = currentHdriEnvironment;
          pmremGenerator.dispose();
        }

        refreshHdriBackgroundDisplay();
        hdriLoading.value = false;
      },
      undefined,
      (error) => {
        console.warn('Failed to load HDRI:', error);
        hdriLoading.value = false;
      },
    );
  }

  function updateHdriProperties() {
    if (!initialized || background.value.media.type !== 'hdri' || !currentHdriTexture) return;
    refreshHdriBackgroundDisplay();
  }

  function applyStarFieldSettings() {
    if (!initialized) return;

    const scene = getScene();
    if (!scene) return;

    const { starField } = background.value.effects;
    scene.setStarFieldConfig({
      count: starField.count,
      fieldRadius: starField.fieldRadius,
      twinkleSpeed: starField.twinkleSpeed,
      rotationSpeed: starField.rotationSpeed,
      minSize: starField.minSize,
      maxSize: starField.maxSize,
    });
    scene.setStarFieldEnabled(starField.enabled);
  }

  function loadImageBackground(url: string, opacity: number, fit: 'cover' | 'contain' | 'stretch') {
    if (!url) {
      clearImageCache();
      compositeBackground();
      return;
    }

    if (currentImageElement && currentImageUrl === url) {
      compositeBackground(currentImageElement, opacity, fit);
      return;
    }

    const loadToken = ++imageLoadToken;
    const image = new Image();
    if (!url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      if (loadToken !== imageLoadToken) return;
      currentImageElement = image;
      currentImageUrl = url;
      compositeBackground(image, opacity, fit);
    };

    image.onerror = () => {
      if (loadToken !== imageLoadToken) return;
      console.warn('Failed to load background image:', url);
      clearImageCache();
      compositeBackground();
    };

    image.src = url;
  }

  function updateMediaBackground() {
    if (!initialized) return;

    const scene = getScene();
    if (!scene) return;

    const { media } = background.value;

    if (media.type !== 'video') {
      cleanupVideoElement();
    }

    if (media.type !== 'image') {
      clearImageCache();
      imageLoadToken += 1;
    }

    if (media.type !== 'hdri') {
      disposeHdriResources();
      disposeHdriBlitPipeline();
      scene.renderer.toneMappingExposure = 1;
      scene.scene.backgroundIntensity = 1;
      scene.scene.environmentIntensity = 1;
    }

    if (media.type === 'none') {
      scene.scene.environment = null;
      compositeBackground();
      return;
    }

    if (media.type === 'hdri') {
      loadHdriEnvironment();
      return;
    }

    scene.scene.environment = null;

    if (media.type === 'image') {
      const { url, opacity, fit } = media.image;
      loadImageBackground(url, opacity, fit);
      return;
    }

    const { url, muted, loop } = media.video;
    if (!url) {
      compositeBackground();
      return;
    }

    let video = getHiddenVideoElement();
    const isNewVideo = !video;

    if (isNewVideo) {
      video = document.createElement('video') as ManagedVideoElement;
      video.id = 'scene-bg-video';
      video.style.display = 'none';
      document.body.appendChild(video);
    }

    if (!video) return;

    if (!url.startsWith('blob:')) {
      video.crossOrigin = 'anonymous';
    } else {
      video.removeAttribute('crossOrigin');
    }

    video.muted = muted;
    video.loop = loop;
    video.playsInline = true;
    video.preload = 'auto';

    const onCanPlay = () => {
      video?.removeEventListener('canplay', onCanPlay);
      video?.removeEventListener('error', onError);
      if (!video) return;

      video.play().catch((err) => {
        console.warn('Video autoplay failed:', err);
      });

      videoElement = video;
      startVideoLoop();
    };

    const onError = () => {
      video?.removeEventListener('canplay', onCanPlay);
      video?.removeEventListener('error', onError);
      console.warn('Failed to load video. Check the URL or file format.');
      compositeBackground();
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    if (video.src !== url) {
      video.src = url;
      video.load();
    } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      onCanPlay();
    }
  }

  function updateGradientOverlay() {
    if (!initialized) return;
    gradientDirty = true;

    if (background.value.media.type === 'video' && videoElement) {
      renderVideoFrame();
      return;
    }

    if (background.value.media.type === 'image' && background.value.media.image.url) {
      const { url, opacity, fit } = background.value.media.image;
      loadImageBackground(url, opacity, fit);
      return;
    }

    if (background.value.media.type === 'hdri') {
      if (currentHdriTexture) {
        refreshHdriBackgroundDisplay();
      }
      return;
    }

    compositeBackground();
  }

  function resumeVideoIfNeeded() {
    if (background.value.media.type !== 'video' || !background.value.media.video.url) return;

    const existingVideo = getHiddenVideoElement();
    if (!existingVideo) return;

    videoElement = existingVideo;
    startVideoLoop();
  }

  function setupWatchers() {
    watch(() => background.value.media.type, updateMediaBackground);
    watch(() => background.value.media.image.url, updateMediaBackground);
    watch(
      () => background.value.media.image.fit,
      () => {
        if (background.value.media.type === 'image' && currentImageElement) {
          compositeBackground(
            currentImageElement,
            background.value.media.image.opacity,
            background.value.media.image.fit,
          );
        }
      },
    );
    watch(
      () => background.value.media.image.opacity,
      () => {
        if (background.value.media.type === 'image' && currentImageElement) {
          compositeBackground(
            currentImageElement,
            background.value.media.image.opacity,
            background.value.media.image.fit,
          );
        }
      },
    );
    watch(() => background.value.media.video.url, updateMediaBackground);
    watch(
      () => background.value.media.video.muted,
      (muted) => {
        const video = getHiddenVideoElement();
        if (video) video.muted = muted;
      },
    );
    watch(
      () => background.value.media.video.loop,
      (loop) => {
        const video = getHiddenVideoElement();
        if (video) video.loop = loop;
      },
    );
    watch(
      () => [background.value.media.video.fit, background.value.media.video.opacity],
      () => {
        if (background.value.media.type === 'video' && videoElement) {
          renderVideoFrame();
        }
      },
    );

    watch(() => background.value.media.hdri.url, loadHdriEnvironment);
    watch(() => background.value.media.hdri.intensity, updateHdriProperties);
    watch(() => background.value.media.hdri.opacity, updateHdriProperties);
    watch(() => background.value.media.hdri.blur, loadHdriEnvironment);

    const markGradientDirty = () => {
      updateGradientOverlay();
    };

    watch(() => background.value.gradient.enabled, markGradientDirty);
    watch(() => background.value.gradient.type, markGradientDirty);
    watch(() => background.value.gradient.solidColor, markGradientDirty);
    watch(() => background.value.gradient.angle, markGradientDirty);
    watch(() => background.value.gradient.radialCenter, markGradientDirty, { deep: true });
    watch(() => background.value.gradient.radialSize, markGradientDirty);
    watch(() => background.value.gradient.stops, markGradientDirty, { deep: true });
    watch(() => background.value.gradient.orbs, markGradientDirty, { deep: true });
    watch(() => background.value.gradient.opacity, markGradientDirty);
    watch(() => background.value.gradient.blendMode, markGradientDirty);

    watch(() => background.value.effects.starField, applyStarFieldSettings, { deep: true });
  }

  function initialize() {
    if (initialized) return;

    sceneStore.loadSettings();

    if (kwami.value) {
      initialized = true;
      setupWatchers();
      updateMediaBackground();
      resumeVideoIfNeeded();
      applyStarFieldSettings();
      return;
    }

    const unwatch = watch(
      kwami,
      (instance) => {
        if (!instance) return;
        initialized = true;
        setupWatchers();
        updateMediaBackground();
        resumeVideoIfNeeded();
        applyStarFieldSettings();
        unwatch();
      },
      { immediate: true },
    );
  }

  return {
    initialize,
    hdriLoading,
    updateMediaBackground,
    updateGradientOverlay,
  };
}
