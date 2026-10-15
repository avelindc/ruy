import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
      '@config': path.resolve(projectRoot, 'src/config'),
      '@components': path.resolve(projectRoot, 'src/components'),
      '@contexts': path.resolve(projectRoot, 'src/contexts'),
      '@layouts': path.resolve(projectRoot, 'src/layouts'),
      '@pages': path.resolve(projectRoot, 'src/pages'),
      '@features': path.resolve(projectRoot, 'src/features'),
      '@hooks': path.resolve(projectRoot, 'src/hooks'),
      '@lib': path.resolve(projectRoot, 'src/lib'),
      '@services': path.resolve(projectRoot, 'src/services'),
      '@types': path.resolve(projectRoot, 'src/types'),
      '@utils': path.resolve(projectRoot, 'src/utils'),
      '@styles': path.resolve(projectRoot, 'src/styles'),
    },
  },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
