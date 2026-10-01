# 统计说明

中文 | [English](methodology.md)

## 数据来源

公开快照来自 Sub2API 的 Codex 周用量导出，生成时间：

```text
2026-09-29T14:41:06.722734505Z
```

也就是大约 **2026-09-29 22:41（UTC+8）**。

数据包含 3 个已经脱敏的 ChatGPT Plus 账号。

## Token 字段

- `input_tokens` — 非缓存 Input Token。
- `output_tokens` — Output Token。
- `cache_creation_tokens` — Cache Creation Token；这份快照中为 0。
- `cache_read_tokens` — Cache Read Token。
- `total_tokens` — Sub2API 报表统计的总 Token。

## 成本

成本字段是 Sub2API 根据 API 价格计算的等价成本。

它适合比较不同使用阶段的消耗，但不是 ChatGPT Plus 实际支付的订阅费用。

```text
tokens_per_usd = total_tokens / account_cost
```

## Cache Hit

公开数据中的 Cache Hit 计算方式：

```text
cache_read_tokens
------------------------------------------------
input_tokens + cache_creation_tokens + cache_read_tokens
```

Output Token 不放进 Cache Hit 的分母。

## 1M / 272K

这次用于公开的数据里，没有直接记录每个请求“配置了多大上下文窗口”的字段。

上下文维度是根据 Sub2API 的实际模型用量明细，再结合当时实际使用的上下文设置映射出来的：

- W1：1M
- W2：1M
- W3 / GPT-5.6 Sol：1M
- W3 / GPT-6 Sol：272K
- W4 / GPT-6 Sol：272K

所以 `context.json` 的 source 是：

```text
sub2api_snapshot_plus_historical_context_setting
```

不要把 `context.json` 理解成逐请求直接读取到的 Context Window。

## 思考强度

思考强度来自 Sub2API 导出的 usage rows。这份快照中不同模型出现过 `low`、`medium`、`high`、`xhigh`、`max`、`default`、`none`。

请求数量很少的分组只能作为小样本参考。

## Reset

这里把两类数据分开：

1. Sub2API 汇总里的 **Reset Card**
   - manual：手动用卡；
   - auto：Sub2API 自动用 Reset Card。

2. `resets.json` 中的 **Global Reset / Banked Grant**
   - 是人工记录的历史事件；
   - 不等于自然的 5 小时 / 7 天窗口重置；
   - 也不等于 Reset Card。

## W4

W4 在快照截止时间还是部分周，所以不能把 W4 总量和完整周直接当成同等时长比较。

## 脱敏

公开前做了这些处理：

- 真实账号名替换为别名；
- 删除 account ID；
- 删除 Quota 原始快照；
- 删除管理端地址；
- 不包含 OAuth、Token、凭据等敏感信息。

仓库只包含脱敏后的公开快照。
