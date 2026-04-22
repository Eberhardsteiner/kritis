import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build-Time-Injection für Version-Footer (src/lib/version.ts).
// Bei Dev-Runs und in Umgebungen ohne Git (z. B. Docker-Stage-Build
// ohne .git/) fallen die Werte auf sichere Defaults zurück.
function resolveBuildCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

const BUILD_COMMIT = resolveBuildCommit();
const BUILD_DATE = new Date().toISOString().split('T')[0];

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
        __APP_BUILD_DATE__: JSON.stringify(BUILD_DATE),
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true,
            },
        },
    },
});
