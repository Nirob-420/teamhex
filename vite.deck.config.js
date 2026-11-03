/**
 * Preview-only Vite config for the Bangladesh hyper deck.
 *
 * `npm run dev` still serves the TEAM HEX site from vite.config.js. This config
 * exists so the live preview opens straight on the animated deck at `/` instead
 * of the homepage. The site itself remains reachable at `/index.html`.
 *
 *   npx vite --config vite.deck.config.js
 */
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    {
      name: 'bangladesh-deck-root',
      configureServer(server) {
        // Runs before Vite's own middlewares, so the HTML fallback sees the
        // deck path and serves it as a real page.
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url?.startsWith('/?')) req.url = '/bangladesh.html';
          next();
        });
      },
    },
  ],
});
