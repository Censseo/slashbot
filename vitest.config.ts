import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@slashbot/core': resolve(__dirname, 'src/core'),
      '@slashbot/providers': resolve(__dirname, 'src/providers'),
      '@slashbot/ui': resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/browser-plugin.test.ts']
  }
});
