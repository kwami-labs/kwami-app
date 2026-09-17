import { describe, expect, it } from 'vitest';

describe('harness smoke', () => {
  it('runs with jsdom globals available', () => {
    expect(typeof window).toBe('object');
    expect(typeof window.matchMedia).toBe('function');
    expect(new AudioContext()).toBeTruthy();
    expect(document.createElement('canvas').getContext('2d')).toBeTruthy();
    expect(document.createElement('canvas').getContext('webgl')).toBeNull();
  });

  it('reads stubbed env', () => {
    expect(import.meta.env.VITE_API_URL).toBe('http://localhost:8080');
  });
});
