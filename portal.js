(function(){
'use strict';

const PORTAL_ROUTES=new Set(['','songs','albums','artists','number-ones','stats','year-end','decade-end','goat','chart-beat','awards','chart-battle','search','song','album','artist']);
const mainChartIds={song:'songs',album:'albums',artist:'artists'};
const periodLimits={songs:100,albums:100,artists:50};
let portalEl=null,weeklyEl=null,navEl=null;
const portalState={catalog:null,catalogKind:null,battleKind:'song'};

function basePrefix(){return location.hostname.endsWith('github.io')?'/daegon-charts':''}
function cleanPath(){
  let p=location.pathname;
  const b=basePrefix();
  if(b&&p.startsWith(b))p=p.slice(b.length)||'/';
  return p;
}
function appHref(path){return basePrefix()+(path.startsWith('/')?path:'/'+path)}
function slugify(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function entitySlug(e,kind){
  if(kind==='artist')return slugify(e.name||e.artist);
  return slugify(e.name)+'--'+slugify(e.artist);
}
function entityPath(e,kind){return '/'+kind+'/'+entitySlug(e,kind)}
function routeParts(){return cleanPath().split('/').filter(Boolean)}
function isHandled(pathname=cleanPath()){
  const p=pathname.split('/').filter(Boolean);
  if(!p.length)return true;
  return PORTAL_ROUTES.has(p[0]) && p[0]!=='chart';
}
function go(path,replace=false){
  const target=appHref(path);
  history[replace?'replaceState':'pushState']({},'',target);
  renderRoute();
}
function rankPoints(pos,chartId){
  const n=periodLimits[chartId]||100;
  return Math.round(1000*Math.pow(Math.max(0,(n-pos+1))/n,1.5));
}
function fmtNum(n){return Number(n||0).toLocaleString('en-US')}
function escAttr(v){return esc(String(v??''))}
function iconFor(kind){return kind==='artist'?'fa-user':kind==='album'?'fa-compact-disc':'fa-music'}
function labelFor(kind){return kind==='artist'?'Artist':kind==='album'?'Album':'Song'}
function chartIdForKind(kind){return mainChartIds[kind]||'songs'}

function ensureShell(){
  weeklyEl=document.querySelector('.layout');
  if(weeklyEl&&!weeklyEl.id)weeklyEl.id='weeklyView';
  if(!portalEl){
    portalEl=document.createElement('div');
    portalEl.id='portalPage';
    portalEl.className='portal-page';
    const page=document.querySelector('.page');
    page.insertBefore(portalEl,weeklyEl);
  }
  const head=document.querySelector('.header-inner');
  if(head&&!document.getElementById('portalTopNav')){
    navEl=document.createElement('nav');
    navEl.id='portalTopNav';
    navEl.className='portal-topnav';
    navEl.innerHTML=[
      ['Home','/'],['Weekly','/chart/daegon-100'],['Songs','/songs'],['Albums','/albums'],['Artists','/artists'],
      ["#1's",'/number-ones'],['Stats','/stats'],['Year-End','/year-end'],['Decade-End','/decade-end'],
      ['GOAT','/goat'],['Chart Beat','/chart-beat'],['Awards','/awards'],['Battle','/chart-battle'],['Search','/search']
    ].map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('');
    const theme=document.getElementById('themeToggle');
    head.insertBefore(navEl,theme);
    const brand=document.querySelector('.brand');
    if(brand){
      brand.style.cursor='pointer';
      brand.setAttribute('role','link');
      brand.setAttribute('tabindex','0');
      brand.onclick=()=>go('/');
      brand.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')go('/')};
    }
    const select=document.createElement('select');
    select.id='portalMobileNav';
    select.className='portal-mobile-menu';
    select.setAttribute('aria-label','Site navigation');
    select.innerHTML='<option value="">Menu</option>'+[
      ['Home','/'],['Weekly','/chart/daegon-100'],['Songs','/songs'],['Albums','/albums'],['Artists','/artists'],
      ["#1's",'/number-ones'],['Stats','/stats'],['Year-End','/year-end'],['Decade-End','/decade-end'],
      ['GOAT','/goat'],['Chart Beat','/chart-beat'],['Awards','/awards'],['Battle','/chart-battle'],['Search','/search']
    ].map(([l,p])=>'<option value="'+p+'">'+l+'</option>').join('');
    select.onchange=()=>{if(select.value)go(select.value);select.value=''};
    head.insertBefore(select,theme);
  }
}

function setMode(portal){
  ensureShell();
  document.body.classList.toggle('portal-mode',!!portal);
  document.body.classList.toggle('weekly-mode',!portal);
  if(portal){
    weeklyEl.style.display='none';
    portalEl.classList.add('active');
    portalEl.removeAttribute('hidden');
  }else{
    weeklyEl.style.display='';
    portalEl.classList.remove('active');
    portalEl.setAttribute('hidden','');
  }
}
function loading(title='Loading'){
  setMode(true);
  portalEl.innerHTML='<div class="portal-hero"><div class="portal-kicker">Daegon Charts</div><h1 class="portal-title">'+esc(title)+'</h1><p class="portal-subtitle">Loading chart archive…</p></div><div class="loader-wrap"><div class="loader"></div></div>';
}
function setMeta(title,desc,path){
  document.title=title+' | Daegon Charts';
  const d=document.querySelector('meta[name="description"]');if(d)d.content=desc;
  const c=document.querySelector('link[rel="canonical"]');if(c)c.href='https://daegoncharts.com.br'+path;
  const u=document.querySelector('meta[property="og:url"]');if(u)u.content='https://daegoncharts.com.br'+path;
  const t=document.querySelector('meta[property="og:title"]');if(t)t.content=document.title;
  const od=document.querySelector('meta[property="og:description"]');if(od)od.content=desc;
}
function sideHtml(){
  return '<aside class="portal-side">'+
    '<div class="portal-sidebox"><h3>Explore</h3><div class="portal-side-links">'+
      [['Weekly Charts','/chart/daegon-100'],['Songs','/songs'],['Albums','/albums'],['Artists','/artists'],["Number One's",'/number-ones'],['Stats','/stats']]
      .map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('')+
    '</div></div>'+
    '<div class="portal-sidebox"><h3>Rankings</h3><div class="portal-side-links">'+
      [['Year-End','/year-end'],['Decade-End','/decade-end'],['Greatest of All Time','/goat'],['Awards','/awards']]
      .map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('')+
    '</div></div>'+
    '<div class="portal-sidebox"><h3>Features</h3><div class="portal-side-links">'+
      [['Chart Beat','/chart-beat'],['Chart Battle','/chart-battle'],['Search','/search']]
      .map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('')+
    '</div></div>'+
  '</aside>';
}
function shellHtml(main){return '<div class="portal-shell"><div class="portal-main">'+main+'</div>'+sideHtml()+'</div>'}

async function hydratePortalImages(){
  const nodes=[...portalEl.querySelectorAll('[data-portal-image]')];
  const limit=6;let i=0;
  async function worker(){
    while(i<nodes.length){
      const node=nodes[i++],kind=node.dataset.kind,name=node.dataset.name,artist=node.dataset.artist||name;
      const cfg={kind};
      try{
        const url=await resolveImage({name,artist},cfg);
        if(url&&node.isConnected)node.innerHTML='<img src="'+escAttr(url)+'" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">';
      }catch{}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,nodes.length)},()=>worker()));
}
function thumb(e,kind,size=54){
  return '<div data-portal-image data-kind="'+kind+'" data-name="'+escAttr(e.name)+'" data-artist="'+escAttr(e.artist||e.name)+'" style="width:'+size+'px;height:'+size+'px;background:var(--muted);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas '+iconFor(kind)+'" style="opacity:.28"></i></div>';
}
function entityLink(e,kind,text){
  const p=entityPath(e,kind);
  return '<a class="portal-link" href="'+appHref(p)+'" data-portal-link="'+p+'">'+esc(text??e.name)+'</a>';
}

function aggregateCatalog(data,kind){
  const m=new Map();
  for(const d of data.dates){
    for(const e of data.entriesByDate[d]||[]){
      const key=kind==='artist'?String(e.name).toLowerCase():itemKey(e);
      let x=m.get(key);
      if(!x){x={name:e.name,artist:e.artist,peak:e.position,weeks:0,weeksAt1:0,first:d,last:d,lastEntry:e};m.set(key,x)}
      x.weeks++;x.peak=Math.min(x.peak,e.position);if(e.position===1)x.weeksAt1++;x.last=d;x.lastEntry=e;
    }
  }
  return [...m.values()].sort((a,b)=>b.weeks-a.weeks||a.peak-b.peak||a.name.localeCompare(b.name));
}
function aggregatePeriod(data,chartId,predicate){
  const kind=charts[chartId].kind,m=new Map();
  for(const d of data.dates){
    if(!predicate(d))continue;
    for(const e of data.entriesByDate[d]||[]){
      const key=kind==='artist'?String(e.name).toLowerCase():itemKey(e);
      let x=m.get(key);
      if(!x){x={name:e.name,artist:e.artist,score:0,weeks:0,peak:e.position,weeksAt1:0,lastEntry:e};m.set(key,x)}
      x.score+=rankPoints(e.position,chartId);x.weeks++;x.peak=Math.min(x.peak,e.position);if(e.position===1)x.weeksAt1++;x.lastEntry=e;
    }
  }
  return [...m.values()].sort((a,b)=>b.score-a.score||b.weeks-a.weeks||a.peak-b.peak);
}
function latestEntry(data){const d=data.dates[data.dates.length-1]||'';return {date:d,entries:data.entriesByDate[d]||[]}}

async function renderHome(){
  loading('Home');
  const [s,a,r]=await Promise.all([loadWeekly('songs'),loadWeekly('albums'),loadWeekly('artists')]);
  const packs=[['songs',s],['albums',a],['artists',r]];
  const no1=packs.map(([id,data])=>{const l=latestEntry(data);return{id,data,date:l.date,e:l.entries[0]}});
  const firstTimers=[];
  for(const d of [...r.dates].reverse()){
    for(const e of r.entriesByDate[d]||[]){
      if(e.diff==='NEW'&&!firstTimers.some(x=>x.name===e.name)){firstTimers.push({...e,date:d});if(firstTimers.length>=4)break}
    }
    if(firstTimers.length>=4)break;
  }
  const songLatest=latestEntry(s),top10=songLatest.entries.slice(0,10);
  const historic=[];
  const latestDate=songLatest.date;
  const md=latestDate.slice(5);
  for(const d of [...s.dates].reverse()){
    if(d===latestDate||d.slice(5)!==md)continue;
    const e=(s.entriesByDate[d]||[])[0];
    if(e)historic.push({date:d,e});
    if(historic.length>=6)break;
  }
  const main=
    '<div class="portal-hero"><div class="portal-kicker">Music chart archive</div><h1 class="portal-title">Daegon Charts</h1><p class="portal-subtitle">Weekly charts, historical runs, year-end rankings, decade lists, all-time rankings and artist/song/album history from the same archive.</p></div>'+
    '<section class="portal-section"><div class="portal-section-head"><h2>No. 1 This Week</h2><a class="portal-more" href="'+appHref('/number-ones')+'" data-portal-link="/number-ones">View all</a></div><div class="portal-home-strip">'+
      no1.map(x=>x.e?'<div class="portal-no1">'+thumb(x.e,charts[x.id].kind,58)+'<div><div class="portal-label">'+esc(charts[x.id].title)+'</div><div class="portal-card-title">'+entityLink(x.e,charts[x.id].kind)+'</div>'+(charts[x.id].kind!=='artist'?'<div class="portal-card-sub">'+esc(x.e.artist)+'</div>':'')+'</div></div>':'').join('')+
    '</div></section>'+
    '<section class="portal-section"><div class="portal-section-head"><h2>Daegon 100 — Top 10</h2><a class="portal-more" href="'+appHref(chartPath('songs',songLatest.date))+'">Full chart</a></div><div class="portal-list">'+
      top10.map(e=>'<div class="portal-row"><div class="portal-row-rank">'+e.position+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(e,'song')+'</div><div class="portal-row-sub">'+esc(e.artist)+'</div></div><div class="portal-row-meta">Peak '+esc(e.peak||'-')+' · '+esc(e.weeks||'-')+' wks</div></div>').join('')+
    '</div></section>'+
    '<section class="portal-section"><div class="portal-section-head"><h2>First-Timers</h2><a class="portal-more" href="'+appHref('/artists')+'" data-portal-link="/artists">Artists</a></div><div class="portal-grid four">'+
      firstTimers.map(e=>'<div class="portal-card clickable" data-go="'+entityPath(e,'artist')+'">'+thumb(e,'artist',72)+'<div class="portal-label" style="margin-top:9px">Debut #'+e.position+' · '+fmtShort(e.date)+'</div><div class="portal-card-title">'+entityLink(e,'artist')+'</div></div>').join('')+
    '</div></section>'+
    '<section class="portal-section"><div class="portal-section-head"><h2>On This Week</h2><span class="portal-more">History</span></div><div class="portal-grid">'+
      historic.map(x=>'<div class="portal-card"><div class="portal-label">'+fmtShort(x.date)+'</div><div class="portal-rank">#1</div><div class="portal-card-title">'+entityLink(x.e,'song')+'</div><div class="portal-card-sub">'+esc(x.e.artist)+'</div></div>').join('')+
    '</div></section>'+
    '<section class="portal-section"><div class="portal-section-head"><h2>Chart Beat</h2><a class="portal-more" href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">View all</a></div>'+
      '<div class="portal-panel"><div class="portal-card-title">'+esc(top10[0]?.name||'')+' leads the Daegon 100 for the week of '+fmtDate(songLatest.date)+'.</div><div class="portal-card-sub">Explore the week’s No. 1, Top 10, debuts, re-entries and biggest movers.</div></div>'+
    '</section>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Daegon Charts','Weekly music charts and historical archive.','/');hydratePortalImages();
}

