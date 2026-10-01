// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages: https://tiesvdsar.github.io/financi-n_website/
export default defineConfig({
  site: 'https://tiesvdsar.github.io',
  base: '/financi-n_website',
  integrations: [sitemap()],
});
