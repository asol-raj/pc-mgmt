// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// Keeps `astro dev` honest: the dev server brings the schema up to date on boot,
// the same way server.mjs does in production.
const migrateOnDevStart = {
  name: 'pcmgmt-migrate',
  hooks: {
    'astro:server:setup': async () => {
      const { runMigrations } = await import('./scripts/migrate.mjs');
      await runMigrations();
    },
  },
};

// https://astro.build/config
export default defineConfig({
  output: 'server',

  server: {
    host: true,
    port: 7100,
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [migrateOnDevStart],

  adapter: node({
    mode: 'standalone'
  })
});