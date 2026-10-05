# 指标说明

中文 | [English](metrics.md)

这个仓库后续主要看两类指标：**额度效率**和**请求性能**。

## 额度效率

Sub2API 现在会在每条用量记录里保存请求完成时看到的订阅窗口利用率：

- `subscription_5h_used_percent`
- `subscription_7d_used_percent`

Codex 和 Claude 的订阅账号都可以用同一套字段统计，只要上游响应里带了对应的窗口利用率。

### 每 1% 能跑多少 Token

在同一个额度窗口内，利用率正常单调上升的区间：

```text
Token / 1% = 这段增加的 Token / 这段增加的额度百分比
```

公开数据建议同时保留：

- 加权 Token / 1%
- 分段 Token / 1% 的中位数
- 实际覆盖的百分比区间
- 有效样本数

并发请求可能导致相邻记录出现很小的百分比回退，这种情况不当成重置；明显的大幅回落才切成新的额度窗口。

### 5 小时 / 每周 100% 等价 Token

```text
5h 100% 等价 Token = 5h Token / 1% × 100
7d 100% 等价 Token = 7d Token / 1% × 100
```

我更建议叫 **100% 等价 Token**，不要直接叫“额度大小”。

因为这不是 OpenAI / Anthropic 官方给出的固定 Token 上限。实际额度消耗还可能同时受模型、思考强度、缓存、Output 比例以及上游内部权重影响。

### 一起看的指标

如果要分析为什么某段额度掉得快，我觉得至少要一起看：

- Cache Hit
- Input Token / 1%
- Cache Read Token / 1%
- Output Token / 1%
- API 等价成本 / 1%
- 模型构成
- 思考强度构成

这样才能验证“High / XHigh 掉得快到底是不是因为缓存低、Output 多，还是上游本身对计算量有不同权重”。

这些都属于真实使用数据的观察结果，不代表上游官方额度算法。

## 请求性能

Sub2API 的性能数据由 `duration_ms`、`first_token_ms` 和 Token 数推导。

### 首字 / TTFT

`first_token_ms` 是从请求开始到第一个输出 Token 到达的时间。

它不只是网络延迟，还会包含排队、上游请求、Prefill，以及模型在真正开始输出前做的工作。

TTFT 越低，短请求的体感越快。

### 总耗时 / E2E

`duration_ms` 是整个请求完成的时间。

总耗时很受输出长度影响，所以不能脱离 Output Token 单独比较。

### Output TPS

流式请求：

```text
Decode 时间 = 总耗时 - 首字时间
Output TPS = Output Token / Decode 时间（秒）
```

它反映第一个 Token 出来以后，模型实际往外吐 Token 的速度。

### TPOT

```text
TPOT = Decode 时间 / Output Token
```

TPOT 和 TPS 基本是同一件事的两种表示：

```text
TPOT ≈ 1000 / TPS
```

所以如果做公开 Benchmark，我更倾向于把 **TTFT + TPS** 放在主指标里。TPOT 可以保留，但没必要和 TPS 同等突出。

E2E 最好同时带上 Output Token，否则很容易误判。

### 汇总方式

延迟数据长尾很明显，不建议只算一个平均值。

按 Provider / 模型 / 思考强度统计时，建议至少放：

- P50
- P90
- 样本足够时再放 P95

Codex 还可以继续按 1M / 272K 分开看。
