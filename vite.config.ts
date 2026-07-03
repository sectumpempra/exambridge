import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [inspectAttr(), react()],
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
