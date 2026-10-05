# Metrics

[中文](metrics.zh-CN.md) | English

This repository uses two groups of metrics: quota-efficiency metrics and request-performance metrics.

## Quota efficiency

Sub2API records the upstream subscription-window utilization observed after requests:

- `subscription_5h_used_percent`
- `subscription_7d_used_percent`

The same fields are available for Codex subscription traffic and Claude subscription traffic when the upstream returns the corresponding utilization headers.

### Tokens / 1%

For a monotonic portion of one quota window:

```text
Tokens / 1% = token delta / utilization-percent delta
```

The public aggregation should report both:

- weighted Tokens / 1%;
- median segment Tokens / 1%;
- observed percent span and sample count.

Small negative percentage changes caused by concurrent/out-of-order observations are ignored. A large percentage drop is treated as a new quota window.

### 100% equivalent tokens

```text
5h 100% equivalent tokens = 5h Tokens / 1% × 100
7d 100% equivalent tokens = 7d Tokens / 1% × 100
```

This is an observed full-window equivalent, not an official token quota. Subscription quotas can depend on model, reasoning effort, cache behavior, output mix and other upstream weighting.

For that reason, this repository prefers the name **100% equivalent tokens** over “quota size”.

### Useful companion metrics

To explain quota burn, compare Tokens / 1% with:

- cache hit rate;
- input tokens / 1%;
- cache-read tokens / 1%;
- output tokens / 1%;
- API-equivalent cost / 1%;
- model and reasoning-effort mix.

These metrics are observational and should not be interpreted as the upstream provider's internal quota formula.

## Request performance

Sub2API derives request-performance metrics from `duration_ms`, `first_token_ms` and token counts.

### TTFT

`first_token_ms` is time to first output token.

It includes everything before the first visible output reaches the gateway: queueing, upstream request latency, prefill and any model work performed before output begins.

Lower is better for perceived responsiveness.

### E2E

`duration_ms` is total request duration.

E2E depends heavily on output length, so it should not be compared without also looking at output tokens.

### Output TPS

For a streaming request:

```text
decode_ms = duration_ms - first_token_ms
output_tps = output_tokens / (decode_ms / 1000)
```

This measures generation speed after the first token.

### TPOT

```text
tpot_ms = decode_ms / output_tokens
```

TPOT and Output TPS contain almost the same information:

```text
TPOT ≈ 1000 / Output TPS
```

For headline comparisons, TTFT + Output TPS are usually more useful than showing both TPS and TPOT. E2E should be paired with output-token count.

### Aggregation

Latency and speed are heavy-tailed. Provider/model comparisons should prefer percentiles over a single arithmetic mean:

- P50;
- P90;
- P95 when sample count is large enough.

The recommended summary dimensions are provider × model × reasoning effort, optionally split by context setting for Codex.
