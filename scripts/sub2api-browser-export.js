(async () => {
  const API = '/api/v1';
  const START_DATE = '2026-09-05';
  const END_DATE = new Date().toISOString().slice(0, 10);
  const TIMEZONE = 'Asia/Shanghai';
  const token = localStorage.getItem('auth_token');
  if (!token) throw new Error('No auth_token in this Sub2API browser session.');

  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const unwrap = (x) => x && typeof x === 'object' && 'code' in x ? (x.code === 0 ? x.data : (() => { throw new Error(x.message || 'API error'); })()) : x;
  async function get(path, params = {}) {
    const u = new URL(API + path, location.origin);
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && u.searchParams.set(k, String(v)));
    const r = await fetch(u, { headers });
    const j = await r.json();
    if (!r.ok) throw new Error((j && j.message) || ('HTTP ' + r.status));
    return unwrap(j);
  }

  async function listAccounts(platform) {
    const all = [];
    for (let page = 1; ; page++) {
      const d = await get('/admin/accounts', { page, page_size: 50, platform, lite: 'true' });
      const items = d.items || [];
      all.push(...items);
      if (all.length >= (d.total || all.length) || items.length < 50) break;
    }
    return all;
  }

  const providers = [
    { key: 'codex', platform: 'openai' },
    { key: 'claude', platform: 'anthropic' }
  ];

  const accountDefs = [];
  for (const p of providers) {
    const items = await listAccounts(p.platform);
    let n = 0;
    for (const a of items) {
      n++;
      accountDefs.push({
        id: a.id,
        provider: p.key,
        alias: (p.key === 'codex' ? 'Codex ' : 'Claude ') + String.fromCharCode(64 + n),
        type: a.type || '',
        plan_type: a.plan_type || a.extra?.plan_type || a.credentials?.plan_type || '',
      });
    }
  }

  async function usageForAccount(a) {
    const rows = [];
    for (let page = 1; ; page++) {
      const d = await get('/admin/usage', {
        page, page_size: 100, exact_total: page === 1 ? 'true' : 'false',
        account_id: a.id, start_date: START_DATE, end_date: END_DATE,
        timezone: TIMEZONE, sort_by: 'created_at', sort_order: 'asc'
      });
      const items = d.items || [];
      for (const x of items) {
        rows.push({
          provider: a.provider,
          account: a.alias,
          created_at: x.created_at,
          model: x.model || '',
          requested_model: x.requested_model || '',
          upstream_model: x.upstream_model || '',
          reasoning_effort: x.reasoning_effort || '',
          upstream_reasoning_effort: x.upstream_reasoning_effort || '',
          input_tokens: Number(x.input_tokens || 0),
          output_tokens: Number(x.output_tokens || 0),
          cache_creation_tokens: Number(x.cache_creation_tokens || 0),
          cache_read_tokens: Number(x.cache_read_tokens || 0),
          total_tokens: Number(x.input_tokens || 0) + Number(x.output_tokens || 0) + Number(x.cache_creation_tokens || 0) + Number(x.cache_read_tokens || 0),
          total_cost: Number(x.total_cost || 0),
          actual_cost: Number(x.actual_cost || 0),
          account_cost: Number((x.account_stats_cost ?? x.total_cost) || 0) * Number(x.account_rate_multiplier ?? 1),
          duration_ms: x.duration_ms == null ? null : Number(x.duration_ms),
          first_token_ms: x.first_token_ms == null ? null : Number(x.first_token_ms),
          tpot_ms: x.tpot_ms == null ? null : Number(x.tpot_ms),
          output_tps: x.output_tps == null ? null : Number(x.output_tps),
          input_tps: x.input_tps == null ? null : Number(x.input_tps),
          total_tps: x.total_tps == null ? null : Number(x.total_tps),
          subscription_5h_used_percent: x.subscription_5h_used_percent == null ? null : Number(x.subscription_5h_used_percent),
          subscription_7d_used_percent: x.subscription_7d_used_percent == null ? null : Number(x.subscription_7d_used_percent),
          request_type: x.request_type || '',
          stream: !!x.stream
        });
      }
      const total = Number(d.total || rows.length);
      if (rows.length >= total || items.length < 100) break;
    }
    return rows;
  }

  const usage = [];
  for (const a of accountDefs) {
    console.log('Exporting', a.alias);
    usage.push(...await usageForAccount(a));
  }

  let codexWeekly = null;
  try {
    const raw = await get('/admin/codex/weekly-usage', {
      granularity: 'week', buckets: 12, levels: 'account,model,effort', type: 'oauth', timezone: TIMEZONE
    });
    const aliasById = new Map(accountDefs.filter(a => a.provider === 'codex').map(a => [String(a.id), a.alias]));
    const scrubNode = (node) => {
      const out = { ...node };
      if (out.kind === 'account') {
        const alias = aliasById.get(String(out.account_id)) || 'Codex account';
        out.key = alias;
        out.label = alias;
        out.account = alias;
      }
      delete out.account_id;
      delete out.account_name;
      delete out.quota;
      if (Array.isArray(out.children)) out.children = out.children.map(scrubNode);
      if (Array.isArray(out.groups)) out.groups = out.groups.map(scrubNode);
      return out;
    };
    codexWeekly = {
      generated_at: raw.generated_at,
      range: raw.range,
      summary: raw.summary,
      buckets: (raw.buckets || []).map(scrubNode),
      accounts: (raw.accounts || []).map(a => ({
        account: aliasById.get(String(a.account_id)) || 'Codex account',
        platform: 'openai',
        account_type: a.account_type,
        plan_type: a.plan_type,
        subscription_started_at: a.subscription_started_at,
        bucket_count: a.bucket_count,
        metrics: a.metrics,
        resets: a.resets,
        tokens_per_usd: a.tokens_per_usd,
        cache_hit_percent: a.cache_hit_percent
      }))
    };
  } catch (e) {
    console.warn('Codex weekly report export skipped:', e);
  }

  const quotaSnapshots = [];
  for (const a of accountDefs) {
    try {
      const q = await get('/admin/accounts/' + a.id + '/usage', { source: 'passive' });
      const safe = {
        provider: a.provider,
        account: a.alias,
        plan_type: q.plan_type || q.plan || a.plan_type || '',
        five_hour: q.five_hour ? {
          utilization: q.five_hour.utilization ?? q.five_hour.used_percent ?? null,
          resets_at: q.five_hour.resets_at ?? q.five_hour.reset_at ?? null
        } : null,
        seven_day: q.seven_day ? {
          utilization: q.seven_day.utilization ?? q.seven_day.used_percent ?? null,
          resets_at: q.seven_day.resets_at ?? q.seven_day.reset_at ?? null
        } : null,
        fetched_at: q.fetched_at || null
      };
      quotaSnapshots.push(safe);
    } catch {}
  }

  const out = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    range: { start_date: START_DATE, end_date: END_DATE, timezone: TIMEZONE },
    privacy: {
      account_names: 'aliased',
      account_ids: 'removed',
      user_emails: 'removed',
      api_keys: 'removed',
      request_ids: 'removed',
      ip_addresses: 'removed',
      user_agents: 'removed',
      credentials: 'removed'
    },
    accounts: accountDefs.map(({ id, ...x }) => x),
    quota_snapshots: quotaSnapshots,
    codex_weekly_report: codexWeekly,
    usage_logs: usage
  };

  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sub2api-public-source-' + END_DATE + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  console.log('Done:', usage.length, 'sanitized usage rows');
})().catch(e => console.error(e));