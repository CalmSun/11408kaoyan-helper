// 从 Electron 版源码提取静态数据，生成 Flutter 的 kaoyan_data.json。
// 用法：node tools/extract_data.mjs
import fs from 'node:fs'

const root = process.cwd()

const targets = [
  { file: 'src/renderer/src/data/math-outline.ts', names: ['mathOutline'] },
  { file: 'src/renderer/src/data/politics-outline.ts', names: ['politicsOutline'] },
  { file: 'src/renderer/src/data/math-formulas.ts', names: ['mathFormulas'] },
  { file: 'src/renderer/src/data/english-formulas.ts', names: ['englishFormulas'] },
  { file: 'src/renderer/src/data/politics-formulas.ts', names: ['politicsFormulas'] },
  { file: 'src/renderer/src/views/Outline.vue', names: ['dataStructOutline', 'compositionOutline', 'osOutline', 'networkOutline'] },
  { file: 'src/renderer/src/views/Algorithms.vue', names: ['builtinAlgorithms'] },
  { file: 'src/renderer/src/views/Formulas.vue', names: ['builtinFormulas'] },
  { file: 'src/renderer/src/views/Dictionary.vue', names: ['wordDatabase'] },
]

// 括号匹配提取数组字面量（兼容字符串/模板字符串内的括号）
function extractArrayLiteral(src, name) {
  const re = new RegExp('(?:export\\s+)?const\\s+' + name + '\\b[^=]*=\\s*')
  const m = src.match(re)
  if (!m) throw new Error('未找到声明: ' + name)
  const start = src.indexOf('[', m.index + m[0].length)
  if (start === -1) throw new Error(name + ' 不是数组字面量')
  let depth = 0
  let inStr = null
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') { i += 2; continue }
      if (c === inStr) inStr = null
    } else {
      if (c === '"' || c === "'" || c === '`') inStr = c
      else if (c === '[') depth++
      else if (c === ']') { depth--; if (depth === 0) break }
    }
    i++
  }
  if (depth !== 0) throw new Error(name + ' 括号不匹配')
  return src.slice(start, i + 1)
}

function evalLiteral(literal) {
  if (literal.includes('${')) {
    throw new Error('检测到模板字符串插值，请人工处理')
  }
  // 仅允许字面量，无函数调用，安全求值
  const fn = new Function('return (' + literal + ')')
  return fn()
}

const out = {}
for (const t of targets) {
  const src = fs.readFileSync(root + '/' + t.file, 'utf8')
  for (const name of t.names) {
    const literal = extractArrayLiteral(src, name)
    out[name] = evalLiteral(literal)
    console.log(`  ${name.padEnd(22)} ${String(out[name].length).padStart(4)} items  (${t.file})`)
  }
}

// 组合 408 大纲：数据结构/组成原理/操作系统/计算机网络
const flat = (arr) => arr.flatMap((ch) =>
  ch.sections.map((s) => ({ title: `${ch.title} - ${s.title}`, points: s.points }))
)
out.cs408Outline = [
  { title: '第一部分 数据结构（约45分）', weight: '45', sections: flat(out.dataStructOutline) },
  { title: '第二部分 计算机组成原理（约45分）', weight: '45', sections: flat(out.compositionOutline) },
  { title: '第三部分 操作系统（约35分）', weight: '35', sections: flat(out.osOutline) },
  { title: '第四部分 计算机网络（约25分）', weight: '25', sections: flat(out.networkOutline) },
]
console.log(`  cs408Outline            ${out.cs408Outline.length} parts`)

const outDir = root + '/flutter-app/assets/data'
fs.mkdirSync(outDir, { recursive: true })
const outPath = outDir + '/kaoyan_data.json'
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8')
const size = (fs.statSync(outPath).size / 1024).toFixed(1)
console.log(`\n已写入 ${outPath} (${size} KB)`)
