import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * The CSP in index.html is strict and ships unchanged in the production build.
 * The dev server needs an inline React Refresh preamble, injected <style> tags
 * and an HMR websocket, so the policy is relaxed in memory while serving only.
 */
function devCspRelaxation(): Plugin {
  return {
    name: 'financier:dev-csp-relaxation',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws: wss:");
    },
  };
}

export default defineConfig({
  base: '/financier/',
  plugins: [
    devCspRelaxation(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Financier',
        short_name: 'Financier',
        description: 'Private, offline personal finance with Kipp the Chameleon.',
        lang: 'en',
        start_url: '/financier/',
        scope: '/financier/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1120',
        background_color: '#0b1120',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Only Latin subsets are needed offline (Turkish lives in latin-ext);
        // other scripts fall back to the system font when offline.
        globIgnores: ['**/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
  },
});
