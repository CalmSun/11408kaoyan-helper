#!/usr/bin/env node
/**
 * copy-pdfjs-assets.mjs
 * v3.5.2：将 pdfjs-dist 的 CMap 与标准字体数据复制到 Vite 的 public 目录。
 *
 * 背景：open-file-viewer 的 pdfPlugin 默认从 jsDelivr CDN 加载 CMap/标准字体，
 * 考研 PDF 多为中文 CID 字体，解码强依赖 CMap；离线或国内网络下 CDN 不可达
 * 会导致页面级报错「无法渲染该页面……」。这里把资源本地化：
 *   src/renderer/public/pdfjs/cmaps/          （.bcmap 打包格式，169 个）
 *   src/renderer/public/pdfjs/standard_fonts/ （.pfb 标准 14 字体，16 个）
 * Vite 会把 public 原样拷入 dist/renderer（prod），dev 模式由 vite 直接服务。
 *
 * 通过 package.json 的 predev / prebuild 钩子自动执行。
 */
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcCmaps = join(root, 'node_modules/pdfjs-dist/cmaps')
const srcFonts = join(root, 'node_modules/pdfjs-dist/standard_fonts')
const destBase = join(root, 'src/renderer/public/pdfjs')

for (const [src, sub] of [[srcCmaps, 'cmaps'], [srcFonts, 'standard_fonts']]) {
  const dest = join(destBase, sub)
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`[copy-pdfjs-assets] ${src} -> ${dest}`)
}
console.log('[copy-pdfjs-assets] done')
