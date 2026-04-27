import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SERVER_PORT ?? 8787}`,
        changeOrigin: true,
      },
    },
  },
});
