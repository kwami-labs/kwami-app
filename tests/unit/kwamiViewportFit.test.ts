/**
 * The avatar has to stay in the middle of its canvas, and shrink when the
 * shorter side of the frustum cannot hold the desktop hero scale.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  HERO_BLOB_SCALE,
  HERO_EYE_SCALE,
  fitKwamiInView,
  heroScaleForViewport,
  measureKwamiCanvas,
  visibleWorldSize,
} from '@/utils/kwamiViewportFit';

describe('visibleWorldSize', () => {
  it('is wider than it is tall on a landscape canvas', () => {
    const world = visibleWorldSize(1280, 800);
    expect(world.width).toBeGreaterThan(world.height);
  });

  it('is taller than it is wide on a portrait phone', () => {
    const world = visibleWorldSize(390, 844);
    expect(world.height).toBeGreaterThan(world.width);
  });
});

describe('heroScaleForViewport', () => {
  it('keeps the desktop hero scale on a wide canvas', () => {
    expect(heroScaleForViewport(1280, 800, 'blob-xyz')).toBe(HERO_BLOB_SCALE);
    expect(heroScaleForViewport(1280, 800, 'eye-iris')).toBe(HERO_EYE_SCALE);
  });

  it('shrinks the blob on a portrait phone so it fits the width', () => {
    const phone = heroScaleForViewport(390, 844, 'blob-xyz');
    expect(phone).toBeLessThan(HERO_BLOB_SCALE);
    expect(phone).toBeGreaterThan(1.5);
  });

  it('caps blob and eye to the same frustum on a tight phone', () => {
    const blob = heroScaleForViewport(390, 844, 'blob-xyz');
    const eye = heroScaleForViewport(390, 844, 'eye-iris');
    expect(eye).toBeLessThan(HERO_EYE_SCALE);
    expect(eye).toBeCloseTo(blob);
  });

  it('keeps the eye larger than the blob when the canvas still has room', () => {
    const blob = heroScaleForViewport(768, 1024, 'blob-xyz');
    const eye = heroScaleForViewport(768, 1024, 'eye-iris');
    expect(blob).toBe(HERO_BLOB_SCALE);
    expect(eye).toBeGreaterThan(blob);
    expect(eye).toBeLessThan(HERO_EYE_SCALE);
  });

  it('does not grow past the desktop hero when the canvas is huge', () => {
    expect(heroScaleForViewport(3840, 2160, 'blob-xyz')).toBe(HERO_BLOB_SCALE);
  });
});

describe('measureKwamiCanvas', () => {
  it('prefers the parent box over the canvas backing store', () => {
    const parent = { clientWidth: 390, clientHeight: 844 };
    const canvas = {
      parentElement: parent,
      clientWidth: 300,
      clientHeight: 150,
    } as HTMLCanvasElement;

    expect(measureKwamiCanvas(canvas)).toEqual({ width: 390, height: 844 });
  });
});

describe('fitKwamiInView', () => {
  function makeKwami() {
    const resize = vi.fn();
    const reset = vi.fn();
    const refresh = vi.fn();
    const setScale = vi.fn();
    const setEyeScale = vi.fn();
    return {
      resize,
      reset,
      refresh,
      setScale,
      setEyeScale,
      kwami: {
        avatar: {
          getScene: () => ({ resize }),
          getBlob: () => ({ position: { reset, refresh } }),
          getEyeIris: () => ({ setScale: setEyeScale }),
          setScale,
        },
      },
    };
  }

  const desktopCanvas = {
    parentElement: { clientWidth: 1280, clientHeight: 800 },
    clientWidth: 1280,
    clientHeight: 800,
  } as HTMLCanvasElement;

  const phoneCanvas = {
    parentElement: { clientWidth: 390, clientHeight: 844 },
    clientWidth: 390,
    clientHeight: 844,
  } as HTMLCanvasElement;

  it('resizes the scene, recenters the blob, and applies the hero scale', () => {
    const { kwami, resize, reset, refresh, setScale } = makeKwami();

    const framed = fitKwamiInView(kwami, desktopCanvas, { renderer: 'blob-xyz' });

    expect(resize).toHaveBeenCalledWith(1280, 800);
    expect(reset).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(setScale).toHaveBeenCalledWith(HERO_BLOB_SCALE);
    expect(framed.scale).toBe(HERO_BLOB_SCALE);
  });

  it('caps a stored workspace scale on a phone without raising a small one', () => {
    const large = makeKwami();
    const small = makeKwami();

    const capped = fitKwamiInView(large.kwami, phoneCanvas, {
      renderer: 'blob-xyz',
      desiredScale: 3.2,
    });
    const kept = fitKwamiInView(small.kwami, phoneCanvas, {
      renderer: 'blob-xyz',
      desiredScale: 1.1,
    });

    expect(capped.scale).toBeLessThan(3.2);
    expect(large.setScale).toHaveBeenCalledWith(capped.scale);
    expect(kept.scale).toBe(1.1);
    expect(small.setScale).toHaveBeenCalledWith(1.1);
  });

  it('scales the eye through its own setter', () => {
    const { kwami, setScale, setEyeScale } = makeKwami();

    fitKwamiInView(kwami, desktopCanvas, { renderer: 'eye-iris' });

    expect(setEyeScale).toHaveBeenCalledWith(HERO_EYE_SCALE);
    expect(setScale).not.toHaveBeenCalled();
  });
});
