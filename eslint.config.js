import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default [
    {
        name: 'app/files-to-lint',
        files: ['**/*.{js,mjs,ts,mts,tsx,vue}'],
    },

    {
        name: 'app/files-to-ignore',
        ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/playwright-report/**'],
    },

    ...pluginVue.configs['flat/recommended'],
    ...vueTsEslintConfig(),
    skipFormatting,

    {
        name: 'app/rules',
        rules: {
            // A leading underscore is the project's marker for a binding that
            // exists to satisfy a signature but is deliberately unused.
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
                destructuredArrayIgnorePattern: '^_',
            }],
            // Warn rather than error: console is still the debugging channel
            // here, and production builds strip it via esbuild.drop.
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            // Single-word component names are fine for panels and UI atoms.
            'vue/multi-word-component-names': 'off',
            // Purely cosmetic ordering/casing rules from flat/recommended.
            // Prettier owns formatting here, and enforcing these would rewrite
            // ~540 attributes across the tree for no behavioural gain.
            'vue/attributes-order': 'off',
            'vue/attribute-hyphenation': 'off',
            'vue/v-on-event-hyphenation': 'off',
        },
    },
]
