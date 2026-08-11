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
    alias: {
      '@': resolve(__dirname, 'src/renderer/src')
    }
  },
  root: resolve(__dirname, 'src/renderer'),
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
          'vendor-liquid-glass': ['@wxperia/liquid-glass-vue']
        }
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
