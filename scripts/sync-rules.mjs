import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const upstreamBaseUrl = process.env.RULES_UPSTREAM_BASE_URL || 'https://raw.githubusercontent.com/666OS/rules/release/mihomo'

const domainRules = [
  'Advertising',
  'Tracking',
  'Private',
  'Direct',
  'Download',
  'AppleCN',
  'China',
  'AI',
  'Claude',
  'OpenAI',
  'Gemini',
  'Telegram',
  'Twitter',
  'Instagram',
  'Facebook',
  'SocialMedia',
  'YouTube',
  'Netflix',
  'Disney',
  'HBO',
  'Spotify',
  'Emby',
  'Streaming',
  'Google',
  'Microsoft',
  'OneDrive',
  'GitHub',
  'Cloudflare',
  'Proxy',
]

const ipRules = [
  'Advertising',
  'Private',
  'AI',
  'Telegram',
  'SocialMedia',
  'Facebook',
  'Streaming',
  'Netflix',
  'Emby',
  'Google',
  'Cloudflare',
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
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
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
