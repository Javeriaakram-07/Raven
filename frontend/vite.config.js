import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Middleware that serves static HTML files from public/docs
// before Vite's SPA fallback can intercept the request.
function docsMiddleware() {
  return {
    name: 'docs-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/docs')) return next();

        // Try to resolve to a file in public/docs
        const publicDir = path.resolve(__dirname, 'public');
        let filePath = path.join(publicDir, url);

        // Clean URL: /docs -> /docs/index.html, /docs/about -> /docs/about/index.html
        if (!filePath.endsWith('.html') && !filePath.endsWith('.css')) {
          const withIndex = path.join(filePath, 'index.html');
          if (fs.existsSync(withIndex)) filePath = withIndex;
          else if (fs.existsSync(filePath + '.html')) filePath = filePath + '.html';
        }

        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mime = ext === '.css' ? 'text/css' : 'text/html';
          res.setHeader('Content-Type', mime + '; charset=utf-8');
          res.end(fs.readFileSync(filePath));
          return;
        }

        next();
      });
    },
  };
}

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');

export default defineConfig({
  plugins: [react(), docsMiddleware()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',  // allow Set-Cookie to pass through proxy
      },
    },
  },
});