async function renderCatalog(kind){
  const id=chartIdForKind(kind);
  loading(labelFor(kind)+'s');
  const data=await loadWeekly(id),items=aggregateCatalog(data,kind);
  portalState.catalog=items;portalState.catalogKind=kind;
  const main='<div class="portal-hero"><div class="portal-kicker">Archive</div><h1 class="portal-title">'+labelFor(kind)+'s</h1><p class="portal-subtitle">'+fmtNum(items.length)+' '+labelFor(kind).toLowerCase()+'s in the chart archive.</p></div>'+
    '<div class="portal-toolbar"><input id="catalogSearch" class="portal-input" placeholder="Search '+labelFor(kind).toLowerCase()+'s…" autocomplete="off"><select id="catalogSort" class="portal-select"><option value="weeks">Most weeks</option><option value="peak">Best peak</option><option value="recent">Most recent</option><option value="name">Name</option></select></div>'+
    '<div id="catalogRows"></div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(labelFor(kind)+'s','Browse '+labelFor(kind).toLowerCase()+' chart history.','/'+kind+'s');
  const search=document.getElementById('catalogSearch'),sort=document.getElementById('catalogSort');
  const redraw=()=>{
    let arr=[...items],q=search.value.trim().toLowerCase();
    if(q)arr=arr.filter(x=>(x.name+' '+(x.artist||'')).toLowerCase().includes(q));
    if(sort.value==='peak')arr.sort((a,b)=>a.peak-b.peak||b.weeks-a.weeks);
    else if(sort.value==='recent')arr.sort((a,b)=>b.last.localeCompare(a.last));
    else if(sort.value==='name')arr.sort((a,b)=>a.name.localeCompare(b.name));
    else arr.sort((a,b)=>b.weeks-a.weeks||a.peak-b.peak);
    document.getElementById('catalogRows').innerHTML='<div class="portal-list">'+arr.slice(0,500).map((x,i)=>'<div class="portal-row"><div class="portal-row-rank">'+(i+1)+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">Peak #'+x.peak+' · '+x.weeks+' weeks'+(x.weeksAt1?' · '+x.weeksAt1+' at #1':'')+'</div></div>').join('')+'</div>';
    bindLinks();
  };
  search.oninput=redraw;sort.onchange=redraw;redraw();
}

async function findEntity(kind,slug){
  const id=chartIdForKind(kind),data=await loadWeekly(id);
  let found=null;
  outer:for(const d of data.dates){
    for(const e of data.entriesByDate[d]||[]){
      if(entitySlug(e,kind)===slug){found=e;break outer}
    }
  }
  return {data,found};
}
async function renderDetail(kind,slug){
  loading(labelFor(kind));
  const {data,found}=await findEntity(kind,slug);
  if(!found){renderNotFound();return}
  const runs=[];
  for(const d of data.dates){
    const e=(data.entriesByDate[d]||[]).find(x=>entitySlug(x,kind)===slug);
    if(e)runs.push({...e,date:d});
  }
  const peak=Math.min(...runs.map(x=>x.position)),weeks=runs.length,weeksAt1=runs.filter(x=>x.position===1).length,first=runs[0]?.date,last=runs[runs.length-1]?.date;
  let extras='';
  if(kind==='artist'){
    const [songs,albums]=await Promise.all([loadWeekly('songs'),loadWeekly('albums')]);
    const artist=String(found.name).toLowerCase(),collect=(d,k)=>{
      const m=new Map();
      for(const date of d.dates)for(const e of d.entriesByDate[date]||[])if(String(e.artist).toLowerCase()===artist){
        const key=itemKey(e),x=m.get(key)||{...e,peak:e.position,weeks:0};x.peak=Math.min(x.peak,e.position);x.weeks++;m.set(key,x)
      }
      return [...m.values()].sort((a,b)=>a.peak-b.peak||b.weeks-a.weeks);
    };
    const ss=collect(songs,'song').slice(0,20),aa=collect(albums,'album').slice(0,20);
    extras='<section class="portal-section"><div class="portal-section-head"><h2>Charting Songs</h2></div><div class="portal-list">'+ss.map(e=>'<div class="portal-row"><div class="portal-row-rank">#'+e.peak+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(e,'song')+'</div></div><div class="portal-row-meta">'+e.weeks+' weeks</div></div>').join('')+'</div></section>'+
      '<section class="portal-section"><div class="portal-section-head"><h2>Charting Albums</h2></div><div class="portal-list">'+aa.map(e=>'<div class="portal-row"><div class="portal-row-rank">#'+e.peak+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(e,'album')+'</div></div><div class="portal-row-meta">'+e.weeks+' weeks</div></div>').join('')+'</div></section>';
  }else if(kind==='album'){
    const songs=await loadWeekly('songs'),albumName=String(found.name).toLowerCase(),tracks=new Map();
    for(const d of songs.dates)for(const e of songs.entriesByDate[d]||[])if(String(e.album||'').toLowerCase()===albumName){
      const k=itemKey(e),x=tracks.get(k)||{...e,peak:e.position,weeks:0};x.peak=Math.min(x.peak,e.position);x.weeks++;tracks.set(k,x)
    }
    const arr=[...tracks.values()].sort((a,b)=>a.peak-b.peak||b.weeks-a.weeks);
    if(arr.length)extras='<section class="portal-section"><div class="portal-section-head"><h2>Charting Tracks</h2></div><div class="portal-list">'+arr.map(e=>'<div class="portal-row"><div class="portal-row-rank">#'+e.peak+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(e,'song')+'</div><div class="portal-row-sub">'+esc(e.artist)+'</div></div><div class="portal-row-meta">'+e.weeks+' weeks</div></div>').join('')+'</div></section>';
  }
  const displayArtist=kind!=='artist'&&found.artist?'<p class="portal-subtitle">'+esc(found.artist)+'</p>':'';
  const main='<div class="portal-hero"><div style="display:flex;gap:18px;align-items:center">'+thumb(found,kind,110)+'<div><div class="portal-kicker">'+labelFor(kind)+' history</div><h1 class="portal-title">'+esc(found.name)+'</h1>'+displayArtist+'</div></div></div>'+
    '<div class="portal-stats"><div class="portal-statbox"><div class="portal-stat">#'+peak+'</div><div class="portal-stat-sub">Peak</div></div><div class="portal-statbox"><div class="portal-stat">'+weeks+'</div><div class="portal-stat-sub">Weeks</div></div><div class="portal-statbox"><div class="portal-stat">'+weeksAt1+'</div><div class="portal-stat-sub">Weeks at #1</div></div><div class="portal-statbox"><div class="portal-stat">'+fmtShort(first)+'</div><div class="portal-stat-sub">First entry</div></div></div>'+
    '<section class="portal-section" style="margin-top:24px"><div class="portal-section-head"><h2>Chart Run</h2><span class="portal-more">'+fmtShort(first)+' — '+fmtShort(last)+'</span></div><div class="portal-panel portal-timeline">'+
      [...runs].reverse().map(x=>'<div class="portal-run"><span>'+fmtShort(x.date)+'</span><strong>#'+x.position+'</strong><span>Peak #'+(x.peak||peak)+' · Week '+(x.weeks||'')+(x.diff?' · '+esc(x.diff):'')+'</span></div>').join('')+
    '</div></section>'+extras;
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(found.name,found.name+' chart history on Daegon Charts.',entityPath(found,kind));hydratePortalImages();
}

async function renderNumberOnes(){
  loading("Number One's");
  const datasets=await Promise.all(['songs','albums','artists'].map(loadWeekly));
  let rows=[];
  datasets.forEach((d,i)=>{const id=['songs','albums','artists'][i];for(const date of d.dates){const e=(d.entriesByDate[date]||[])[0];if(e&&e.position===1)rows.push({id,date,e,kind:charts[id].kind})}});
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  const main='<div class="portal-hero"><div class="portal-kicker">Archive</div><h1 class="portal-title">Number One’s</h1><p class="portal-subtitle">Every weekly No. 1 across the three main Daegon Charts.</p></div>'+
    '<div class="portal-toolbar"><button class="portal-btn active" data-no1="all">All</button><button class="portal-btn" data-no1="songs">Songs</button><button class="portal-btn" data-no1="albums">Albums</button><button class="portal-btn" data-no1="artists">Artists</button></div><div id="no1Rows"></div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta("Number One's","Weekly number one archive.","/number-ones");
  const draw=id=>{document.getElementById('no1Rows').innerHTML='<div class="portal-list">'+rows.filter(x=>id==='all'||x.id===id).slice(0,1000).map(x=>'<div class="portal-row"><div class="portal-row-rank">#1</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x.e,x.kind)+'</div><div class="portal-row-sub">'+(x.kind!=='artist'?esc(x.e.artist)+' · ':'')+esc(charts[x.id].title)+'</div></div><div class="portal-row-meta">'+fmtShort(x.date)+'</div></div>').join('')+'</div>';bindLinks()};
  portalEl.querySelectorAll('[data-no1]').forEach(b=>b.onclick=()=>{portalEl.querySelectorAll('[data-no1]').forEach(x=>x.classList.toggle('active',x===b));draw(b.dataset.no1)});draw('all');
}

async function renderStats(){
  loading('Stats');
  const ids=['songs','albums','artists'],datasets=await Promise.all(ids.map(loadWeekly));
  const sections=datasets.map((data,i)=>{
    const id=ids[i],kind=charts[id].kind,items=aggregateCatalog(data,kind);
    const mostWeeks=[...items].sort((a,b)=>b.weeks-a.weeks).slice(0,10);
    const mostNo1=[...items].sort((a,b)=>b.weeksAt1-a.weeksAt1||b.weeks-a.weeks).slice(0,10);
    return '<section class="portal-section"><div class="portal-section-head"><h2>'+esc(charts[id].title)+'</h2></div><div class="portal-grid"><div class="portal-panel"><div class="portal-label">Most weeks charted</div>'+mostWeeks.map((x,n)=>'<div class="portal-run"><span>#'+(n+1)+'</span><strong>'+entityLink(x,kind)+'</strong><span>'+x.weeks+' weeks</span></div>').join('')+'</div><div class="portal-panel"><div class="portal-label">Most weeks at #1</div>'+mostNo1.map((x,n)=>'<div class="portal-run"><span>#'+(n+1)+'</span><strong>'+entityLink(x,kind)+'</strong><span>'+x.weeksAt1+' weeks</span></div>').join('')+'</div><div class="portal-panel"><div class="portal-label">Archive size</div><div class="portal-stat" style="margin-top:10px">'+fmtNum(items.length)+'</div><div class="portal-stat-sub">unique '+labelFor(kind).toLowerCase()+'s</div></div></div></section>';
  }).join('');
  setMode(true);portalEl.innerHTML=shellHtml('<div class="portal-hero"><div class="portal-kicker">Records</div><h1 class="portal-title">Stats</h1><p class="portal-subtitle">Records calculated directly from the weekly archive.</p></div>'+sections);setMeta('Stats','Daegon Charts archive records.','/stats');
}

async function renderPeriod(type,kindSeg){
  const chartId={songs:'songs',albums:'albums',artists:'artists'}[kindSeg]||'songs',kind=charts[chartId].kind;
  loading(type==='year'?'Year-End':'Decade-End');
  const data=await loadWeekly(chartId),years=[...new Set(data.dates.map(d=>d.slice(0,4)))].sort().reverse();
  const decades=[...new Set(years.map(y=>Math.floor(Number(y)/10)*10))].sort((a,b)=>b-a);
  const selected=type==='year'?(new URLSearchParams(location.search).get('year')||years[0]):String(new URLSearchParams(location.search).get('decade')||decades[0]);
  const pred=type==='year'?d=>d.startsWith(selected+'-'):d=>Number(d.slice(0,4))>=Number(selected)&&Number(d.slice(0,4))<Number(selected)+10;
  const arr=aggregatePeriod(data,chartId,pred).slice(0,100);
  const path='/'+(type==='year'?'year-end':'decade-end')+'/'+kindSeg;
  const options=(type==='year'?years:decades.map(String)).map(v=>'<option value="'+v+'" '+(String(v)===String(selected)?'selected':'')+'>'+v+(type==='decade'?'s':'')+'</option>').join('');
  const main='<div class="portal-hero"><div class="portal-kicker">'+(type==='year'?'Annual ranking':'Decade ranking')+'</div><h1 class="portal-title">'+(type==='year'?'Year-End':'Decade-End')+' '+esc(charts[chartId].title)+'</h1><p class="portal-subtitle">Calculated from weekly chart performance across the selected period.</p></div>'+
    '<div class="portal-toolbar"><select id="periodChart" class="portal-select"><option value="songs" '+(kindSeg==='songs'?'selected':'')+'>Songs</option><option value="albums" '+(kindSeg==='albums'?'selected':'')+'>Albums</option><option value="artists" '+(kindSeg==='artists'?'selected':'')+'>Artists</option></select><select id="periodValue" class="portal-select">'+options+'</select></div>'+
    '<div class="portal-list">'+arr.map((x,i)=>'<div class="portal-row"><div class="portal-row-rank">'+(i+1)+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">'+x.weeks+' weeks · Peak #'+x.peak+'</div></div>').join('')+'</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(type==='year'?'Year-End Charts':'Decade-End Charts','Period rankings from the Daegon Charts archive.',path);
  document.getElementById('periodChart').onchange=e=>go('/'+(type==='year'?'year-end':'decade-end')+'/'+e.target.value);
  document.getElementById('periodValue').onchange=e=>{const q=type==='year'?'year':'decade';history.replaceState({},'',appHref(path)+'?'+q+'='+encodeURIComponent(e.target.value));renderPeriod(type,kindSeg)};
}

async function renderGoat(kindSeg){
  const chartId={songs:'songs',albums:'albums',artists:'artists'}[kindSeg]||'songs',kind=charts[chartId].kind;
  loading('Greatest of All Time');
  const data=await loadWeekly(chartId),arr=aggregatePeriod(data,chartId,()=>true).slice(0,100);
  const main='<div class="portal-hero"><div class="portal-kicker">All-time ranking</div><h1 class="portal-title">Greatest of All Time — '+esc(charts[chartId].title)+'</h1><p class="portal-subtitle">All weekly chart performance combined across the full archive.</p></div>'+
    '<div class="portal-toolbar"><button class="portal-btn '+(kindSeg==='songs'?'active':'')+'" data-goat="songs">Songs</button><button class="portal-btn '+(kindSeg==='albums'?'active':'')+'" data-goat="albums">Albums</button><button class="portal-btn '+(kindSeg==='artists'?'active':'')+'" data-goat="artists">Artists</button></div>'+
    '<div class="portal-list">'+arr.map((x,i)=>'<div class="portal-row"><div class="portal-row-rank">'+(i+1)+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">'+x.weeks+' weeks · '+x.weeksAt1+' at #1</div></div>').join('')+'</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Greatest of All Time','All-time Daegon Charts rankings.','/goat/'+kindSeg);
  portalEl.querySelectorAll('[data-goat]').forEach(b=>b.onclick=()=>go('/goat/'+b.dataset.goat));
}

async function renderChartBeat(){
  loading('Chart Beat');
  const data=await loadWeekly('songs'),dates=[...data.dates].reverse().slice(0,52);
  const cards=dates.map(d=>{
    const entries=data.entriesByDate[d]||[],no1=entries[0],debuts=entries.filter(x=>x.diff==='NEW').slice(0,3),mover=[...entries].filter(x=>String(x.diff).startsWith('▲')).sort((a,b)=>toInt(b.diff.slice(1))-toInt(a.diff.slice(1)))[0];
    return '<article class="portal-panel"><div class="portal-label">'+fmtDate(d)+'</div><h2 style="margin:6px 0 8px;font-size:19px">'+esc(no1?.name||'')+' leads the Daegon 100</h2><p class="portal-card-sub">'+(no1?esc(no1.artist)+' holds No. 1. ':'')+(debuts.length?'New entries include '+debuts.map(x=>esc(x.name)).join(', ')+'. ':'')+(mover?'Biggest upward move: '+esc(mover.name)+' ('+esc(mover.diff)+').':'')+'</p><a class="portal-more" href="'+appHref(chartPath('songs',d))+'">View chart →</a></article>';
  }).join('');
  setMode(true);portalEl.innerHTML=shellHtml('<div class="portal-hero"><div class="portal-kicker">Weekly editorial</div><h1 class="portal-title">Chart Beat</h1><p class="portal-subtitle">Automatic weekly summaries generated from the Daegon 100 archive.</p></div>'+cards);setMeta('Chart Beat','Weekly chart summaries.','/chart-beat');
}

async function renderAwards(){
  loading('Awards');
  const datasets=await Promise.all(['songs','albums','artists'].map(loadWeekly));
  const years=[...new Set(datasets.flatMap(d=>d.dates.map(x=>x.slice(0,4))))].sort().reverse(),selected=new URLSearchParams(location.search).get('year')||years[0];
  const winners=datasets.map((d,i)=>{const id=['songs','albums','artists'][i];return{id,kind:charts[id].kind,list:aggregatePeriod(d,id,x=>x.startsWith(selected+'-')).slice(0,5)}});
  const main='<div class="portal-hero"><div class="portal-kicker">Annual honors</div><h1 class="portal-title">Daegon Awards '+selected+'</h1><p class="portal-subtitle">Annual leaders derived from year-long weekly chart performance.</p></div><div class="portal-toolbar"><select id="awardYear" class="portal-select">'+years.map(y=>'<option '+(y===selected?'selected':'')+'>'+y+'</option>').join('')+'</select></div><div class="portal-grid">'+
    winners.map(w=>'<div class="portal-panel"><div class="portal-label">'+esc(charts[w.id].title)+'</div><h2 style="margin:7px 0 12px">'+(w.kind==='song'?'Song':w.kind==='album'?'Album':'Artist')+' of the Year</h2>'+(w.list[0]?'<div class="portal-card-title" style="font-size:18px">'+entityLink(w.list[0],w.kind)+'</div>'+(w.kind!=='artist'?'<div class="portal-card-sub">'+esc(w.list[0].artist)+'</div>':''):'')+'<div style="margin-top:14px">'+w.list.slice(1).map((x,i)=>'<div class="portal-run"><span>#'+(i+2)+'</span><strong>'+entityLink(x,w.kind)+'</strong><span></span></div>').join('')+'</div></div>').join('')+
    '</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Awards','Daegon Charts annual awards.','/awards');
  document.getElementById('awardYear').onchange=e=>{history.replaceState({},'',appHref('/awards')+'?year='+e.target.value);renderAwards()};
}

async function renderBattle(){
  loading('Chart Battle');
  const kind=new URLSearchParams(location.search).get('kind')||portalState.battleKind||'song';portalState.battleKind=kind;
  const data=await loadWeekly(chartIdForKind(kind)),items=aggregateCatalog(data,kind).slice(0,200);
  const aSlug=new URLSearchParams(location.search).get('a')||entitySlug(items[0]||{},kind),bSlug=new URLSearchParams(location.search).get('b')||entitySlug(items[1]||items[0]||{},kind);
  const a=items.find(x=>entitySlug(x,kind)===aSlug)||items[0],b=items.find(x=>entitySlug(x,kind)===bSlug)||items[1]||items[0];
  const opts=sel=>items.map(x=>'<option value="'+entitySlug(x,kind)+'" '+(entitySlug(x,kind)===sel?'selected':'')+'>'+esc(x.name)+(kind!=='artist'?' — '+esc(x.artist):'')+'</option>').join('');
  const card=x=>'<div class="battle-card"><h3>'+entityLink(x,kind)+'</h3>'+(kind!=='artist'?'<div class="portal-card-sub">'+esc(x.artist)+'</div>':'')+'<div class="portal-stats" style="margin-top:16px"><div class="portal-statbox"><div class="portal-stat">#'+x.peak+'</div><div class="portal-stat-sub">Peak</div></div><div class="portal-statbox"><div class="portal-stat">'+x.weeks+'</div><div class="portal-stat-sub">Weeks</div></div><div class="portal-statbox"><div class="portal-stat">'+x.weeksAt1+'</div><div class="portal-stat-sub">At #1</div></div><div class="portal-statbox"><div class="portal-stat">'+fmtShort(x.first)+'</div><div class="portal-stat-sub">Debut</div></div></div></div>';
  const main='<div class="portal-hero"><div class="portal-kicker">Compare chart history</div><h1 class="portal-title">Chart Battle</h1><p class="portal-subtitle">Compare two songs, albums or artists from the archive.</p></div><div class="portal-toolbar"><select id="battleKind" class="portal-select"><option value="song" '+(kind==='song'?'selected':'')+'>Songs</option><option value="album" '+(kind==='album'?'selected':'')+'>Albums</option><option value="artist" '+(kind==='artist'?'selected':'')+'>Artists</option></select><select id="battleA" class="portal-select" style="flex:1">'+opts(entitySlug(a,kind))+'</select><select id="battleB" class="portal-select" style="flex:1">'+opts(entitySlug(b,kind))+'</select></div><div class="battle-grid">'+card(a)+'<div class="battle-vs">VS</div>'+card(b)+'</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Chart Battle','Compare chart histories.','/chart-battle');
  const update=()=>go('/chart-battle?kind='+document.getElementById('battleKind').value+'&a='+encodeURIComponent(document.getElementById('battleA').value)+'&b='+encodeURIComponent(document.getElementById('battleB').value));
  document.getElementById('battleKind').onchange=e=>go('/chart-battle?kind='+e.target.value);
  document.getElementById('battleA').onchange=update;document.getElementById('battleB').onchange=update;
}

async function renderSearch(){
  loading('Search');
  const [songs,albums,artists]=await Promise.all([loadWeekly('songs'),loadWeekly('albums'),loadWeekly('artists')]);
  const all=[
    ...aggregateCatalog(songs,'song').map(x=>({...x,kind:'song'})),
    ...aggregateCatalog(albums,'album').map(x=>({...x,kind:'album'})),
    ...aggregateCatalog(artists,'artist').map(x=>({...x,kind:'artist'}))
  ];
  const main='<div class="portal-hero"><div class="portal-kicker">Archive search</div><h1 class="portal-title">Search</h1><p class="portal-subtitle">Search songs, albums and artists across the complete archive.</p></div><div class="portal-toolbar"><input id="globalSearch" class="portal-input" placeholder="Type a song, album or artist…" autofocus></div><div id="searchRows" class="portal-empty">Start typing to search.</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Search','Search the Daegon Charts archive.','/search');
  const inp=document.getElementById('globalSearch'),rows=document.getElementById('searchRows');
  const draw=()=>{const q=inp.value.trim().toLowerCase();if(!q){rows.className='portal-empty';rows.innerHTML='Start typing to search.';return}const hits=all.filter(x=>(x.name+' '+(x.artist||'')).toLowerCase().includes(q)).slice(0,100);rows.className='portal-list';rows.innerHTML=hits.map((x,i)=>'<div class="portal-row"><div class="portal-row-rank"><i class="fas '+iconFor(x.kind)+'"></i></div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,x.kind)+'</div><div class="portal-row-sub">'+labelFor(x.kind)+(x.kind!=='artist'?' · '+esc(x.artist):'')+'</div></div><div class="portal-row-meta">Peak #'+x.peak+' · '+x.weeks+' weeks</div></div>').join('')||'<div class="portal-empty">No results.</div>';bindLinks()};inp.oninput=draw;
}

function renderNotFound(){
  setMode(true);portalEl.innerHTML='<div class="portal-hero"><div class="portal-kicker">404</div><h1 class="portal-title">Page not found</h1><p class="portal-subtitle">This archive page does not exist.</p><button class="portal-btn" id="home404" style="margin-top:14px">Go home</button></div>';document.getElementById('home404').onclick=()=>go('/');
}
function bindLinks(){
  portalEl.querySelectorAll('[data-portal-link]').forEach(a=>{a.onclick=e=>{e.preventDefault();go(a.dataset.portalLink)}});
  portalEl.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>go(x.dataset.go));
}
async function renderRoute(){
  ensureShell();
  const p=routeParts();
  try{
    if(!p.length){await renderHome()}
    else if(p[0]==='songs')await renderCatalog('song');
    else if(p[0]==='albums')await renderCatalog('album');
    else if(p[0]==='artists')await renderCatalog('artist');
    else if(p[0]==='song'&&p[1])await renderDetail('song',p[1]);
    else if(p[0]==='album'&&p[1])await renderDetail('album',p[1]);
    else if(p[0]==='artist'&&p[1])await renderDetail('artist',p[1]);
    else if(p[0]==='number-ones')await renderNumberOnes();
    else if(p[0]==='stats')await renderStats();
    else if(p[0]==='year-end')await renderPeriod('year',p[1]||'songs');
    else if(p[0]==='decade-end')await renderPeriod('decade',p[1]||'songs');
    else if(p[0]==='goat')await renderGoat(p[1]||'songs');
    else if(p[0]==='chart-beat')await renderChartBeat();
    else if(p[0]==='awards')await renderAwards();
    else if(p[0]==='chart-battle')await renderBattle();
    else if(p[0]==='search')await renderSearch();
    else renderNotFound();
    bindLinks();
  }catch(err){
    console.error(err);
    setMode(true);portalEl.innerHTML='<div class="portal-hero"><div class="portal-kicker">Error</div><h1 class="portal-title">This page did not load</h1><p class="portal-subtitle">'+esc(err?.message||'Unknown error')+'</p><button class="portal-btn" id="retryPortal" style="margin-top:14px">Try again</button></div>';document.getElementById('retryPortal').onclick=renderRoute;
  }
}
function activateWeeklyIfNeeded(){
  if(cleanPath().startsWith('/chart/')){
    setMode(false);
    const route=parseRoute();
    loadChart(route.id,route.date,{routeMode:'replace',scroll:false});
    return true;
  }
  return false;
}
function onDocumentClick(e){
  const a=e.target.closest('a');
  if(!a)return;
  const href=a.getAttribute('href')||'';
  if(!href.startsWith('/')&&!href.startsWith(basePrefix()+'/'))return;
  const raw=basePrefix()&&href.startsWith(basePrefix())?href.slice(basePrefix().length):href;
  if(raw.startsWith('/about')||raw.startsWith('/methodology')||raw.startsWith('/privacy')||raw.startsWith('/contact')||raw.startsWith('/terms'))return;
  if(raw.startsWith('/chart/')){
    e.preventDefault();history.pushState({},'',appHref(raw));activateWeeklyIfNeeded();return;
  }
  const first=raw.split('/').filter(Boolean)[0]||'';
  if(PORTAL_ROUTES.has(first)){e.preventDefault();go(raw)}
}

window.DaegonPortal={handles:isHandled,route:renderRoute,go,activateWeeklyIfNeeded};
ensureShell();
try{
  const savedRoute=sessionStorage.getItem('dc_route');
  if(savedRoute){
    sessionStorage.removeItem('dc_route');
    const prefix=basePrefix();
    const normalized=prefix&&savedRoute.startsWith(prefix)?savedRoute.slice(prefix.length):savedRoute;
    history.replaceState({},'',appHref(normalized||'/'));
  }
}catch{}
document.addEventListener('click',onDocumentClick);
window.addEventListener('popstate',()=>{if(!activateWeeklyIfNeeded())renderRoute()});
if(!activateWeeklyIfNeeded())renderRoute();
})();
