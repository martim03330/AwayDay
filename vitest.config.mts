import { defineConfig } from 'vitest/config';

// Tests import app modules with the same "@/" alias as the app (tsconfig paths).
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  // Screen and component tests (*.ui.test.tsx) run in Jest with jest-expo: `npm run test:ecras`.
  test: {
    exclude: ['**/node_modules/**', '**/*.ui.test.tsx'],
  },
});
