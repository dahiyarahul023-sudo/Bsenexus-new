import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {disabledHmrClient} from './scripts/vite-preview-client.mjs';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), disabledHmrClient()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
      dedupe: ['react', 'react-dom', 'react-dom/client', 'framer-motion', '@sentry/react'],
    },
    optimizeDeps: {
      // A static AI Studio preview cannot reload when late dependency discovery
      // replaces React's shared chunks. Prepare the complete browser set once.
      // devRuntime.test.ts rejects newly added runtime imports missing below.
      noDiscovery: true,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'framer-motion',
        'framer-motion/m',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'date-fns',
        'firebase/app',
        'firebase/auth',
        'firebase/app-check',
        '@sentry/react',
      ],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      manifest: true,
      minify: 'esbuild' as const,
      target: 'es2020',
      chunkSizeWarningLimit: 1200,
    },
    esbuild: {
      drop: ['console', 'debugger'] as ('console' | 'debugger')[],
    },
  };
});
