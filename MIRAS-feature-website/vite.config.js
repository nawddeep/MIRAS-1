import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { PAGES } from './tools/make-pages.mjs';

// Multi-page build: the homepage (with the locked hero) plus one small shell per inner page.
export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ['home', resolve(__dirname, 'index.html')],
        ...PAGES.map(([file, key]) => [key, resolve(__dirname, file)]),
      ]),
    },
  },
});
