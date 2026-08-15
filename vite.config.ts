import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [vue()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src/renderer/src') },
      // v3.3.9：pdf.js 6.x 主构建使用 ES2025 Iterator 全局对象，Electron 28 不支持。
      //        重定向到 legacy 构建（已验证无 Iterator.from/asyncIterator 使用）。
      //        仅使用 canvas 渲染（不调用 getTextContent），避免 async iterable 问题。
      { find: /^pdfjs-dist$/, replacement: resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs') },
      { find: /^pdfjs-dist\/build\//, replacement: resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/') + '/' }
    ]
  },
  root: resolve(__dirname, 'src/renderer'),
  // pdf.js legacy 构建可能需要 top-level await
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'top-level-await': true
      }
    }
  },
  esbuild: {
    supported: {
      'top-level-await': true
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-element-plus': ['element-plus', '@element-plus/icons-vue'],
          'vendor-echarts': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          'vendor-pdf': ['pdfjs-dist']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
