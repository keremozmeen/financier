import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icons are generated locally at build time from public/kipp.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0b1120' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0b1120' } },
  },
  images: ['public/kipp.svg'],
});
