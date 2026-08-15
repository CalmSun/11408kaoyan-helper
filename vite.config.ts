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
      // v3.3.6：pdf.js 6.x 主构建使用 ES2025 Iterator 全局对象，
      //        Electron 28（Chromium 120）不支持，运行时报 ReferenceError: Iterator is not defined。
      //        解决：将所有 pdfjs-dist 导入重定向到 legacy 构建（为旧引擎转译，API 完全一致）。
      //        这会同时捕获 @tato30/vue-pdf 内部的 `import ... from "pdfjs-dist"` 和我们的 worker 导入。
      { find: /^pdfjs-dist$/, replacement: resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs') },
      { find: /^pdfjs-dist\/build\//, replacement: resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/') }
    ]
  },
  root: resolve(__dirname, 'src/renderer'),
  // v3.3.2：pdf.js 需要 top-level await 支持
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
    // 分包策略：将第三方依赖拆分为独立 chunk，提升缓存命中率与加载性能
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-element-plus': ['element-plus', '@element-plus/icons-vue'],
          'vendor-echarts': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          // v3.3.2：pdf.js 与 video.js 独立分包
          'vendor-pdf': ['@tato30/vue-pdf', 'pdfjs-dist'],
          'vendor-video': ['video.js', '@videojs-player/vue']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
