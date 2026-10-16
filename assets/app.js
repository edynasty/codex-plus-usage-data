const $=s=>document.querySelector(s);
// 打开即自动绕开浏览器缓存：数据一律 no-store，且数据版本变化时强制重载一次（带时间戳参数）。
const DATASET_STAMP_KEY='codexUsage.datasetStamp';
(async()=>{
 try{
   const res=await fetch('./data/current/summary.json',{cache:'no-store'});
   if(!res.ok)return;
   const stamp=(await res.json())?.generated_at||'';
   const seen=localStorage.getItem(DATASET_STAMP_KEY);
   if(seen&&stamp&&seen!==stamp){
     localStorage.setItem(DATASET_STAMP_KEY,stamp);
     const url=new URL(location.href);
     url.searchParams.set('fresh',Date.now().toString(36));
     location.replace(url.toString());
     return;
   }
   if(stamp)localStorage.setItem(DATASET_STAMP_KEY,stamp);
 }catch(_){/* 网络异常时按常规渲染 */}
})();
const $$=s=>[...document.querySelectorAll(s)];
const fmtInt=n=>new Intl.NumberFormat('en-US').format(Math.round(Number(n||0)));
const fmtMoney=n=>'$'+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0));
const fmtPct=n=>n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(n))+'%';
function fmtTok(n){n=Number(n||0);if(n>=1e9)return(n/1e9).toFixed(3)+'B';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return fmtInt(n)}
function fmtDurationMs(n){if(n==null||!Number.isFinite(Number(n)))return'—';n=Number(n);return n>=1000?(n/1000).toFixed(n>=10000?1:2)+'s':Math.round(n)+'ms'}
function fmtTps(n){return n==null||!Number.isFinite(Number(n))?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n))}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function providerLabel(v){return v==='codex'?'Codex':v==='claude'?'Claude':String(v||'—')}
async function json(url,required=true){
 const r=await fetch(url,{cache:'no-store'});
 if(!r.ok){if(required)throw new Error(url+' '+r.status);return null}
 const text=await r.text();
 const trimmed=text.trimStart();
 if(!trimmed||trimmed.startsWith('<')){
   if(required)throw new Error(url+' 返回的不是 JSON');
   return null;
 }
 try{return JSON.parse(text)}catch(err){
   if(required)throw new Error(url+' JSON 解析失败: '+err.message);
   return null;
 }
}
function bench(el,data,value,render,alt=false){
 if(!el)return;
 if(!data.length){el.innerHTML='<div class="current-empty">暂无数据</div>';return}
 const max=Math.max(...data.map(x=>Number(x[value]||0)),1);
 el.innerHTML=data.map(x=>'<div class="brow" title="'+esc(x.name)+'"><div class="bname">'+esc(x.name)+'</div><div class="barwrap"><div class="bar '+(alt?'alt':'')+'" style="width:'+Math.max(0,(Number(x[value]||0)/max*100))+'%"></div></div><div class="bvalue">'+render(x)+'</div></div>').join('');
}
function renderWeeklyStacked(el,rows){
 if(!el)return;
 if(!rows?.length){el.innerHTML='<div class="current-empty">暂无周数据</div>';return}
 const max=Math.max(...rows.map(x=>Number(x.tokens||0)),1);
 el.innerHTML='<div class="stack-legend"><span><i class="swatch codex"></i>Codex</span><span><i class="swatch claude"></i>Claude</span></div>'+
 rows.map(x=>{
   const total=Number(x.tokens||0),codex=Number(x.codex||0),claude=Number(x.claude||0);
   const full=total/max*100;
   const cp=total?codex/total*100:0,ap=total?claude/total*100:0;
   return '<div class="stack-row"><div class="stack-name">'+esc(x.name)+'</div><div class="stack-track"><div class="stack-total" style="width:'+full+'%"><div class="stack-seg codex" style="width:'+cp+'%"></div><div class="stack-seg claude" style="width:'+ap+'%"></div></div></div><div class="stack-value">'+fmtTok(total)+' <span class="small">'+fmtInt(x.requests)+' req · Codex '+fmtTok(codex)+' · Claude '+fmtTok(claude)+'</span></div></div>';
 }).join('');
}
function detailLabel(kind,name,depth){
 const badge=kind==='provider'?'<span class="kind-badge">Provider</span>':kind==='model'?'<span class="kind-badge">模型</span>':'';
 return '<span class="indent" style="--depth:'+depth+'"></span>'+badge+'<span class="node-label">'+esc(name)+'</span>';
}
function detailRow(r,quotaMap){
 const c=['usage-row','current-detail-row'];if(r.depth>0)c.push('is-child','is-hidden');if(r.childrenCount)c.push('has-children');
 const m=r.metrics||{};
 const q=r.depth===1&&r.provider?quotaMap?.get(r.provider):null;
 const q5=q?.get('5h'),q7=q?.get('7d');
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
  '<div class="cell num">'+(q5?.tokens_per_1pct_weighted?fmtTok(q5.tokens_per_1pct_weighted):'—')+'</div>'+
  '<div class="cell num">'+(q7?.tokens_per_1pct_weighted?fmtTok(q7.tokens_per_1pct_weighted):'—')+'</div>'+
  '<div class="cell num strong">'+fmtMoney(m.cost)+'</div>'+
 '</div>';
}
function renderDetail(weekly,weeklyModels,quota){
 const el=$('#detail-tree');let seq=0;const rows=[];
 const quotaMap=new Map;
 for(const q of quota?.by_provider||[]){
   if(!quotaMap.has(q.provider))quotaMap.set(q.provider,new Map);
   quotaMap.get(q.provider).set(q.window,q);
 }
 for(const w of weekly||[]){
  const wid='d'+(++seq),providers=(w.by_provider||[]).filter(x=>Number(x.requests||0)>0);
  rows.push({id:wid,parentId:null,depth:0,childrenCount:providers.length,metrics:w.total||{},label:'<span class="week-title">'+esc(w.week)+'</span>'+(w.partial?'<span class="current-badge">进行中</span>':'')+'<span class="period">'+esc(w.start)+' – '+esc(w.end)+'</span>'});
  for(const p of providers){
   const pid='d'+(++seq);
   const ms=(weeklyModels||[]).filter(x=>x.week===w.week&&x.provider===p.provider&&Number(x.requests||0)>0).sort((a,b)=>Number(b.total_tokens||0)-Number(a.total_tokens||0));
   rows.push({id:pid,parentId:wid,depth:1,childrenCount:ms.length,provider:p.provider,metrics:p,label:detailLabel('provider',providerLabel(p.provider),1)});
   for(const m of ms)rows.push({id:'d'+(++seq),parentId:pid,depth:2,childrenCount:0,provider:p.provider,metrics:m,label:detailLabel('model',m.model||'—',2)});
  }
 }
 el.innerHTML='<div class="usage-row current-detail-row usage-head">'+
  '<div class="cell">层级 · 周 › Provider › 模型</div><div class="cell num">请求</div><div class="cell num">Input</div><div class="cell num">Output</div><div class="cell num">Cache Write</div><div class="cell num">Cache Read</div><div class="cell num">总 Token</div><div class="cell num">Token / $</div><div class="cell num">Cache Hit</div><div class="cell num">5h / 1%</div><div class="cell num">7d / 1%</div><div class="cell num">Cost</div></div>'+
  rows.map(r=>detailRow(r,quotaMap)).join('');
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
function renderPerformance(rows,summary){
 const el=$('#performance-summary');if(!el)return;
 if(!rows?.length){
   const ps=summary?.providers||[];
   el.innerHTML='<div class="perf-table"><div class="perf-row perf-head"><div>Provider</div><div class="perf-num">Avg E2E</div><div class="perf-num">TTFT P50</div><div class="perf-num">TTFT P90</div><div class="perf-num">TPS P50</div><div class="perf-num">TPS P90</div></div>'+
   ps.map(x=>'<div class="perf-row"><div class="perf-model"><strong>'+esc(providerLabel(x.provider))+'</strong><span>当前聚合仅能验证 Avg E2E；P50/P90 等待 usage_logs</span></div><div class="perf-num">'+fmtDurationMs(x.average_duration_ms)+'</div><div class="perf-num">—</div><div class="perf-num">—</div><div class="perf-num">—</div><div class="perf-num">—</div></div>').join('')+'</div>';
   return;
 }
 const data=rows.filter(x=>Number(x.requests||0)>=20).map(x=>({...x,name:providerLabel(x.provider)+' · '+(x.model||'—')+' · '+(x.reasoning_effort||'default')}));
 sortTable(el,[
  {key:'name',label:'模型 / 强度',value:r=>r.name,render:r=>'<div class="perf-model"><strong>'+esc(r.name)+'</strong><span>'+fmtInt(r.requests)+' req · '+fmtInt(r.ttft_samples)+' TTFT samples</span></div>'},
  {key:'ttft_p50_ms',label:'TTFT P50',num:true,value:r=>r.ttft_p50_ms,render:r=>fmtDurationMs(r.ttft_p50_ms)},
  {key:'ttft_p90_ms',label:'TTFT P90',num:true,value:r=>r.ttft_p90_ms,render:r=>fmtDurationMs(r.ttft_p90_ms)},
  {key:'ttft_p95_ms',label:'TTFT P95',num:true,value:r=>r.ttft_p95_ms,render:r=>fmtDurationMs(r.ttft_p95_ms)},
  {key:'output_tps_p50',label:'TPS P50',num:true,value:r=>r.output_tps_p50,render:r=>fmtTps(r.output_tps_p50)},
  {key:'output_tps_p90',label:'TPS P90',num:true,value:r=>r.output_tps_p90,render:r=>fmtTps(r.output_tps_p90)},
  {key:'output_tps_p95',label:'TPS P95',num:true,value:r=>r.output_tps_p95,render:r=>fmtTps(r.output_tps_p95)},
  {key:'e2e_p50_ms',label:'E2E P50',num:true,value:r=>r.e2e_p50_ms,render:r=>fmtDurationMs(r.e2e_p50_ms)},
  {key:'e2e_p90_ms',label:'E2E P90',num:true,value:r=>r.e2e_p90_ms,render:r=>fmtDurationMs(r.e2e_p90_ms)},
 ],data,{key:'ttft_p50_ms',dir:'asc',cls:'perf-wide',empty:'请求性能数据尚未生成'});
}
function historicalEffort(latest){
 const map=new Map;
 for(const r of latest?.usage_rows||[]){
   const key=[r.model,r.effort||'default'].join('\u0001');
   if(!map.has(key))map.set(key,{provider:'codex',model:r.model,reasoning_effort:r.effort||'default',requests:0,input_tokens:0,output_tokens:0,cache_creation_tokens:0,cache_read_tokens:0,total_tokens:0,cost:0});
   const g=map.get(key),m=r.metrics||{};
   g.requests+=Number(m.requests||0);g.input_tokens+=Number(m.input_tokens||0);g.output_tokens+=Number(m.output_tokens||0);g.cache_creation_tokens+=Number(m.cache_creation_tokens||0);g.cache_read_tokens+=Number(m.cache_read_tokens||0);g.total_tokens+=Number(m.total_tokens||0);g.cost+=Number(m.account_cost||0);
 }
 return [...map.values()].map(g=>{
   const den=g.input_tokens+g.cache_creation_tokens+g.cache_read_tokens;
   return {...g,tokens_per_usd:g.cost?g.total_tokens/g.cost:null,cache_hit_percent:den?g.cache_read_tokens/den*100:null};
 });
}
// ---- 通用可排序表格：列定义 {key,label,num,value(r),render(r),cls} ----
function sortTable(el,cols,rows,opts={}){
 if(!el)return;
 if(!rows?.length){el.innerHTML='<div class="current-empty">'+(opts.empty||'暂无数据')+'</div>';return}
 const first=cols.find(c=>c.key&&c.value);
 const sortableKeys=cols.filter(c=>c.key&&c.value).map(c=>c.key);
 const state={key:sortableKeys.includes(opts.key)?opts.key:first?.key,dir:opts.dir||'desc'};
 const acc=r=>cols.find(c=>c.key===state.key);
 const cmp=(a,b)=>{
   const c=acc(),va=c.value(a),vb=c.value(b);
   if(typeof va==='number'||typeof vb==='number'){
     const na=Number.isFinite(Number(va))?Number(va):-Infinity,nb=Number.isFinite(Number(vb))?Number(vb):-Infinity;
     return state.dir==='asc'?na-nb:nb-na;
   }
   const sa=String(va??''),sb=String(vb??'');
   return state.dir==='asc'?sa.localeCompare(sb):sb.localeCompare(sa);
 };
 const draw=()=>{
   const sorted=[...rows].sort(cmp);
   const head=cols.map(c=>{
     const sortable=!!c.value;
     const ind=sortable?(state.key===c.key?(state.dir==='asc'?'↑':'↓'):'↕'):'';
     return '<div class="'+(c.num?'perf-num':'')+' '+(sortable?'sortable':'')+(state.key===c.key?' is-sorted':'')+'"'+(sortable?' data-sort="'+c.key+'" role="button" tabindex="0" aria-sort="'+(state.key===c.key?(state.dir==='asc'?'ascending':'descending'):'none')+'"':'')+'>'+esc(c.label)+(ind?'<span class="sort-ind">'+ind+'</span>':'')+'</div>';
   }).join('');
   el.innerHTML='<div class="perf-table '+(opts.cls||'')+'"><div class="perf-row perf-head">'+head+'</div>'+
     sorted.map(r=>'<div class="perf-row">'+cols.map(c=>'<div class="'+(c.num?'perf-num':'')+' '+(c.cls||'')+'">'+(c.render?c.render(r):esc(c.value(r)))+'</div>').join('')+'</div>').join('')+'</div>';
   el.querySelectorAll('.perf-head [data-sort]').forEach(h=>{
     const fire=()=>{
       const k=h.dataset.sort;
       if(state.key===k)state.dir=state.dir==='asc'?'desc':'asc';
       else{state.key=k;state.dir='desc'}
       draw();
     };
     h.addEventListener('click',fire);
     h.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();fire()}});
   });
 };
 draw();
}
// ---- 小型 SVG 趋势图：每个指标独立刻度 ----
function sparkline(series,{label,fmt,color='#8fb6c9',w=340,h=104,unit=''}){
 const pts=series.map((s,i)=>({i,label:s.label,v:Number(s.v),partial:!!s.partial})).filter(p=>Number.isFinite(p.v));
 if(pts.length<2)return '<div class="trend-card"><div class="trend-card-label">'+esc(label)+'</div><div class="trend-empty">数据不足</div></div>';
 const vals=pts.map(p=>p.v),min=Math.min(...vals),max=Math.max(...vals),span=(max-min)||1;
 const L=34,R=10,T=10,B=20;
 const X=i=>L+i*(w-L-R)/Math.max(1,series.length-1);
 const Y=v=>h-B-((v-min)/span)*(h-T-B);
 const path=pts.map((p,k)=>(k?'L':'M')+X(p.i).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' ');
 const area=path+' L'+X(pts[pts.length-1].i).toFixed(1)+' '+(h-B)+' L'+X(pts[0].i).toFixed(1)+' '+(h-B)+' Z';
 const last=pts[pts.length-1];
 return '<div class="trend-card"><div class="trend-card-label">'+esc(label)+'<span class="trend-card-last">'+esc(fmt(last.v))+(unit?' '+esc(unit):'')+'</span></div>'+
  '<svg class="trend-svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(label)+'">'+
  '<path class="trend-area" d="'+area+'" fill="'+color+'" opacity="0.10"/>'+
  '<path class="trend-line" d="'+path+'" fill="none" stroke="'+color+'" stroke-width="1.6" stroke-linejoin="round"/>'+
  pts.map(p=>'<circle cx="'+X(p.i).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="2.2" fill="'+color+'"'+(p.partial?' opacity="0.45"':'')+'><title>'+esc(p.label+': '+fmt(p.v))+'</title></circle>').join('')+
  '<text class="trend-axis" x="'+(L-4)+'" y="'+(Y(max)+3)+'" text-anchor="end">'+esc(fmt(max))+'</text>'+
  '<text class="trend-axis" x="'+(L-4)+'" y="'+(Y(min)+3)+'" text-anchor="end">'+esc(fmt(min))+'</text>'+
  '<text class="trend-axis" x="'+X(pts[0].i)+'" y="'+(h-6)+'" text-anchor="middle">'+esc(series[0].label)+'</text>'+
  '<text class="trend-axis" x="'+X(last.i)+'" y="'+(h-6)+'" text-anchor="end">'+esc(last.label)+'</text>'+
  '</svg></div>';
}
function renderTrendCharts(rows){
 const el=$('#trend-charts');if(!el)return;
 if(!rows?.length){el.innerHTML='<div class="current-empty">周趋势数据尚未生成</div>';return}
 const s=rows.map(r=>({label:r.week+(r.partial?'*':''),partial:r.partial,v:null}));
 const mk=(field,fmt,color,label,unit)=>sparkline(rows.map(r=>({label:r.week+(r.partial?'*':''),v:r[field],partial:r.partial})),{label,fmt,color,unit});
 el.innerHTML='<div class="trend-grid">'+
  mk('total_tokens',v=>fmtTok(v),'#8fb6c9','总 Token · 周')+
  mk('cache_hit_percent',v=>fmtPct(v),'#8fb6c9','Cache Hit · 周')+
  mk('tokens_per_usd',v=>fmtTok(v),'#d8a48f','Token / $ · 周')+
  mk('output_tps_p50',v=>fmtTps(v),'#d8a48f','TPS P50 · 周')+
  '</div>';
}
function renderQuotaModelEffort(rows){
 const el=$('#quota-model-effort');if(!el)return;
 const groups=new Map;
 for(const r of rows||[]){const key=providerLabel(r.provider)+' · '+r.model+' · '+(r.reasoning_effort||'default');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 const data=[...groups].map(([name,rs])=>{
  const h5=rs.find(x=>x.window==='5h'),d7=rs.find(x=>x.window==='7d');
  const eq=Math.max(...rs.map(x=>Number(x.equivalent_100pct_tokens||0)));
  const cache=rs.map(x=>Number(x.cache_hit_percent)).filter(Number.isFinite);
  return {name,provider:rs[0].provider,model:rs[0].model,effort:rs[0].reasoning_effort||'default',
   t5:h5?.tokens_per_1pct??null,t7:d7?.tokens_per_1pct??null,eq,
   cache:cache.length?cache.reduce((a,b)=>a+b,0)/cache.length:null,
   samples:rs.reduce((a,x)=>a+Number(x.window_samples||0),0)};
 });
 sortTable(el,[
  {key:'name',label:'模型 / 强度',value:r=>r.name,render:r=>'<div class="perf-model"><strong>'+esc(r.name)+'</strong><span>'+fmtInt(r.samples)+' 个窗口样本</span></div>'},
  {key:'t5',label:'5h / 1%',num:true,value:r=>r.t5,render:r=>r.t5?fmtTok(r.t5):'—'},
  {key:'t7',label:'7d / 1%',num:true,value:r=>r.t7,render:r=>r.t7?fmtTok(r.t7):'—'},
  {key:'eq',label:'100% 等价',num:true,value:r=>r.eq,render:r=>r.eq?'<span class="strong">'+fmtTok(r.eq)+'</span>':'—'},
  {key:'cache',label:'Cache Hit',num:true,value:r=>r.cache,render:r=>r.cache==null?'—':fmtPct(r.cache)},
  {key:'samples',label:'窗口样本',num:true,value:r=>r.samples,render:r=>fmtInt(r.samples)},
 ],data,{key:'eq',dir:'desc',empty:'额度效率（模型 × 强度）数据尚未生成'});
}
function renderCredits(data){
 const el=$('#credits');if(!el)return;
 const rows=(data?.by_model_effort||[]).filter(r=>Number(r.credits||0)>0);
 sortTable(el,[
  {key:'name',label:'模型 / 强度',value:r=>providerLabel(r.provider)+' · '+r.model+' · '+(r.reasoning_effort||'default'),render:r=>'<div class="perf-model"><strong>'+esc(providerLabel(r.provider)+' · '+r.model)+'</strong><span>'+esc(r.reasoning_effort||'default')+'</span></div>'},
  {key:'requests',label:'可比请求',num:true,value:r=>Number(r.requests||0),render:r=>fmtInt(r.requests)},
  {key:'tokens',label:'总 Token',num:true,value:r=>Number(r.tokens||0),render:r=>fmtTok(r.tokens)},
  {key:'credits',label:'点数消耗',num:true,value:r=>Number(r.credits||0),render:r=>'<span class="strong">'+new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(r.credits||0))+'</span>'},
  {key:'cache_hit_percent',label:'缓存命中',num:true,value:r=>Number(r.cache_hit_percent||0),render:r=>fmtPct(r.cache_hit_percent)},
  {key:'tokens_per_credit',label:'Token / 点',num:true,value:r=>Number(r.tokens_per_credit||0),render:r=>r.tokens_per_credit?fmtTok(r.tokens_per_credit):'—'},
 ],rows,{key:'credits',dir:'desc',empty:'暂无点数消耗数据（需要响应头里的点数余额快照）'});
}
function renderContextComparison(ctx){
 const el=$('#context-comparison');if(!el)return;
 const a=ctx?.comparison?.one_m,b=ctx?.comparison?.two_seventy_two_k;
 if(!a||!b){el.innerHTML='<div class="current-empty">历史上下文数据不可用</div>';return}
 const rows=[a,b],max=Math.max(...rows.map(x=>Number(x.tokens_per_usd||0)),1);
 el.innerHTML='<div class="context-summary">'+rows.map(x=>'<div class="context-card"><div class="context-name">'+esc(x.label)+'</div><div class="context-main">'+fmtTok(x.tokens_per_usd)+' <span>Token / $</span></div><div class="context-bar"><i style="width:'+(Number(x.tokens_per_usd||0)/max*100)+'%"></i></div><div class="context-meta">'+fmtInt(x.requests)+' req · '+fmtTok(x.total_tokens)+' total · Cache '+fmtPct(x.cache_hit_percent)+' · '+fmtTok(x.tokens_per_request)+' / req</div></div>').join('')+'</div>';
}
Promise.all([
 json('./data/current/summary.json'),
 json('./data/current/weekly.json'),
 json('./data/current/models.json'),
 json('./data/current/weekly_models.json',false),
 json('./data/current/model_effort.json',false),
 json('./data/current/quota_efficiency.json',false),
  json('./data/current/performance.json',false),
  json('./data/current/weekly_trend.json',false),
  json('./data/current/quota_model_effort.json',false),
  json('./data/current/credits.json',false),
  json('./data/latest.json',false),
  json('./data/context.json',false)
]).then(([summary,weekly,models,weeklyModels,effort,quota,performance,weeklyTrend,quotaModelEffort,credits,historicalLatest,contextData])=>{
 const c=summary.combined||{};
 $('#generated').textContent=new Date(summary.generated_at).toLocaleString('zh-CN',{hour12:false});
 $('#range').textContent=(summary.range?.start_date||'—')+' ～ '+(summary.range?.end_date||'—');
 $('#total').textContent=fmtTok(c.total_tokens);$('#requests').textContent=fmtInt(c.requests);$('#cache').textContent=fmtPct(c.cache_hit_percent);$('#cost').textContent=fmtMoney(c.cost);$('#tpu').textContent=fmtTok(c.tokens_per_usd);
 $('#dataset-status').textContent='schema '+(summary.schema_version||'—')+' · '+esc(summary.source||'current');
 $('#dataset-status').classList.add('live');
 const providers=summary.providers||[];
 $('#provider-summary').innerHTML=providers.map(p=>'<div class="provider-card"><div class="provider-name">'+providerLabel(p.provider)+'</div><div class="provider-metric"><strong>'+fmtInt(p.requests)+'</strong><span>请求</span></div><div class="provider-metric"><strong>'+fmtTok(p.total_tokens)+'</strong><span>总 Token</span></div><div class="provider-metric"><strong>'+fmtPct(p.cache_hit_percent)+'</strong><span>Cache Hit</span></div><div class="provider-metric"><strong>'+fmtTok(p.tokens_per_usd)+'</strong><span>Token / $</span></div></div>').join('');
 const wr=(weekly||[]).slice().reverse().map(w=>({name:w.week+(w.partial?' *':''),tokens:w.total?.total_tokens||0,requests:w.total?.requests||0,codex:(w.by_provider||[]).find(x=>x.provider==='codex')?.total_tokens||0,claude:(w.by_provider||[]).find(x=>x.provider==='claude')?.total_tokens||0}));
 renderWeeklyStacked($('#weekly-chart'),wr);
 renderDetail((weekly||[]).slice().reverse(),weeklyModels||[],quota);
 bench($('#provider-bench'),providers.map(p=>({name:providerLabel(p.provider),v:p.tokens_per_usd,cache:p.cache_hit_percent,req:p.requests})),'v',x=>fmtTok(x.v)+' / $ <span class="small">'+fmtInt(x.req)+' req · Cache '+fmtPct(x.cache)+'</span>');
 const mr=(models||[]).filter(x=>Number(x.requests||0)>=20).sort((a,b)=>Number(b.tokens_per_usd||0)-Number(a.tokens_per_usd||0)).map(x=>({name:providerLabel(x.provider)+' · '+x.model,v:x.tokens_per_usd,cache:x.cache_hit_percent,req:x.requests,total:x.total_tokens}));
 bench($('#model-bench'),mr,'v',x=>fmtTok(x.v)+' / $ <span class="small">'+fmtInt(x.req)+' req · '+fmtTok(x.total)+'</span>');
 bench($('#model-cache'),mr.slice().sort((a,b)=>Number(b.cache||0)-Number(a.cache||0)),'cache',x=>fmtPct(x.cache)+' <span class="small">'+fmtInt(x.req)+' req</span>',true);
 if(effort?.length){
   $('#effort-note').textContent='当前 usage_logs · Codex + Claude';
   renderEffort(effort);
 }else{
   $('#effort-note').textContent='当前 usage_logs 尚未生成思考强度聚合；以下为 2026-09-29 Codex 历史快照。';
   renderEffort(historicalEffort(historicalLatest));
 }
 renderContextComparison(contextData);
 renderQuota(quota);
 renderPerformance(performance,summary);
 renderTrendCharts(weeklyTrend||[]);
 renderQuotaModelEffort(quotaModelEffort||[]);
 renderCredits(credits);
}).catch(err=>{
 $('#dataset-status').textContent='数据加载失败';
 document.body.insertAdjacentHTML('afterbegin','<div class="fatal">data/current 加载失败：'+esc(err.message)+'</div>');
});