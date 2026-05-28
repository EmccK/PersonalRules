import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repositoryRawPrefix = 'https://raw.githubusercontent.com/EmccK/PersonalRules/refs/heads/main/'
const builtinTargets = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS'])
const textRoots = [
  '.editorconfig',
  '.gitignore',
  '.github',
  'AGENTS.md',
  'README.md',
  'clash',
  'mihomo',
  'package.json',
  'scripts',
  'sing-box',
]

let failed = false

for (const file of await collectTextFiles()) {
  await validateTextFile(file)
}

for (const file of ['clash/claude.yaml', 'clash/direct.yaml', 'clash/proxy.yaml']) {
  await validateClashRulePayload(file)
}

for (const file of await collectRuleTextFiles('mihomo/domain')) {
  await validatePlainRuleFile(file)
}

for (const file of await collectRuleTextFiles('mihomo/ip')) {
  await validatePlainRuleFile(file)
}

await validateJson('package.json')

for (const file of ['scripts/sync-rules.mjs', 'scripts/validate.mjs', 'sing-box/transform.js']) {
  await checkJavaScript(file)
}

await validateOverride('clash/override.yaml')

if (failed) {
  process.exit(1)
}

console.log('校验通过')

async function collectTextFiles() {
  const files = []

  for (const root of textRoots) {
    if (!(await exists(root))) {
      continue
    }

    const rootStat = await stat(root)
    if (rootStat.isDirectory()) {
      files.push(...await walk(root))
      continue
    }

    files.push(root)
  }

  return files.sort()
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await walk(path))
      continue
    }

    if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

async function validateTextFile(file) {
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

async function validateClashRulePayload(file) {
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

async function collectRuleTextFiles(dir) {
  if (!(await exists(dir))) {
    return []
  }

  return (await walk(dir)).filter(file => file.endsWith('.txt')).sort()
}

async function validatePlainRuleFile(file) {
  const content = await readFile(file, 'utf8')
  const seen = new Map()
  let payloadCount = 0

  content.split('\n').forEach((line, index) => {
    const rule = line.trim()
    if (!rule || rule.startsWith('#')) {
      return
    }

    payloadCount += 1
    if (seen.has(rule)) {
      fail(`${file}:${index + 1} 规则重复，首次出现于第 ${seen.get(rule)} 行：${rule}`)
      return
    }

    seen.set(rule, index + 1)
  })

  if (payloadCount === 0) {
    fail(`${file} 没有有效规则`)
  }
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

async function validateOverride(file) {
  const content = await readFile(file, 'utf8')
  const providers = parseProviders(content)
  const rules = parseListSection(content, 'rules')
  const proxyGroups = parseProxyGroups(content)
  const groupNames = new Set(proxyGroups.map(group => group.name))

  for (const rule of rules) {
    const [type, provider, target] = rule.split(',')

    if (type === 'RULE-SET') {
      if (!providers.has(provider)) {
        fail(`${file} 规则引用了不存在的 rule-provider：${provider}`)
      }

      validateRuleTarget(file, rule, target, groupNames)
    }

    if (type === 'MATCH') {
      validateRuleTarget(file, rule, provider, groupNames)
    }
  }

  for (const [name, provider] of providers) {
    if (!provider.url) {
      fail(`${file} rule-provider 缺少 url：${name}`)
      continue
    }

    if (!provider.url.startsWith(repositoryRawPrefix)) {
      fail(`${file} rule-provider 运行时只能引用当前仓库 raw：${name}`)
      continue
    }

    const localPath = provider.url.slice(repositoryRawPrefix.length)
    if (!(await exists(localPath))) {
      fail(`${file} rule-provider 本地文件不存在：${name} -> ${localPath}`)
    }
  }

  for (const group of proxyGroups) {
    for (const proxy of group.proxies) {
      if (builtinTargets.has(proxy) || groupNames.has(proxy)) {
        continue
      }

      fail(`${file} 策略组 ${group.name} 引用了不存在的策略组：${proxy}`)
    }
  }

  if (!content.includes('respect-rules: true')) {
    fail(`${file} dns.respect-rules 未开启`)
  }

  if (!content.includes('proxy-server-nameserver:')) {
    fail(`${file} 开启 respect-rules 时需要配置 proxy-server-nameserver`)
  }

  if (!content.includes('#一键连')) {
    fail(`${file} 境外 DNS 未显式指定一键连出口`)
  }
}

function validateRuleTarget(file, rule, target, groupNames) {
  if (!target || builtinTargets.has(target) || groupNames.has(target)) {
    return
  }

  fail(`${file} 规则目标不存在：${rule}`)
}

function parseProviders(content) {
  const providers = new Map()
  const lines = getSectionLines(content, 'rule-providers')
  let current = null

  for (const line of lines) {
    const providerMatch = line.match(/^  ([^:\s][^:]*):\s*$/)
    if (providerMatch) {
      current = providerMatch[1]
      providers.set(current, {})
      continue
    }

    const fieldMatch = line.match(/^    ([^:\s]+):\s*(.+)$/)
    if (current && fieldMatch) {
      providers.get(current)[fieldMatch[1]] = fieldMatch[2].trim()
    }
  }

  return providers
}

function parseListSection(content, sectionName) {
  return getSectionLines(content, sectionName)
    .map(line => line.match(/^  -\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean)
}

function parseProxyGroups(content) {
  const groups = []
  const lines = getSectionLines(content, 'proxy-groups')
  let current = null
  let inProxies = false

  for (const line of lines) {
    const nameMatch = line.match(/^  - name:\s*(.+)$/)
    if (nameMatch) {
      current = { name: nameMatch[1].trim(), proxies: [] }
      groups.push(current)
      inProxies = false
      continue
    }

    if (!current) {
      continue
    }

    if (/^    proxies:\s*$/.test(line)) {
      inProxies = true
      continue
    }

    if (/^    [^-\s][^:]*:/.test(line)) {
      inProxies = false
    }

    const proxyMatch = line.match(/^      -\s+(.+)$/)
    if (inProxies && proxyMatch) {
      current.proxies.push(proxyMatch[1].trim())
    }
  }

  return groups
}

function getSectionLines(content, sectionName) {
  const lines = content.split('\n')
  const start = lines.findIndex(line => line === `${sectionName}:`)

  if (start === -1) {
    fail(`clash/override.yaml 缺少 ${sectionName} 段`)
    return []
  }

  const section = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (/^[^\s].*:/.test(line)) {
      break
    }
    section.push(line)
  }

  return section
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function fail(message) {
  failed = true
  console.error(`校验失败：${message}`)
}
