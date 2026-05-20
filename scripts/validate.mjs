import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const textFiles = [
  'README.md',
  'AGENTS.md',
  '.editorconfig',
  '.gitignore',
  'package.json',
  'clash/direct.yaml',
  'clash/proxy.yaml',
  'clash/override.yaml',
  'sing-box/transform.js',
  'scripts/validate.mjs',
  '.github/workflows/check.yml',
]

let failed = false

function fail(message) {
  failed = true
  console.error(`校验失败：${message}`)
}

for (const file of textFiles) {
  const content = await readFile(file, 'utf8')
  if (!content.endsWith('\n')) {
    fail(`${file} 缺少文件末尾换行`)
  }
  content.split('\n').forEach((line, index) => {
    if (/[ \t]$/.test(line)) {
      fail(`${file}:${index + 1} 存在行尾空白`)
    }
  })
}

for (const file of ['clash/direct.yaml', 'clash/proxy.yaml']) {
  await validateRulePayload(file)
}

await validateJson('package.json')
await checkJavaScript('sing-box/transform.js')

if (failed) {
  process.exit(1)
}

console.log('校验通过')

async function validateRulePayload(file) {
  const content = await readFile(file, 'utf8')
  const seen = new Map()

  content.split('\n').forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('- ')) {
      return
    }

    const rule = trimmed.slice(2).trim()
    if (!rule) {
      fail(`${file}:${index + 1} 规则为空`)
      return
    }

    if (seen.has(rule)) {
      fail(`${file}:${index + 1} 规则重复，首次出现于第 ${seen.get(rule)} 行：${rule}`)
      return
    }

    seen.set(rule, index + 1)
  })
}

async function validateJson(file) {
  const content = await readFile(file, 'utf8')
  try {
    JSON.parse(content)
  } catch (error) {
    fail(`${file} 不是合法 JSON：${error.message}`)
  }
}

async function checkJavaScript(file) {
  try {
    await execFileAsync('node', ['--check', file])
  } catch (error) {
    fail(`${file} 语法检查失败：${error.stderr || error.message}`)
  }
}
