import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Reuses vite.config.ts so the `@` alias and the `iconify-icon` custom-element
// compiler option apply to tests exactly as they do to the app.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // Set here rather than via vi.stubEnv in setup.ts: stubs are per-test and
      // would be torn down before the suite finishes.
      env: {
        VITE_API_URL: 'http://localhost:8080',
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        VITE_LIVEKIT_URL: 'wss://livekit.test',
        VITE_LIVEKIT_TOKEN_ENDPOINT: 'http://localhost:8080/token',
        VITE_AUTH_PROVIDERS: 'google,phantom,metamask',
      },
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/main.ts',
          'src/**/*.d.ts',
          'src/i18n/translations/**',
          'src/presets/**',
          // WebGL render loops - covered by e2e, not unit tests (see plan 4f)
          'src/components/welcome/**',
          'src/components/memory/MemoryGraph3D.vue',
          'src/composables/useSceneBackground.ts',
        ],
        // Ratcheted upward. Raise, never lower.
        //
        // These were 40 / 70 / 90 and had never once been checked: the
        // `@vitest/coverage-v8` dependency was pinned to a 3.x that declares
        // `vitest@3.2.7` as an exact peer, while vitest here is 5.x, so
        // `vitest run --coverage` — which is what CI runs — died with
        // ERR_PACKAGE_PATH_NOT_EXPORTED before collecting a single line. CI's
        // Verify job was red, and the aspirational numbers below were roughly
        // double what the suite actually covers.
        //
        // The first real measurement was 23.09 lines / 18.65 functions global,
        // 30.72 / 26.08 for stores, 66.77 / 65 for utils. These floors sit just
        // under that, so they hold today and CI enforces from now on. They are
        // a starting line, not a target — raise them with each suite that
        // lands, and never edit one downward to make a red build green.
        thresholds: {
          lines: 22,
          functions: 18,
          branches: 16,
          statements: 21,
          'src/stores/**': { lines: 29, functions: 25, branches: 13, statements: 28 },
          'src/utils/**': { lines: 64, functions: 63, branches: 42, statements: 62 },
        },
      },
    },
  }),
);
