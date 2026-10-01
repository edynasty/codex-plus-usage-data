# Methodology

[中文](methodology.zh-CN.md) | English

## Source

The published snapshot is derived from a Sub2API Codex weekly usage export generated at:

```text
2026-09-29T14:41:06.722734505Z
```

The public cutoff is therefore approximately **2026-09-29 22:41 (UTC+8)**.

The dataset contains three anonymized ChatGPT Plus accounts.

## Main token fields

- `input_tokens` — non-cached input tokens.
- `output_tokens` — output tokens.
- `cache_creation_tokens` — cache creation tokens; zero in this snapshot.
- `cache_read_tokens` — cached input read tokens.
- `total_tokens` — total usage counted by the exported report.

## Cost

The cost fields are API-equivalent values calculated by Sub2API.

They are useful for comparing usage patterns but do not represent the fixed ChatGPT Plus subscription fee.

```text
tokens_per_usd = total_tokens / account_cost
```

## Cache hit

The published cache-hit percentage is calculated as:

```text
cache_read_tokens
------------------------------------------------
input_tokens + cache_creation_tokens + cache_read_tokens
```

Output tokens are not part of the cache-hit denominator.

## Context

The export used for the public dataset does not contain a direct per-request configured context-window field.

The context dimension is reconstructed from the actual model usage breakdown plus the context setting used at that time:

- W1: 1M
- W2: 1M
- W3 / GPT-5.6 Sol: 1M
- W3 / GPT-6 Sol: 272K
- W4 / GPT-6 Sol: 272K

This is why `context.json` uses the source label:

```text
sub2api_snapshot_plus_historical_context_setting
```

Do not interpret `context.json` as a direct per-request measurement of configured context length.

## Reasoning effort

Reasoning effort is taken from the usage rows exported by Sub2API. Values present in the snapshot include `low`, `medium`, `high`, `xhigh`, `max`, `default` and `none`, depending on model and request.

Small sample groups should be interpreted carefully.

## Resets

Two different concepts are kept separate:

1. **Reset Card usage** in the Sub2API usage summary:
   - manual;
   - auto, meaning Sub2API automatically used a Reset Card.

2. **Global Reset / Banked Grant** in `resets.json`:
   - manually recorded historical events;
   - not the same as natural quota-window reset;
   - not the same as Reset Card usage.

## Partial week

W4 is a partial week at the snapshot cutoff. Its totals should not be compared with complete weeks as if all periods had identical duration.

## Privacy transformation

Before publication:

- account names are aliased;
- account IDs are removed;
- quota snapshots are removed;
- admin endpoints are removed;
- credentials and OAuth data are excluded.

The repository contains only the public sanitized snapshot.
