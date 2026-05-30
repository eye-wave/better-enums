import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { betterEnums } from"./better-enum"

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'test/main.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  plugins: [betterEnums()]
});
