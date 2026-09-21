/**
 * The login blob used to force `setWireframe(false)` on every tick, so the
 * mode never appeared. One solid-to-wireframe ratio is pinned here.
 */
import { describe, expect, it } from 'vitest';
import { WIREFRAME_PER_NORMAL, pickWelcomeWireframe } from '@/utils/welcomeBlobLook';

describe('pickWelcomeWireframe', () => {
  it('is one wireframe for every seven solid skins', () => {
    expect(WIREFRAME_PER_NORMAL).toBe(7);
    expect(pickWelcomeWireframe(() => 0)).toBe(false);
    expect(pickWelcomeWireframe(() => 7 / 8 - 1e-9)).toBe(false);
    expect(pickWelcomeWireframe(() => 7 / 8)).toBe(true);
    expect(pickWelcomeWireframe(() => 0.999)).toBe(true);
  });

  it('lands on the published 1-in-8 rate across a long roll', () => {
    let cursor = 0;
    const random = () => {
      const value = (cursor % 8) / 8;
      cursor += 1;
      return value;
    };

    let wire = 0;
    let solid = 0;
    for (let i = 0; i < 800; i += 1) {
      if (pickWelcomeWireframe(random)) wire += 1;
      else solid += 1;
    }

    expect(wire).toBe(100);
    expect(solid).toBe(700);
    expect(solid / wire).toBe(WIREFRAME_PER_NORMAL);
  });
});
