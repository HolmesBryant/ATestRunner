import { defineConfig } from 'vite';
import { importCSSSheet } from 'vite-plugin-import-css-sheet';

export default defineConfig({
  plugins: [importCSSSheet()]
});
