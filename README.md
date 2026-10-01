# Codex Plus Usage Data

[中文](README.zh-CN.md) | English

An anonymized real-world ChatGPT Plus / Codex usage dataset collected from three Plus accounts used for coding and agent workflows.

**Live visualization:** https://codex-plus-usage.pages.dev/

The visualization source code and the public JSON files used by the page are included in this repository.

## Snapshot

Cutoff: **2026-09-29 22:41 (UTC+8)**

| Metric | Value |
| --- | ---: |
| Accounts | 3 |
| Requests | 15,188 |
| Total tokens | 2,990,722,734 |
| Input tokens | 235,179,076 |
| Output tokens | 6,231,274 |
| Cache read tokens | 2,749,312,384 |
| Cache hit | 92.12% |
| API-equivalent account cost | $3,232.20 |
| Tokens / $ | 925,291 |

These are real usage records from normal coding / agent work, not repeated benchmark prompts.

## Data

The canonical public snapshot is under `data/`.

- `data/latest.json` — sanitized usage snapshot, including weekly trees, account aliases, model and reasoning-effort rows.
- `data/context.json` — 1M / 272K context mapping and aggregated comparisons.
- `data/resets.json` — manually recorded Global Reset / Banked Grant events.
- `data/weekly.csv` — weekly summary.
- `data/accounts.csv` — anonymized account summary.
- `data/model.csv` — model summary.
- `data/model_effort.csv` — model × reasoning-effort summary.
- `data/model_effort_context.csv` — context × model × reasoning-effort summary.

See [Methodology](docs/methodology.md) for metric definitions and interpretation notes.

## Web visualization source

The deployed page at https://codex-plus-usage.pages.dev/ is a static HTML + JSON site.

Relevant files:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `data/*.json`
- `_headers`

The public page does not call the Sub2API admin API.

## Context mapping

GPT-6 Sol was used with **272K** context after its release.

For this snapshot:

- W1 → 1M
- W2 → 1M
- W3 / GPT-5.6 Sol → 1M
- W3 / GPT-6 Sol → 272K
- W4 / GPT-6 Sol → 272K

The context comparison is therefore an observational comparison of real usage periods, not a controlled A/B test. Model generation, pricing, task mix, cache behavior and request length also changed.

## Cost and cache metrics

`account_cost` is the API-equivalent cost calculated by Sub2API. It is **not** the ChatGPT Plus subscription charge.

`Token/$` is:

```text
total_tokens / account_cost
```

Cache hit is:

```text
cache_read_tokens
--------------------------------------------- × 100
input_tokens + cache_creation_tokens + cache_read_tokens
```

## Privacy

The public snapshot is intentionally anonymized:

- account names are replaced with aliases;
- account IDs are removed;
- quota snapshots are not published;
- admin endpoints are removed;
- OAuth data, tokens, credentials and other secrets are not included.

Do not upload the original Sub2API export directly without sanitizing it first.

## Verify

Requires Node.js 18+:

```bash
node scripts/verify.mjs
```

The script checks the main totals and the 1M / 272K aggregation against the published JSON snapshot.

## Repository layout

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
