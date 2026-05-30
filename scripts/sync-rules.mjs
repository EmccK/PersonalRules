import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const upstreamBaseUrl = validateUpstreamUrl(
  process.env.RULES_UPSTREAM_BASE_URL || 'https://raw.githubusercontent.com/666OS/rules/release/mihomo',
)

// 校验上游 URL，仅允许 HTTPS 且禁止内网地址
function validateUpstreamUrl(raw) {
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    console.error(`上游 URL 无效：${raw}`)
    process.exit(1)
  }

  if (parsed.protocol !== 'https:') {
    console.error(`上游 URL 必须使用 HTTPS：${raw}`)
    process.exit(1)
  }

  const host = parsed.hostname
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host) ||
    host === '0.0.0.0'
  ) {
    console.error(`上游 URL 禁止指向内网地址：${raw}`)
    process.exit(1)
  }

  return parsed.href.replace(/\/$/, '')
}

const domainRules = [
  'Private',
  'Direct',
  'AppleCN',
  'Download',
  'XPTV',
  'AI',
  'Telegram',
  'SocialMedia',
  'YouTube',
  'Spotify',
  'Netflix',
  'Disney',
  'HBO',
  'Proxy',
  'China',
]

const ipRules = [
  'Private',
  'Telegram',
  'SocialMedia',
  'Netflix',
  'Proxy',
  'China',
]

let failed = false

for (const name of domainRules) {
  await syncRule(`domain/${name}.txt`)
}

for (const name of ipRules) {
  await syncRule(`ip/${name}.txt`)
}

if (failed) {
  process.exit(1)
}

console.log('规则同步完成')

async function syncRule(relativePath) {
  const url = `${upstreamBaseUrl}/${relativePath}`
  const target = `mihomo/${relativePath}`

  try {
    const content = await fetchText(url)
    const normalized = normalizeRuleFile(content, url)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, normalized)
    console.log(`已同步 ${target}`)
  } catch (error) {
    if (await fileExists(target)) {
      console.warn(`同步失败，保留已有文件：${target}（${error.message}）`)
      return
    }

    failed = true
    console.error(`同步失败，且本地文件不存在：${target}（${error.message}）`)
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'PersonalRules sync-rules',
    },
    redirect: 'error',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType && !contentType.startsWith('text/') && !contentType.includes('charset')) {
    throw new Error(`响应类型不是文本：${contentType}`)
  }

  return response.text()
}

function normalizeRuleFile(content, sourceUrl) {
  const body = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd()

  return [
    '# SOURCE: upstream synced by scripts/sync-rules.mjs',
    `# URL: ${sourceUrl}`,
    body,
    '',
  ].join('\n')
}

async function fileExists(file) {
  try {
    await readFile(file)
    return true
  } catch {
    return false
  }
}
