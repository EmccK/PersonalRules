# PersonalRules

个人 Mihomo/Clash 规则仓库，运行时规则优先引用当前仓库，减少对外部规则仓库的直接依赖。

## 文件说明

- `clash/override.yaml`：Mihomo 覆写配置，包含策略组、规则引用、TUN 和 DNS 防泄漏配置
- `clash/direct.yaml`：个人直连规则
- `clash/proxy.yaml`：个人代理规则
- `clash/claude.yaml`：个人 Claude 代理规则
- `mihomo/domain/*.txt`：自托管域名规则
- `mihomo/ip/*.txt`：自托管 IP 规则
- `sing-box/transform.js`：Sing-box 转换脚本
- `scripts/sync-rules.mjs`：同步上游规则到当前仓库
- `scripts/validate.mjs`：校验规则和配置一致性

## 使用

Mihomo 覆写配置：

```text
https://raw.githubusercontent.com/EmccK/PersonalRules/refs/heads/main/clash/override.yaml
```

同步规则：

```bash
npm run sync
```

校验配置：

```bash
npm run validate
```

## 防泄漏策略

`clash/override.yaml` 默认启用：

- `tun.dns-hijack` 劫持 53 端口 DNS 查询
- `dns.enhanced-mode: fake-ip`
- `dns.respect-rules: true`
- 境外 DoH 显式使用 `#一键连`
- `direct-nameserver` 仅用于直连流量
- 海外 UDP/443 QUIC 默认拦截，减少规则绕过

规则文件同步到当前仓库后，运行时 `rule-providers` 只引用本仓库 raw 地址。外部上游只在 `npm run sync` 时使用；如果同步失败且本地已有规则，脚本会保留现有文件。

策略组参考 OneTouch 简化为：`一键连`、`人工智能`、`社交平台`、`国际媒体`、`国内流量`、`手动选择`。

## 自动化

- `.github/workflows/check.yml`：推送和 PR 时运行校验
- `.github/workflows/sync-rules.yml`：每天定时同步规则，存在变更时自动提交

默认上游为：

```text
https://raw.githubusercontent.com/666OS/rules/release/mihomo
```

如需换源，可设置环境变量：

```bash
RULES_UPSTREAM_BASE_URL=https://example.com/mihomo npm run sync
```
