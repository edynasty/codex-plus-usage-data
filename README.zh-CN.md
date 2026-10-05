# Codex Plus 使用数据

中文 | [English](README.md)

这是我在真实 Coding / Agent 工作流中产生的一份 ChatGPT Plus / Codex 脱敏使用数据，来自 3 个 Plus 账号。

**在线可视化：** https://codex-plus-usage.pages.dev/

在线页面的源码，以及页面使用的公开 JSON，也都放在这个仓库中。

## 数据快照

截止时间：**2026-09-29 22:41（UTC+8）**

| 指标 | 数值 |
| --- | ---: |
| 账号 | 3 |
| 请求数 | 15,188 |
| 总 Token | 2,990,722,734 |
| Input Token | 235,179,076 |
| Output Token | 6,231,274 |
| Cache Read | 2,749,312,384 |
| Cache Hit | 92.12% |
| API 等价 Account Cost | $3,232.20 |
| Token / $ | 925,291 |

这些都是平时真实 Coding / Agent 任务产生的数据，不是拿同一套题反复跑出来的 Benchmark。

## 公开数据

主要数据都在 `data/` 目录。

- `data/latest.json` — 脱敏后的完整快照，包含周、账号别名、模型、思考强度等数据。
- `data/context.json` — 1M / 272K 上下文映射和汇总数据。
- `data/resets.json` — 人工记录的 Global Reset / Banked Grant。
- `data/weekly.csv` — 每周汇总。
- `data/accounts.csv` — 脱敏账号汇总。
- `data/model.csv` — 模型汇总。
- `data/model_effort.csv` — 模型 × 思考强度。
- `data/model_effort_context.csv` — 上下文 × 模型 × 思考强度。

数据定义见 [统计说明](docs/methodology.zh-CN.md)，额度和性能指标见 [指标说明](docs/metrics.zh-CN.md)。

## 最新数据更新方式

现在仓库里已经加入 **Codex + Claude** 的脱敏导出和统计脚本。当前已经发布的主快照仍然是 2026-09-29 的 Codex 数据；要更新到最新数据，需要在已经登录 Sub2API 的浏览器里导出一次当前记录：

1. 打开已经登录的 Sub2API 管理页面。
2. 在这个页面的 DevTools Console 运行 `scripts/sub2api-browser-export.js`。
3. 浏览器会下载脱敏后的 `sub2api-public-source-YYYY-MM-DD.json`。
4. 再生成公开统计：

```bash
node scripts/build-current.mjs sub2api-public-source-YYYY-MM-DD.json data/current
```

导出脚本只借用当前浏览器登录状态访问本机 Sub2API API，不会把登录 Token、凭据、用户邮箱、Request ID、IP 或 User-Agent 写进公开文件。

生成的数据会同时包含 Codex 和 Claude，并统计模型、思考强度、额度效率和请求性能。

### 新增额度指标

只要 Sub2API 的用量记录中存在订阅窗口百分比，就会计算：

- **5h Token / 1%**
- **7d Token / 1%**
- **5h 100% 等价 Token**
- **7d 100% 等价 Token**
- Output Token / 1%
- Cache Read Token / 1%
- API 等价成本 / 1%

这里我更倾向叫“100% 等价 Token”，而不是直接叫“额度 Token”，因为它是根据真实利用率变化推算出来的观察值，不代表 OpenAI / Anthropic 官方存在一个固定 Token 上限。具体见 [指标说明](docs/metrics.zh-CN.md)。

### 请求性能

最新数据也会按 Provider / 模型 / 思考强度统计：

- TTFT / 首字时间
- E2E / 总耗时
- Output TPS
- TPOT
- Output Token 数

延迟和速度主要看 P50 / P90，比单独一个平均数更有参考价值。

## 在线页面源码

https://codex-plus-usage.pages.dev/ 是纯静态 HTML + JSON 页面。

对应源码就在仓库根目录：

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `data/*.json`
- `_headers`

公开页面不会直接访问 Sub2API 管理 API。

## 1M / 272K

GPT-6 Sol 发布以后，我一直使用 **272K**。

这份快照中的映射是：

- W1 → 1M
- W2 → 1M
- W3 / GPT-5.6 Sol → 1M
- W3 / GPT-6 Sol → 272K
- W4 / GPT-6 Sol → 272K

这里的数据是我真实使用阶段的记录，不是严格控制变量的 A/B 测试。期间模型、API 折算价格、任务类型、Cache Hit 和单次请求长度都发生了变化。

## Token/$ 和 Cache Hit

`account_cost` 是 Sub2API 按 API 价格折算出来的成本，**不是 ChatGPT Plus 实际订阅费用**。

`Token/$`：

```text
total_tokens / account_cost
```

Cache Hit：

```text
cache_read_tokens
--------------------------------------------- × 100
input_tokens + cache_creation_tokens + cache_read_tokens
```

## 隐私处理

公开数据已经做了脱敏：

- 真实账号名替换为别名；
- 删除账号 ID；
- 不公开 Quota 原始快照；
- 删除管理端地址；
- 不包含 OAuth 信息、Token、凭据和其他密钥。

原始 Sub2API 导出不能直接公开，必须先脱敏。

## 数据校验

Node.js 18+：

```bash
node scripts/verify.mjs
```

脚本会检查公开 JSON 中的主要总数，以及 1M / 272K 汇总是否能够重新合计到总快照。

## 目录

```text
.
├── README.md
├── README.zh-CN.md
├── index.html
├── _headers
├── assets/
│   ├── app.js
│   └── style.css
├── data/
│   ├── latest.json
│   ├── context.json
│   ├── resets.json
│   ├── weekly.csv
│   ├── accounts.csv
│   ├── model.csv
│   ├── model_effort.csv
│   └── model_effort_context.csv
├── docs/
│   ├── methodology.md
│   └── methodology.zh-CN.md
└── scripts/
    └── verify.mjs
```
