// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import mdx from '@astrojs/mdx';

// GitHub Pages met eigen domein (ingesteld in de Pages-instellingen van de repo).
export default defineConfig({
  site: 'https://financien.tiesvandersar.nl',
  integrations: [sitemap(), mdx()],
});