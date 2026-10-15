import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

const BUILT_INS = [
  { group: ['node:*'], message: 'Node built-ins are not available to this layer.' },
];
const API_PACKAGE = {
  group: ['@importer/api', '@importer/api/*'],
  message: 'Only the API application may import itself.',
};
const NEST = {
  group: ['@nestjs/*'],
  message: 'Keep the framework out of this layer (only *.module.ts may use it).',
};
const PRISMA = {
  group: ['@prisma/*', '**/generated/**'],
  message: 'Keep persistence out of this layer.',
};
const OTHER_MODULES = {
  group: [
    '**/persistence/**',
    '**/local-security/**',
    '**/health/**',
    '**/config/**',
    '**/catalog-workbook/**',
    '**/stores/**',
  ],
  message: 'The shared kernel must not depend on other modules.',
};
const INFRASTRUCTURE = {
  group: ['**/infrastructure/**', '**/persistence/**'],
  message: 'Ports must not depend on their adapters.',
};

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    'data/**',
    'apps/api/src/generated/**',
    'openspec/**',
    '.atl/**',
    'vendor/**',
  ]),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read the environment only in apps/api/src/config/ or apps/web/vite.config.ts.',
        },
      ],
    },
  },

  // Plain JavaScript files are not part of any tsconfig project.
  { files: ['**/*.js', '**/*.mjs', '**/*.cjs'], extends: [tseslint.configs.disableTypeChecked] },

  // Layer rules (design D1/D2).
  {
    files: ['packages/contracts/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...BUILT_INS,
            API_PACKAGE,
            { group: ['@importer/web', '@importer/web/*'], message: 'Contracts import zod only.' },
            { group: ['**/apps/**'], message: 'Contracts must not reach into apps/.' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    ignores: ['apps/web/vite.config.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['fs', 'path', 'os', 'crypto', 'child_process', 'http', 'https', 'net', 'url'],
          patterns: [
            ...BUILT_INS,
            API_PACKAGE,
            { group: ['**/apps/api/**'], message: 'No API code.' },
          ],
        },
      ],
    },
  },
  {
    // Web tests run in Node (bundle scan, dev-server proxy), so they may use Node built-ins. The
    // API import bans are repeated: the block above is replaced for these files, not merged.
    files: ['apps/web/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [API_PACKAGE, { group: ['**/apps/api/**'], message: 'No API code.' }] },
      ],
    },
  },
  {
    files: ['apps/api/src/shared-kernel/**/*.ts'],
    ignores: ['**/*.module.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [NEST, PRISMA, OTHER_MODULES] }],
    },
  },
  {
    // Declared after the kernel block so it wins for ports; repeats the kernel patterns.
    files: ['apps/api/src/**/*.port.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [NEST, PRISMA, OTHER_MODULES, INFRASTRUCTURE] },
      ],
    },
  },

  {
    // The workbook domain and application layers stay pure; tests may use a file-system spy.
    files: ['apps/api/src/catalog-workbook/{domain,application}/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...BUILT_INS, NEST, PRISMA, INFRASTRUCTURE] },
      ],
    },
  },

  {
    // The stores domain and application layers stay pure; tests may use Node built-ins.
    files: ['apps/api/src/stores/{domain,application}/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [...BUILT_INS, NEST, PRISMA, INFRASTRUCTURE] },
      ],
    },
  },

  // The only places allowed to read process.env.
  {
    files: ['apps/api/src/config/**/*.ts', 'apps/web/vite.config.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  prettier,
);
