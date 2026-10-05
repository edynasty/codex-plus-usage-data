const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmtInt=n=>new Intl.NumberFormat('en-US').format(Math.round(Number(n||0)));
const fmtMoney=n=>'$'+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const fmtPct=n=>n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(n))+'%';
function fmtTok(n){n=Number(n||0);if(n>=1e9)return(n/1e9).toFixed(3)+'B';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return fmtInt(n)}
function fmtDurationMs(n){if(n==null||!Number.isFinite(Number(n)))return'—';n=Number(n);return n>=1000?(n/1000).toFixed(n>=10000?1:2)+'s':Math.round(n)+'ms'}
function fmtTps(n){return n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n))}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function providerLabel(v){return v==='codex'?'Codex':v==='claude'?'Claude':String(v||'—')}
async function json(url,required=true){const r=await fetch(url,{cache:'no-store'});if(!r.ok){if(required)throw new Error(url+' '+r.status);return null}return r.json()}
function bench(el,data,value,render,alt=false){
 if(!el)return;
 if(!data.length){el.innerHTML='<div class="current-empty">暂无数据</div>';return}
 const max=Math.max(...data.map(x=>Number(x[value]||0)),1);
 el.innerHTML=data.map(x=>'<div class="brow"><div class="bname">'+esc(x.name)+'</div><div class="barwrap"><div class="bar '+(alt?'alt':'')+'" style="width:'+Math.max(0,(Number(x[value]||0)/max*100))+'%"></div></div><div class="bvalue">'+render(x)+'</div></div>').join('');
}
function detailLabel(kind,name,depth){
 const badge=kind==='provider'?'<span class="kind-badge">Provider</span>':kind==='model'?'<span class="kind-badge">模型</span>':'';
 return '<span class="indent" style="--depth:'+depth+'"></span>'+badge+'<span class="node-label">'+esc(name)+'</span>';
}
function detailRow(r){
 const c=['usage-row','current-detail-row'];if(r.depth>0)c.push('is-child','is-hidden');if(r.childrenCount)c.push('has-children');
 const m=r.metrics||{};
 return '<div class="'+c.join(' ')+'" data-id="'+r.id+'" '+(r.parentId?'data-parent="'+r.parentId+'"':'')+' data-depth="'+r.depth+'">'+
  '<div class="cell hierarchy">'+(r.childrenCount?'<button class="toggle" aria-label="展开/收起" aria-expanded="false">›</button>':'<span class="toggle-spacer"></span>')+r.label+'</div>'+
  '<div class="cell num">'+fmtInt(m.requests)+'</div>'+
  '<div class="cell num">'+fmtTok(m.input_tokens)+'</div>'+
  '<div class="cell num">'+fmtTok(m.output_tokens)+'</div>'+
  '<div class="cell num">'+fmtTok(m.cache_creation_tokens)+'</div>'+
  '<div class="cell num">'+fmtTok(m.cache_read_tokens)+'</div>'+
  '<div class="cell num strong">'+fmtTok(m.total_tokens)+'</div>'+
  '<div class="cell num">'+(m.tokens_per_usd?fmtTok(m.tokens_per_usd):'—')+'</div>'+
  '<div class="cell num">'+fmtPct(m.cache_hit_percent)+'</div>'+
  '<div class="cell num strong">'+fmtMoney(m.cost)+'</div>'+
 '</div>';
}
function renderDetail(weekly,weeklyModels){
 const el=$('#detail-tree');let seq=0;const rows=[];
 for(const w of weekly||[]){
  const wid='d'+(++seq),providers=(w.by_provider||[]).filter(x=>Number(x.requests||0)>0);
  rows.push({id:wid,parentId:null,depth:0,childrenCount:providers.length,metrics:w.total||{},label:'<span class="week-title">'+esc(w.week)+'</span>'+(w.partial?'<span class="current-badge">进行中</span>':'')+'<span class="period">'+esc(w.start)+' – '+esc(w.end)+'</span>'});
  for(const p of providers){
   const pid='d'+(++seq);
   const ms=(weeklyModels||[]).filter(x=>x.week===w.week&&x.provider===p.provider&&Number(x.requests||0)>0).sort((a,b)=>Number(b.total_tokens||0)-Number(a.total_tokens||0));
   rows.push({id:pid,parentId:wid,depth:1,childrenCount:ms.length,metrics:p,label:detailLabel('provider',providerLabel(p.provider),1)});
   for(const m of ms)rows.push({id:'d'+(++seq),parentId:pid,depth:2,childrenCount:0,metrics:m,label:detailLabel('model',m.model||'—',2)});
  }
 }
 el.innerHTML='<div class="usage-row current-detail-row usage-head">'+
  '<div class="cell">层级 · 周 › Provider › 模型</div><div class="cell num">请求</div><div class="cell num">Input</div><div class="cell num">Output</div><div class="cell num">Cache Write</div><div class="cell num">Cache Read</div><div class="cell num">总 Token</div><div class="cell num">Token / $</div><div class="cell num">Cache Hit</div><div class="cell num">Cost</div></div>'+
  rows.map(detailRow).join('');
 const map=new Map(rows.map(r=>[r.id,r])),els=new Map($$('#detail-tree .current-detail-row[data-id]').map(e=>[e.dataset.id,e]));
 const kids=id=>[...els.values()].filter(e=>e.dataset.parent===id);
 const descendants=id=>{const out=[],q=[id];while(q.length){for(const c of kids(q.shift())){out.push(c);q.push(c.dataset.id)}}return out};
 const collapse=id=>{const e=els.get(id);e?.classList.remove('is-expanded');e?.querySelector('.toggle')?.setAttribute('aria-expanded','false');for(const d of descendants(id)){d.classList.add('is-hidden');d.classList.remove('is-expanded');d.querySelector('.toggle')?.setAttribute('aria-expanded','false')}};
 const expand=id=>{const e=els.get(id);e?.classList.add('is-expanded');e?.querySelector('.toggle')?.setAttribute('aria-expanded','true');for(const c of kids(id))c.classList.remove('is-hidden')};
 for(const [id,e] of els){if(!(map.get(id)?.childrenCount))continue;const fire=()=>e.classList.contains('is-expanded')?collapse(id):expand(id);e.querySelector('.toggle')?.addEventListener('click',ev=>{ev.stopPropagation();fire()});e.addEventListener('click',ev=>{if(!ev.target.closest('button'))fire()})}
}
function renderEffort(rows){
 const el=$('#effort-bench');
 if(!rows?.length){el.innerHTML='<div class="current-empty">等待本机 usage_logs 刷新 model_effort.json</div>';return}
 const groups=new Map;
 for(const r of rows){const key=providerLabel(r.provider)+' · '+r.model;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 el.innerHTML=[...groups].map(([name,rs])=>'<div class="effort-group"><div class="effort-model">'+esc(name)+'</div><div class="bench">'+rs.sort((a,b)=>Number(b.tokens_per_usd||0)-Number(a.tokens_per_usd||0)).map(r=>'<div class="brow"><div class="bname">'+esc(r.reasoning_effort||'default')+'</div><div class="barwrap"><div class="bar" style="width:'+Math.max(2,Math.min(100,(Number(r.tokens_per_usd||0)/Math.max(...rs.map(x=>Number(x.tokens_per_usd||0)),1)*100)))+'%"></div></div><div class="bvalue">'+fmtTok(r.tokens_per_usd)+' / $ <span class="small">'+fmtInt(r.requests)+' req · Cache '+fmtPct(r.cache_hit_percent)+'</span></div></div>').join('')+'</div></div>').join('');
}
function renderQuota(q){
 const el=$('#quota-efficiency'),rows=q?.by_provider||[];
 if(!rows.length){el.innerHTML='<div class="current-empty">usage_logs 额度数据尚未发布；运行本机 publisher 后这里会直接显示计算结果。</div>';return}
 el.innerHTML=['codex','claude'].map(provider=>{
  const rs=rows.filter(x=>x.provider===provider);if(!rs.length)return'';
  return '<div class="quota-provider"><div class="quota-provider-head"><span>'+providerLabel(provider)+'</span><span class="small">逐请求窗口利用率</span></div>'+
   rs.map(x=>'<div class="quota-row"><strong>'+esc(x.window)+'</strong>'+
    '<div><strong>'+fmtTok(x.tokens_per_1pct_weighted)+'</strong><span> Token / 1%</span></div>'+
    '<div><strong>'+fmtTok(x.equivalent_100pct_tokens)+'</strong><span> 100% 等价</span></div>'+
    '<div><strong>'+fmtTok(x.equivalent_100pct_tokens_avg_window)+'</strong><span> 窗口平均</span></div>'+
    '<div class="perf-num">'+fmtInt(x.window_samples)+' windows · '+fmtPct(x.observed_percent_span)+' span</div></div>').join('')+'</div>';
 }).join('');
}
function renderPerformance(rows){
 const el=$('#performance-summary');
 if(!rows?.length){el.innerHTML='<div class="current-empty">usage_logs 性能数据尚未发布；运行本机 publisher 后这里会直接显示 TTFT / TPS / E2E。</div>';return}
 const rs=rows.filter(x=>Number(x.requests||0)>=20).sort((a,b)=>String(a.provider).localeCompare(String(b.provider))||Number(b.requests)-Number(a.requests)).slice(0,24);
 el.innerHTML='<div class="perf-table"><div class="perf-row perf-head"><div>模型 / 强度</div><div class="perf-num">TTFT P50</div><div class="perf-num">TTFT P90</div><div class="perf-num">TPS P50</div><div class="perf-num">TPS P90</div><div class="perf-num">E2E P50</div></div>'+
  rs.map(x=>'<div class="perf-row"><div class="perf-model"><strong>'+esc(providerLabel(x.provider)+' · '+x.model)+'</strong><span>'+esc(x.reasoning_effort||'default')+' · '+fmtInt(x.requests)+' req · '+fmtInt(x.ttft_samples)+' TTFT samples</span></div><div class="perf-num">'+fmtDurationMs(x.ttft_p50_ms)+'</div><div class="perf-num">'+fmtDurationMs(x.ttft_p90_ms)+'</div><div class="perf-num">'+fmtTps(x.output_tps_p50)+'</div><div class="perf-num">'+fmtTps(x.output_tps_p90)+'</div><div class="perf-num">'+fmtDurationMs(x.e2e_p50_ms)+'</div></div>').join('')+'</div>';
}
Promise.all([
 json('./data/current/summary.json'),
 json('./data/current/weekly.json'),
 json('./data/current/models.json'),
 json('./data/current/weekly_models.json',false),
 json('./data/current/model_effort.json',false),
 json('./data/current/quota_efficiency.json',false),
 json('./data/current/performance.json',false)
]).then(([summary,weekly,models,weeklyModels,effort,quota,performance])=>{
 const c=summary.combined||{};
 $('#generated').textContent=new Date(summary.generated_at).toLocaleString('zh-CN',{hour12:false});
 $('#range').textContent=(summary.range?.start_date||'—')+' ～ '+(summary.range?.end_date||'—');
 $('#total').textContent=fmtTok(c.total_tokens);$('#requests').textContent=fmtInt(c.requests);$('#cache').textContent=fmtPct(c.cache_hit_percent);$('#cost').textContent=fmtMoney(c.cost);$('#tpu').textContent=fmtTok(c.tokens_per_usd);
 $('#dataset-status').textContent='schema '+(summary.schema_version||'—')+' · '+esc(summary.source||'current');
 $('#dataset-status').classList.add('live');
 const providers=summary.providers||[];
 $('#provider-summary').innerHTML=providers.map(p=>'<div class="provider-card"><div class="provider-name">'+providerLabel(p.provider)+'</div><div class="provider-metric"><strong>'+fmtInt(p.requests)+'</strong><span>请求</span></div><div class="provider-metric"><strong>'+fmtTok(p.total_tokens)+'</strong><span>总 Token</span></div><div class="provider-metric"><strong>'+fmtPct(p.cache_hit_percent)+'</strong><span>Cache Hit</span></div><div class="provider-metric"><strong>'+fmtTok(p.tokens_per_usd)+'</strong><span>Token / $</span></div></div>').join('');
 const wr=(weekly||[]).map(w=>({name:w.week+(w.partial?' *':''),tokens:w.total?.total_tokens||0,requests:w.total?.requests||0,codex:(w.by_provider||[]).find(x=>x.provider==='codex')?.total_tokens||0,claude:(w.by_provider||[]).find(x=>x.provider==='claude')?.total_tokens||0}));
 bench($('#weekly-chart'),wr,'tokens',x=>fmtTok(x.tokens)+' <span class="small">'+fmtInt(x.requests)+' req · Codex '+fmtTok(x.codex)+' · Claude '+fmtTok(x.claude)+'</span>',true);
 renderDetail(weekly,weeklyModels||[]);
 bench($('#provider-bench'),providers.map(p=>({name:providerLabel(p.provider),v:p.tokens_per_usd,cache:p.cache_hit_percent,req:p.requests})),'v',x=>fmtTok(x.v)+' / $ <span class="small">'+fmtInt(x.req)+' req · Cache '+fmtPct(x.cache)+'</span>');
 const mr=(models||[]).filter(x=>Number(x.requests||0)>=20).sort((a,b)=>Number(b.tokens_per_usd||0)-Number(a.tokens_per_usd||0)).map(x=>({name:providerLabel(x.provider)+' · '+x.model,v:x.tokens_per_usd,cache:x.cache_hit_percent,req:x.requests,total:x.total_tokens}));
 bench($('#model-bench'),mr,'v',x=>fmtTok(x.v)+' / $ <span class="small">'+fmtInt(x.req)+' req · '+fmtTok(x.total)+'</span>');
 bench($('#model-cache'),mr.slice().sort((a,b)=>Number(b.cache||0)-Number(a.cache||0)),'cache',x=>fmtPct(x.cache)+' <span class="small">'+fmtInt(x.req)+' req</span>',true);
 renderEffort(effort);renderQuota(quota);renderPerformance(performance);
}).catch(err=>{
 $('#dataset-status').textContent='数据加载失败';
 document.body.insertAdjacentHTML('afterbegin','<div class="fatal">data/current 加载失败：'+esc(err.message)+'</div>');
});