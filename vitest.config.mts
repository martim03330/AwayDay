import { defineConfig } from 'vitest/config';

// Tests import app modules with the same "@/" alias as the app (tsconfig paths).
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
