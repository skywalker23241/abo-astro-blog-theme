import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import eslintPluginAstro from 'eslint-plugin-astro'

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'astro/no-set-html-directive': 'off'
    }
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      // CLI scripts use stdout for progress and results; keep browser logging restricted.
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }]
    }
  },
  prettier,
  {
    ignores: [
      'dist/**',
      '.output/**',
      'node_modules/**',
      '*.log',
      '.env*',
      '.cache/**',
      '.aidesigner/chrome-*/**',
      '.astro/**',
      '.netlify/**',
      '.DS_Store',
      'coverage/**'
    ]
  }
]
