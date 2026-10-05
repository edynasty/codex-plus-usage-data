#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
const outDir = process.argv[3] || 'data/current';
if (!input) {
  console.error('Usage: node scripts/build-current.mjs <sub2api-public-source.json> [output-dir]');
  process.exit(2);
}
const src = JSON.parse(fs.readFileSync(input, 'utf8'));
const rows = Array.isArray(src.usage_logs) ? src.usage_logs : [];
fs.mkdirSync(outDir, { recursive: true });

const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const percentile = (xs, p) => {
  const a = xs.filter(Number.isFinite).sort((x,y)=>x-y);
  if (!a.length) return null;
  const i = (a.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
};
const median = xs => percentile(xs, .5);
const sum = (xs, f) => xs.reduce((a,x)=>a+n(f(x)),0);
const safeDiv = (a,b) => b > 0 ? a/b : null;
const cacheHit = rs => {
  const cr=sum(rs,r=>r.cache_read_tokens), inp=sum(rs,r=>r.input_tokens), cc=sum(rs,r=>r.cache_creation_tokens);
  return safeDiv(cr, inp+cc+cr) == null ? null : 100*cr/(inp+cc+cr);
};
const tpd = rs => safeDiv(sum(rs,r=>r.total_tokens), sum(rs,r=>r.account_cost));
const aggregate = rs => ({
  requests: rs.length,
  input_tokens: sum(rs,r=>r.input_tokens),
  output_tokens: sum(rs,r=>r.output_tokens),
  cache_creation_tokens: sum(rs,r=>r.cache_creation_tokens),
  cache_read_tokens: sum(rs,r=>r.cache_read_tokens),
  total_tokens: sum(rs,r=>r.total_tokens),
  account_cost: sum(rs,r=>r.account_cost),
  tokens_per_usd: tpd(rs),
  cache_hit_percent: cacheHit(rs),
});

const providers = [...new Set(rows.map(r=>r.provider).filter(Boolean))].sort();
const providerSummary = providers.map(provider => ({ provider, ...aggregate(rows.filter(r=>r.provider===provider)) }));

function groupBy(keys) {
  const m = new Map();
  for (const r of rows) {
    const vals = keys.map(k => String(r[k] ?? ''));
    const key = JSON.stringify(vals);
    if (!m.has(key)) m.set(key,{vals,rows:[]});
    m.get(key).rows.push(r);
  }
  return [...m.values()].map(g => Object.fromEntries([
    ...keys.map((k,i)=>[k,g.vals[i]]),
    ...Object.entries(aggregate(g.rows))
  ]));
}

const modelEffort = groupBy(['provider','model','reasoning_effort']);

const perfGroups = groupBy(['provider','model','reasoning_effort']).map(g => {
  const rs = rows.filter(r =>
    String(r.provider??'')===g.provider &&
    String(r.model??'')===g.model &&
    String(r.reasoning_effort??'')===g.reasoning_effort
  );
  const vals = key => rs.map(r=>r[key]).filter(v=>v!=null && Number.isFinite(Number(v))).map(Number);
  const ttft=vals('first_token_ms'), e2e=vals('duration_ms'), tps=vals('output_tps'), tpot=vals('tpot_ms'), out=vals('output_tokens');
  return {
    provider:g.provider, model:g.model, reasoning_effort:g.reasoning_effort,
    requests:rs.length,
    ttft_samples:ttft.length, ttft_p50_ms:percentile(ttft,.5), ttft_p90_ms:percentile(ttft,.9),
    e2e_samples:e2e.length, e2e_p50_ms:percentile(e2e,.5), e2e_p90_ms:percentile(e2e,.9),
    output_tps_samples:tps.length, output_tps_p50:percentile(tps,.5), output_tps_p90:percentile(tps,.9),
    tpot_samples:tpot.length, tpot_p50_ms:percentile(tpot,.5), tpot_p90_ms:percentile(tpot,.9),
    output_tokens_p50:percentile(out,.5), output_tokens_p90:percentile(out,.9),
    cache_hit_percent:cacheHit(rs), tokens_per_usd:tpd(rs)
  };
});

function quotaSegments(accountRows, field) {
  const sorted = accountRows
    .filter(r => r[field] != null && Number.isFinite(Number(r[field])))
    .slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const segs = [];
  let last = null, pending = {tokens:0,input:0,output:0,cache:0,cost:0,rows:0};
  const resetPending=()=>pending={tokens:0,input:0,output:0,cache:0,cost:0,rows:0};
  for (const r of sorted) {
    const pct=Number(r[field]);
    if (last == null) { last=pct; continue; }
    pending.tokens += n(r.total_tokens);
    pending.input += n(r.input_tokens);
    pending.output += n(r.output_tokens);
    pending.cache += n(r.cache_read_tokens);
    pending.cost += n(r.account_cost);
    pending.rows++;
    const delta=pct-last;
    if (delta > 0) {
      segs.push({
        start_percent:last,end_percent:pct,delta_percent:delta,
        requests:pending.rows,total_tokens:pending.tokens,input_tokens:pending.input,
        output_tokens:pending.output,cache_read_tokens:pending.cache,account_cost:pending.cost,
        tokens_per_percent:pending.tokens/delta,
        input_tokens_per_percent:pending.input/delta,
        output_tokens_per_percent:pending.output/delta,
        cache_read_tokens_per_percent:pending.cache/delta,
        cost_per_percent:pending.cost/delta,
      });
      last=pct; resetPending();
    } else if (delta <= -10) {
      // Large fall means a new 5h/7d window. The crossing segment cannot be attributed reliably.
      last=pct; resetPending();
    }
    // Small negative observations are treated as out-of-order/concurrency noise:
    // keep the previous high-watermark and continue accumulating tokens.
  }
  return segs;
}

const quota = [];
for (const provider of providers) {
  for (const account of [...new Set(rows.filter(r=>r.provider===provider).map(r=>r.account))].sort()) {
    const ars=rows.filter(r=>r.provider===provider&&r.account===account);
    for (const [window,field] of [['5h','subscription_5h_used_percent'],['7d','subscription_7d_used_percent']]) {
      const segs=quotaSegments(ars,field);
      const dp=sum(segs,s=>s.delta_percent), tok=sum(segs,s=>s.total_tokens);
      const inp=sum(segs,s=>s.input_tokens), out=sum(segs,s=>s.output_tokens), cr=sum(segs,s=>s.cache_read_tokens), cost=sum(segs,s=>s.account_cost);
      const weighted=safeDiv(tok,dp);
      quota.push({
        provider,account,window,
        segment_count:segs.length,
        observed_percent_span:dp,
        tokens_per_1pct_weighted:weighted,
        tokens_per_1pct_median:median(segs.map(s=>s.tokens_per_percent)),
        equivalent_100pct_tokens:weighted==null?null:weighted*100,
        input_tokens_per_1pct:safeDiv(inp,dp),
        output_tokens_per_1pct:safeDiv(out,dp),
        cache_read_tokens_per_1pct:safeDiv(cr,dp),
        api_equivalent_cost_per_1pct:safeDiv(cost,dp),
      });
    }
  }
}

const quotaProvider = [];
for (const provider of providers) {
  for (const window of ['5h','7d']) {
    const qs=quota.filter(q=>q.provider===provider&&q.window===window&&q.tokens_per_1pct_weighted!=null);
    const weights=qs.map(q=>q.observed_percent_span);
    const wsum=weights.reduce((a,b)=>a+b,0);
    const weighted = wsum ? qs.reduce((a,q)=>a+q.tokens_per_1pct_weighted*q.observed_percent_span,0)/wsum : null;
    quotaProvider.push({
      provider,window,accounts:qs.length,
      observed_percent_span:wsum,
      tokens_per_1pct_weighted:weighted,
      tokens_per_1pct_account_median:median(qs.map(q=>q.tokens_per_1pct_weighted)),
      equivalent_100pct_tokens:weighted==null?null:weighted*100,
      output_tokens_per_1pct_weighted: wsum ? qs.reduce((a,q)=>a+n(q.output_tokens_per_1pct)*q.observed_percent_span,0)/wsum : null,
      cache_read_tokens_per_1pct_weighted: wsum ? qs.reduce((a,q)=>a+n(q.cache_read_tokens_per_1pct)*q.observed_percent_span,0)/wsum : null,
      api_equivalent_cost_per_1pct_weighted: wsum ? qs.reduce((a,q)=>a+n(q.api_equivalent_cost_per_1pct)*q.observed_percent_span,0)/wsum : null,
    });
  }
}

const current = {
  schema_version:1,
  generated_at:src.generated_at,
  range:src.range,
  source:'sanitized_sub2api_browser_export',
  providers:providerSummary,
  accounts:src.accounts||[],
  quota_snapshots:src.quota_snapshots||[],
};
fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(current,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'model_effort.json'),JSON.stringify(modelEffort,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'performance.json'),JSON.stringify(perfGroups,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'quota_efficiency.json'),JSON.stringify({by_account:quota,by_provider:quotaProvider},null,2)+'\n');

function csv(arr) {
  if (!arr.length) return '';
  const headers=[...new Set(arr.flatMap(o=>Object.keys(o)))];
  const esc=v=>{
    if(v==null)return '';
    const s=String(v);
    return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
  };
  return headers.join(',')+'\n'+arr.map(o=>headers.map(h=>esc(o[h])).join(',')).join('\n')+'\n';
}
fs.writeFileSync(path.join(outDir,'provider.csv'),csv(providerSummary));
fs.writeFileSync(path.join(outDir,'model_effort.csv'),csv(modelEffort));
fs.writeFileSync(path.join(outDir,'performance.csv'),csv(perfGroups));
fs.writeFileSync(path.join(outDir,'quota_efficiency.csv'),csv(quota));
fs.writeFileSync(path.join(outDir,'quota_efficiency_provider.csv'),csv(quotaProvider));

console.log(JSON.stringify({
  rows:rows.length,
  providers:providerSummary,
  quota:quotaProvider,
  output_dir:outDir
},null,2));