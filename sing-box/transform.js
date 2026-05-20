const { type, name } = $arguments

const compatibleOutbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

let hasCompatibleOutbound = false
const config = JSON.parse($files[0])
const proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

config.outbounds.push(...proxies)

config.outbounds.forEach(outbound => {
  if (['all', 'all-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies))
  }
  if (['hk', 'hk-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies, /港|hk|hongkong|kong kong|🇭🇰/i))
  }
  if (['tw', 'tw-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/i))
  }
  if (['jp', 'jp-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies, /日本|jp|japan|🇯🇵/i))
  }
  if (['sg', 'sg-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  if (['us', 'us-auto'].includes(outbound.tag)) {
    outbound.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
  }
})

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!hasCompatibleOutbound) {
      config.outbounds.push(compatibleOutbound)
      hasCompatibleOutbound = true
    }
    outbound.outbounds.push(compatibleOutbound.tag)
  }
})

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(proxy => regex.test(proxy.tag)) : proxies).map(proxy => proxy.tag)
}
