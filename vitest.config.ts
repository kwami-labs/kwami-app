import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';

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
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
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
        // Ratcheted upward per plan phase 4f. Raise, never lower.
        thresholds: {
          lines: 40,
          functions: 40,
          branches: 40,
          statements: 40,
          'src/stores/**': { lines: 70, functions: 70, branches: 60, statements: 70 },
          'src/utils/**': { lines: 90, functions: 90, branches: 80, statements: 90 },
        },
      },
    },
  }),
);
