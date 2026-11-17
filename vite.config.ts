import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { disabledHmrClient } from './scripts/vite-preview-client.mjs';
import { publicLandingPreload } from './scripts/vite-public-preload.mjs';

export default defineConfig(({ command }) => {
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      disabledHmrClient(),
      publicLandingPreload(),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        react: path.resolve(process.cwd(), 'node_modules/react'),
        'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom'),
      },
    },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'clsx',
        'tailwind-merge',
        'lucide-react',
        'framer-motion',
        'framer-motion/m',
        'firebase/app',
        'firebase/auth',
        'firebase/app-check',
        '@sentry/react',
      ],
    },
    build: {
      manifest: true,
      outDir: 'dist',
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: hmrDisabled ? (false as const) : undefined,
    },
  };
});
