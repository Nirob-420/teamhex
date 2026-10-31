import { defineConfig } from 'vite';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

// Honest, persistent local-preview counter. The deployed site uses Netlify Blobs.
function previewVisitorCounter() {
  const file = resolve(process.cwd(), '.data/visitor-count.json');
  let queue = Promise.resolve();
  const middleware = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/visits') return next();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Visitor-API', 'hex-v2');
    if (!['GET', 'POST'].includes(req.method)) {
      res.statusCode = 405; res.end(JSON.stringify({ error: 'Method not allowed' })); return;
    }
    const task = queue.then(async () => {
      await mkdir(resolve(process.cwd(), '.data'), { recursive: true });
      let count = 0;
      try { const saved = JSON.parse(await readFile(file, 'utf8')); if (Number.isSafeInteger(saved.count) && saved.count >= 0) count = saved.count; } catch { /* First visit. */ }
      if (req.method === 'POST') {
        count += 1;
        await writeFile(`${file}.tmp`, JSON.stringify({ count }), 'utf8');
        await rename(`${file}.tmp`, file);
      }
      res.end(JSON.stringify({ count, mode: 'preview' }));
    });
    queue = task.catch(() => {});
    try { await task; } catch {
      res.statusCode = 503; res.end(JSON.stringify({ error: 'Preview counter unavailable' }));
    }
  };
  return {
    name: 'team-hex-preview-visits',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [previewVisitorCounter()],
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/')) return 'three';
          if (id.includes('/gsap/') || id.includes('/lenis/')) return 'animation';
        },
      },
    },
  },
});
