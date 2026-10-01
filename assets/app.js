const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmtInt=n=>new Intl.NumberFormat('en-US').format(Math.round(n||0));
const fmtMoney=n=>'$'+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const fmtPct=n=>n==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n)+'%';
function fmtTok(n){n=Number(n||0);if(n>=1e8)return(n/1e8).toFixed(2)+'亿';if(n>=1e4)return(n/1e4).toFixed(2)+'万';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return fmtInt(n)}
function fmtDateShort(v){const d=new Date(v);return String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0')}
function calc(rows){const x={requests:0,input_tokens:0,output_tokens:0,cache_creation_tokens:0,cache_read_tokens:0,total_tokens:0,account_cost:0};for(const r of rows)for(const k in x)x[k]+=Number(r.metrics?.[k]||0);x.tpd=x.account_cost>0?x.total_tokens/x.account_cost:null;x.tpr=x.requests>0?x.total_tokens/x.requests:null;x.cpr=x.requests>0?x.account_cost/x.requests:null;const den=x.input_tokens+x.cache_creation_tokens+x.cache_read_tokens;x.cache=den>0?x.cache_read_tokens/den*100:null;return x}
function group(rows,key){const m=new Map;for(const r of rows){const k=r[key]??'unknown';if(!m.has(k))m.set(k,[]);m.get(k).push(r)}return[...m].map(([name,rr])=>({name,...calc(rr)}))}
function bench(el,data,value,render,alt=false){const max=Math.max(...data.map(x=>Number(x[value]||0)),1);el.innerHTML=data.map(x=>`<div class="brow"><div class="bname">${x.name}</div><div class="barwrap"><div class="bar ${alt?'alt':''}" style="width:${Math.max(0,(x[value]||0)/max*100)}%"></div></div><div class="bvalue">${render(x)}</div></div>`).join('')}
function range(e){const r=e.before_weekly_used_percent_range;if(!Array.isArray(r))return'未知';return r[0]===r[1]?r[0]+'%':r[0]+'–'+r[1]+'%'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function tokenBreakdown(m){m=m||{};return `<div class="token-lines"><span>输入 ${fmtTok(m.input_tokens)}</span><span>输出 ${fmtTok(m.output_tokens)}</span><span>缓存写入 ${fmtTok(m.cache_creation_tokens)}</span><span>缓存读取 ${fmtTok(m.cache_read_tokens)}</span></div>`}
function resetText(r){if(!r)return'—';return `<strong>已用 ${fmtInt(r.used)} 次</strong><span>手动 ${fmtInt(r.manual)} · 自动 ${fmtInt(r.auto)}</span>`}
function treeLabel(n,depth){const kind=n.kind||'';const name=esc(n.label||'');const badge=kind==='account'?'<span class="kind-badge">账号</span>':kind==='model'?'<span class="kind-badge">模型</span>':kind==='effort'?'<span class="kind-badge">强度</span>':kind==='context'?'<span class="kind-badge">上下文</span>':'';return `<span class="indent" style="--depth:${depth}"></span>${badge}<span class="node-label">${name}</span>`}
function rowHtml({id,parentId,depth,label,metrics,resets,cache,tpd,share,childrenCount,note}){
 const classes=['usage-row'];if(depth>0)classes.push('is-child','is-hidden');if(childrenCount>0)classes.push('has-children');
 return `<div class="${classes.join(' ')}" data-id="${id}" ${parentId?`data-parent="${parentId}"`:''} data-depth="${depth}">
   <div class="cell hierarchy">${childrenCount>0?'<button class="toggle" aria-label="展开/收起" aria-expanded="false">›</button>':'<span class="toggle-spacer"></span>'}${label}</div>
   <div class="cell num">${fmtInt(metrics?.requests)}</div>
   <div class="cell token-detail">${tokenBreakdown(metrics)}</div>
   <div class="cell num strong">${fmtTok(metrics?.total_tokens)}${share!=null?`<span class="sub">占比 ${fmtPct(share)}</span>`:''}</div>
   <div class="cell num">${tpd?fmtTok(tpd):'—'}</div>
   <div class="cell num">${fmtPct(cache)}</div>
   <div class="cell num">${fmtMoney(metrics?.standard_cost)}</div>
   <div class="cell num">${fmtMoney(metrics?.actual_cost)}</div>
   <div class="cell num strong">${fmtMoney(metrics?.account_cost)}</div>
   <div class="cell reset-cell">${resetText(resets)}</div>
   <div class="cell note-cell">${note||''}</div>
 </div>`}
function contextLabelForWeek(weekIndex,modelName){
 if(weekIndex===1||weekIndex===2)return'1M';
 if(weekIndex===3&&modelName==='gpt-5.6-sol')return'1M';
 if((weekIndex===3||weekIndex===4)&&modelName==='gpt-6-sol')return'272K';
 return'—';
}
function collectTreeRows(buckets,summaryTotal,key){
 const out=[];let seq=0;
 const walk=(nodes,parentId,depth,weekIndex,modelName)=>{
   for(const n of nodes||[]){
     const id='r'+(++seq);
     const currentModel=n.kind==='model'?(n.label||n.key||modelName):modelName;
     const children=n.children||[];
     const addContext=(key==='week_account_model_effort'&&n.kind==='effort')||(key==='week_effort_model'&&n.kind==='model');
     out.push({id,parentId,depth,label:treeLabel(n,depth),metrics:n.metrics||{},resets:n.resets,cache:n.cache_hit_percent,tpd:n.tokens_per_usd,share:n.token_share_percent,childrenCount:children.length+(addContext?1:0),note:n.kind==='account'?(n.plan_type?esc(n.plan_type):''):''});
     walk(children,id,depth+1,weekIndex,currentModel);
     if(addContext){
       const ctx=contextLabelForWeek(weekIndex,currentModel);
       const cid='r'+(++seq);
       out.push({
         id:cid,parentId:id,depth:depth+1,
         label:treeLabel({kind:'context',label:ctx},depth+1),
         metrics:n.metrics||{},resets:null,cache:n.cache_hit_percent,tpd:n.tokens_per_usd,
         share:null,childrenCount:0,
         note:ctx==='—'?'未映射':'Sub2API 实际模型明细 + 当时上下文设置'
       });
     }
   }
 };
 for(const b of buckets||[]){
   const id='r'+(++seq);
   const share=summaryTotal>0?(Number(b.metrics?.total_tokens||0)/summaryTotal*100):null;
   const period=`${fmtDateShort(b.start)} – ${fmtDateShort(b.end)}`;
   const groups=b.groups||[];
   const title=key.startsWith('month')?String(b.start||'').slice(0,7):'第 '+b.index+' 周';
   out.push({
     id,parentId:null,depth:0,
     label:`<span class="week-title">${title}</span>${b.current?'<span class="current-badge">进行中</span>':''}<span class="period">${period}</span>`,
     metrics:b.metrics||{},resets:b.resets,cache:b.cache_hit_percent,tpd:b.tokens_per_usd,share,childrenCount:groups.length,
     note:`${groups.length} 个${groups[0]?.kind==='account'?'账号':'分组'}`,
   });
   walk(groups,id,1,Number(b.index||0),null);
 }
 return out;
}
function renderTree(data,key){
 const el=$('#tree');
 const buckets=(data.trees?.[key]||[]).slice();
 const rows=collectTreeRows(buckets,Number(data.summary?.total_tokens||0),key);
 const hierarchyTitle=key==='week_effort_model'?'层级 · 思考强度 › 模型 › 上下文':key==='month_account_model'?'层级 · 账号 › 模型':'层级 · 账号 › 模型 › 思考强度 › 上下文';
 el.innerHTML=`<div class="usage-row usage-head">
   <div class="cell">${hierarchyTitle}</div><div class="cell num">请求数</div><div class="cell">Token 明细</div><div class="cell num">总 Token</div><div class="cell num">每刀 Token</div><div class="cell num">缓存命中</div><div class="cell num">标准计费</div><div class="cell num">实际扣费</div><div class="cell num">账号成本</div><div class="cell">Reset Card</div><div class="cell">备注</div>
 </div>`+rows.map(rowHtml).join('');
 const map=new Map(rows.map(r=>[r.id,r]));
 const rowEls=new Map($$('#tree .usage-row[data-id]').map(e=>[e.dataset.id,e]));
 const directChildren=id=>[...rowEls.values()].filter(e=>e.dataset.parent===id);
 const descendants=id=>{const all=[];const q=[id];while(q.length){const p=q.shift();for(const c of directChildren(p)){all.push(c);q.push(c.dataset.id)}}return all};
 const collapse=id=>{const elr=rowEls.get(id);if(!elr)return;elr.classList.remove('is-expanded');elr.querySelector('.toggle')?.setAttribute('aria-expanded','false');for(const d of descendants(id)){d.classList.add('is-hidden');d.classList.remove('is-expanded');d.querySelector('.toggle')?.setAttribute('aria-expanded','false')}};
 const expand=id=>{const elr=rowEls.get(id);if(!elr)return;elr.classList.add('is-expanded');elr.querySelector('.toggle')?.setAttribute('aria-expanded','true');for(const c of directChildren(id))c.classList.remove('is-hidden')};
 for(const [id,elr] of rowEls){if(!(map.get(id)?.childrenCount>0))continue;const fire=()=>elr.classList.contains('is-expanded')?collapse(id):expand(id);elr.querySelector('.toggle')?.addEventListener('click',e=>{e.stopPropagation();fire()});elr.addEventListener('click',e=>{if(e.target.closest('button'))return;fire()})}
}
function renderContext(c){
 const el=$('#context-bench');if(!el||!c)return;
 const a=c.comparison?.one_m||{},b=c.comparison?.two_seventy_two_k||{};
 const ratio=a.tokens_per_usd?b.tokens_per_usd/a.tokens_per_usd:null;
 const deltaReq=a.tokens_per_request?((b.tokens_per_request/a.tokens_per_request-1)*100):null;
 const rows=[
   {name:'1M',tpd:a.tokens_per_usd,tpr:a.tokens_per_request,cache:a.cache_hit_percent,requests:a.requests},
   {name:'272K',tpd:b.tokens_per_usd,tpr:b.tokens_per_request,cache:b.cache_hit_percent,requests:b.requests}
 ];
 bench(el,rows,'tpd',x=>fmtTok(x.tpd)+' / $ <span class="small">Cache '+fmtPct(x.cache)+' · '+fmtTok(x.tpr)+'/req · '+fmtInt(x.requests)+' req'+(x.name==='272K'&&ratio!=null?' · '+ratio.toFixed(2)+'× Token/$':'')+(x.name==='272K'&&deltaReq!=null?' · 单次 '+Math.abs(deltaReq).toFixed(1)+'% 更短':'')+'</span>',true);
}
Promise.all([fetch('./data/latest.json',{cache:'no-store'}).then(r=>r.json()),fetch('./data/resets.json',{cache:'no-store'}).then(r=>r.json()),fetch('./data/context.json',{cache:'no-store'}).then(r=>r.json())]).then(([d,rd,cd])=>{
 const s=d.summary;
 $('#generated').textContent=new Date(d.generated_at).toLocaleString('zh-CN',{hour12:false});
 $('#total').textContent=fmtTok(s.total_tokens);$('#requests').textContent=fmtInt(s.requests);$('#cache').textContent=fmtPct(s.cache_hit_percent);$('#cost').textContent=fmtMoney(s.account_cost);$('#tpu').textContent=fmtTok(s.tokens_per_usd);

 renderTree(d,'week_account_model_effort');
 renderContext(cd);
 $$('.tabs button').forEach(btn=>btn.addEventListener('click',()=>{$$('.tabs button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderTree(d,btn.dataset.tree)}));

 $('#reset-cards').innerHTML='<div class="resetline"><div>累计已用</div><div class="rmeta">手动 '+s.reset_manual+' · 自动 '+s.reset_auto+'</div><div>'+s.reset_used+' 张</div></div>';
 const ev=(rd.events||[]).slice().sort((a,b)=>a.at.localeCompare(b.at));const globals=ev.filter(e=>e.type==='global_reset');$('#global-count').textContent=globals.length+' 次';
 $('#reset-timeline').innerHTML=ev.map(e=>{const kind=e.type==='global_reset'?'Global Reset':'Banked Grant';const desc=e.type==='global_reset'?'reset 前周使用 '+range(e):e.note;return'<div class="resetline"><div>'+e.at.slice(0,10)+'<span class="badge">'+kind+'</span></div><div class="rmeta">'+desc+'</div><div>人工记录</div></div>'}).join('');

 const weeks=(d.trees?.week_account_model_effort||[]).slice().sort((a,b)=>a.index-b.index).map(w=>({name:'W'+w.index+(w.partial?' *':''),total_tokens:w.metrics.total_tokens,account_cost:w.metrics.account_cost,token_per_dollar:w.tokens_per_usd,cache_hit:w.cache_hit_percent,requests:w.metrics.requests}));
 bench($('#week-tpu'),weeks,'token_per_dollar',x=>fmtTok(x.token_per_dollar)+' / $ <span class="small">Cache '+fmtPct(x.cache_hit)+' · '+fmtMoney(x.account_cost)+'</span>');
 bench($('#week-tokens'),weeks,'total_tokens',x=>fmtTok(x.total_tokens)+' <span class="small">'+fmtInt(x.requests)+' req · Cache '+fmtPct(x.cache_hit)+'</span>',true);

 const models=group(d.usage_rows,'model').sort((a,b)=>b.tpd-a.tpd);
 const modelMain=models.filter(x=>x.requests>=100);
 const modelSmall=models.filter(x=>x.requests<100);
 bench($('#models'),modelMain,'tpd',x=>fmtTok(x.tpd)+' / $ <span class="small">Cache '+fmtPct(x.cache)+' · '+fmtMoney(x.cpr)+'/req · '+fmtInt(x.requests)+' req</span>');
 $('#models-small').innerHTML=modelSmall.length?'<div class="small-sample-title">小样本，仅参考</div>'+modelSmall.map(x=>'<div class="small-sample-row"><span>'+esc(x.name)+'</span><strong>'+fmtTok(x.tpd)+' / $</strong><span>Cache '+fmtPct(x.cache)+' · '+fmtInt(x.requests)+' req</span></div>').join(''):'';

 const byModel=[...new Set(d.usage_rows.map(r=>r.model))].map(model=>({model,rows:d.usage_rows.filter(r=>r.model===model)}));
 $('#effort-groups').innerHTML=byModel.map(({model,rows})=>{
   const es=group(rows,'effort').filter(x=>!['default','none'].includes(x.name)&&x.requests>=20).sort((a,b)=>b.tpd-a.tpd);
   if(!es.length)return'';
   const max=Math.max(...es.map(x=>x.tpd||0),1);
   return '<div class="effort-group"><div class="model-head">'+esc(model)+'</div>'+es.map(x=>'<div class="brow"><div class="bname">'+esc(x.name)+'</div><div class="barwrap"><div class="bar alt" style="width:'+((x.tpd||0)/max*100)+'%"></div></div><div class="bvalue">'+fmtTok(x.tpd)+' / $ <span class="small">Cache '+fmtPct(x.cache)+' · '+fmtMoney(x.cpr)+'/req · '+fmtInt(x.requests)+' req</span></div></div>').join('')+'</div>';
 }).join('');

 const contextRows={ '1M':[], '272K':[] };
 for(const row of d.usage_rows){
   const ctx=contextLabelForWeek(Number(row.week),row.model);
   if(ctx==='1M'||ctx==='272K')contextRows[ctx].push(row);
 }
 const modelContextData=[];
 for(const ctx of ['1M','272K']){
   for(const model of [...new Set(contextRows[ctx].map(r=>r.model))]){
     const x=calc(contextRows[ctx].filter(r=>r.model===model));
     modelContextData.push({ctx,model,...x});
   }
 }
 const modelContextMax=Math.max(...modelContextData.map(x=>x.tpd||0),1);
 $('#model-context-groups').innerHTML=['1M','272K'].map(ctx=>{
   const rows=modelContextData.filter(x=>x.ctx===ctx).sort((a,b)=>b.tpd-a.tpd);
   const req=rows.reduce((s,x)=>s+x.requests,0);
   return '<div class="context-model-panel"><div class="context-effort-head"><strong>'+ctx+'</strong><span>'+fmtInt(req)+' req</span></div>'+
     rows.map(x=>'<div class="brow"><div class="bname">'+esc(x.model)+'</div><div class="barwrap"><div class="bar '+(ctx==='272K'?'':'alt')+'" style="width:'+((x.tpd||0)/modelContextMax*100)+'%"></div></div><div class="bvalue">'+fmtTok(x.tpd)+' / $ <span class="small">Cache '+fmtPct(x.cache)+' · '+fmtMoney(x.cpr)+'/req · '+fmtInt(x.requests)+' req'+(x.requests<100?' · 小样本':'')+'</span></div></div>').join('')+
   '</div>';
 }).join('');

 const contextEffortData=[];
 for(const ctx of ['1M','272K']){
   for(const model of [...new Set(contextRows[ctx].map(r=>r.model))]){
     const rows=contextRows[ctx].filter(r=>r.model===model);
     const efforts=group(rows,'effort').filter(x=>!['default','none'].includes(x.name)&&x.requests>=20).sort((a,b)=>b.tpd-a.tpd);
     for(const x of efforts)contextEffortData.push({ctx,model,...x});
   }
 }
 const contextEffortMax=Math.max(...contextEffortData.map(x=>x.tpd||0),1);
 $('#effort-context-groups').innerHTML=['1M','272K'].map(ctx=>{
   const models=[...new Set(contextEffortData.filter(x=>x.ctx===ctx).map(x=>x.model))];
   const ctxRows=contextEffortData.filter(x=>x.ctx===ctx);
   const ctxReq=ctxRows.reduce((s,x)=>s+x.requests,0);
   return '<div class="context-effort-panel"><div class="context-effort-head"><strong>'+ctx+'</strong><span>'+fmtInt(ctxReq)+' req（按思考强度样本）</span></div>'+
     models.map(model=>{
       const es=contextEffortData.filter(x=>x.ctx===ctx&&x.model===model);
       return '<div class="effort-group"><div class="model-head">'+esc(model)+'</div>'+
         es.map(x=>'<div class="brow"><div class="bname">'+esc(x.name)+'</div><div class="barwrap"><div class="bar '+(ctx==='272K'?'':'alt')+'" style="width:'+((x.tpd||0)/contextEffortMax*100)+'%"></div></div><div class="bvalue">'+fmtTok(x.tpd)+' / $ <span class="small">Cache '+fmtPct(x.cache)+' · '+fmtMoney(x.cpr)+'/req · '+fmtInt(x.requests)+' req</span></div></div>').join('')+
       '</div>';
     }).join('')+
   '</div>';
 }).join('');

 const accs=(d.accounts||[]).map(a=>({name:a.account,tpd:a.tokens_per_usd,total:a.metrics.total_tokens,cache:a.cache_hit_percent,resets:a.resets})).sort((a,b)=>b.tpd-a.tpd);
 bench($('#accounts'),accs,'tpd',x=>fmtTok(x.tpd)+' / $ <span class="small">'+fmtTok(x.total)+' · Cache '+fmtPct(x.cache)+' · Reset Card '+(x.resets?.used||0)+'</span>');
}).catch(err=>{document.body.innerHTML='<pre style="padding:20px">Failed to load static data\n'+String(err)+'</pre>'});
