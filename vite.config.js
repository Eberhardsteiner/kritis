import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8787',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const normalizedId = id.split('\\').join('/');

                    if (normalizedId.includes('/node_modules/')) {
                        if (normalizedId.includes('/lucide-react/')) {
                            return 'vendor-icons';
                        }
                        if (normalizedId.includes('/jspdf/')) {
                            return 'vendor-jspdf';
                        }
                        if (normalizedId.includes('/html2canvas/')) {
                            return 'vendor-html2canvas';
                        }
                        if (normalizedId.includes('/dompurify/')) {
                            return 'vendor-dompurify';
                        }
                        return 'vendor';
                    }

                    if (normalizedId.includes('/src/module-packs/')) {
                        return 'module-packs';
                    }

                    if (normalizedId.includes('/src/data/')) {
                        return 'app-data';
                    }
                },
            },
        },
    },
});
