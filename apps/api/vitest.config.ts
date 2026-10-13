import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: ['src/**/*.integration.spec.ts', 'node_modules'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
      exclude: ['src/**/*.spec.ts', 'src/**/index.ts', 'src/domain/ports/**', 'src/**/testing/**'],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});
