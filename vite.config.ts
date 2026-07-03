import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// Only load inspect plugin in development
const inspectPlugin = (() => {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { inspectAttr } = require('kimi-plugin-inspect-react');
      return inspectAttr();
    } catch { /* ignore if not installed */ }
  }
  return null;
})();

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    ...(inspectPlugin ? [inspectPlugin] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'GradeMaster A-Level备考管家',
        short_name: 'GradeMaster',
        description: 'A-Level备考管家 - 分数线查询、等级预测、刷题规划一站式平台',
        theme_color: '#2C3E50',
        background_color: '#F0EDE8',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['education', 'productivity'],
        lang: 'zh-CN',
        dir: 'ltr',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Node modules chunking
          if (id.includes('node_modules')) {
            // Math libraries → function graph
            if (id.includes('mathjs')) return 'lib-math';
            // Charting libraries
            if (id.includes('recharts') || id.includes('d3')) return 'lib-charts';
            // Export libraries
            if (id.includes('jspdf')) return 'lib-export';
            if (id.includes('html2canvas')) return 'lib-export';
            if (id.includes('xlsx')) return 'lib-export';
            if (id.includes('dompurify')) return 'lib-export';
            // Date utilities
            if (id.includes('date-fns')) return 'lib-date';
            // React ecosystem
            if (id.includes('react-router') || id.includes('@remix-run')) return 'lib-router';
            // Other large libraries
            if (id.includes('lucide-react')) return 'lib-icons';
          }

          // Data file chunking — split large JSON data into separate chunks
          if (id.includes('/data/')) {
            if (id.includes('caie_al.json')) return 'data-caie-al';
            if (id.includes('edexcel_al.json')) return 'data-edexcel-al';
            if (id.includes('edexcel.json')) return 'data-edexcel-gcse';
            if (id.includes('caie.json')) return 'data-caie-gcse';
            if (id.includes('aqa.json') && !id.includes('aqa_al')) return 'data-aqa-gcse';
            if (id.includes('aqa_al.json')) return 'data-aqa-al';
            if (id.includes('ocr.json') && !id.includes('ocr_al')) return 'data-ocr-gcse';
            if (id.includes('ocr_al.json')) return 'data-ocr-al';
            if (id.includes('resultStatistics')) return 'data-result-stats';
            if (id.includes('plannerData.json')) return 'data-planner';
            if (id.includes('subjects_config.json')) return 'data-planner';
            if (id.includes('calculatorIndex')) return 'data-calculator';
            if (id.includes('paperBoundaries')) return 'data-paper-boundaries';
            if (id.includes('paperMetadata')) return 'data-paper-meta';
            if (id.includes('personalityData')) return 'data-personality';
          }

          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
