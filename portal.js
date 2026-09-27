(function(){
'use strict';

const PORTAL_ROUTES=new Set(['','songs','albums','artists','number-ones','stats','year-end','decade-end','goat','chart-beat','awards','chart-battle','search','song','album','artist']);
const mainChartIds={song:'songs',album:'albums',artist:'artists'};
const periodLimits={songs:100,albums:100,artists:50};
const PORTAL_SHEET='https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/gviz/tq?tq=select%20*&tqx=out:csv&gid=';
const officialYearEnd={
  songs:{gid:'530686468',kind:'song',title:'Daegon 100'},
  albums:{gid:'897935603',kind:'album',title:'Daegon Albums 100'},
  artists:{gid:'1597569311',kind:'artist',title:'Daegon Artists 50'}
};
const officialGoat={
  songs:{gid:'1157278896',kind:'song',title:'Greatest of All Time Songs'},
  albums:{gid:'1548244755',kind:'album',title:'Greatest of All Time Albums'},
  artists:{gid:'222299678',kind:'artist',title:'Greatest of All Time Artists'}
};
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
function pFind(header,names){
  const h=header.map(x=>String(x||'').trim().toLowerCase());
  for(const n of names){const i=h.indexOf(n.toLowerCase());if(i>=0)return i}
  return -1;
}
function pInt(v){
  let x=String(v??'').replace(/[^0-9-]/g,'');
  const n=parseInt(x,10);return Number.isFinite(n)?n:0;
}
async function loadOfficialRanking(cfg,{yearly=false}={}){
  const rows=await fetchCsv(PORTAL_SHEET+cfg.gid);
  if(!rows?.length)return yearly?{years:[],entriesByYear:{}}:{entries:[]};
  const header=rows[0];
  const idx={
    year:pFind(header,['year','ano']),
    pos:pFind(header,['position','rank','pos']),
    song:pFind(header,['song','title','track']),
    album:pFind(header,['album']),
    artist:pFind(header,['artist','artists']),
    peak:pFind(header,['peak']),
    weeks:pFind(header,['weeks','wks']),
    units:pFind(header,['units','points','sales','streams','audience']),
    total:pFind(header,['total units','total'])
  };
  const nameIdx=cfg.kind==='artist'?idx.artist:cfg.kind==='album'?idx.album:idx.song;
  const parseRow=r=>({
    position:pInt(r[idx.pos]),
    name:String(r[nameIdx]??'').trim(),
    artist:String(r[idx.artist]??'').trim(),
    peak:pInt(r[idx.peak]),
    weeks:pInt(r[idx.weeks]),
    units:idx.units>=0?String(r[idx.units]??'').trim():'',
    totalUnits:idx.total>=0?String(r[idx.total]??'').trim():''
  });
  if(yearly){
    const entriesByYear={};
    for(const r of rows.slice(1)){
      const year=String(r[idx.year]??'').trim(),e=parseRow(r);
      if(!year||!e.position||!e.name)continue;
      (entriesByYear[year]??=[]).push(e);
    }
    for(const y of Object.keys(entriesByYear))entriesByYear[y].sort((a,b)=>a.position-b.position);
    return {years:Object.keys(entriesByYear).sort((a,b)=>Number(b)-Number(a)),entriesByYear};
  }
  const entries=rows.slice(1).map(parseRow).filter(e=>e.position&&e.name).sort((a,b)=>a.position-b.position);
  return {entries};
}

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
      ['DAEGON 100','/chart/daegon-100'],['CHART BEAT','/chart-beat'],['YEAR-END CHARTS','/year-end'],
      ['DECADE-END','/decade-end'],['GREATEST OF ALL TIME','/goat'],['STATS','/stats'],
      ['AWARDS','/awards'],["#1'S",'/number-ones'],['ABOUT','/about']
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
    const mobileBtn=document.createElement('button');
    mobileBtn.id='portalMenuToggle';
    mobileBtn.className='portal-menu-toggle';
    mobileBtn.setAttribute('aria-label','Menu');
    mobileBtn.innerHTML='<span class="portal-hamb"><span></span><span></span><span></span></span>';
    const mobileMenu=document.createElement('div');
    mobileMenu.id='portalMobileMenu';
    mobileMenu.className='portal-mobile-drawer';
    mobileMenu.innerHTML=[
      ['DAEGON 100','/chart/daegon-100'],['CHART BEAT','/chart-beat'],['YEAR-END CHARTS','/year-end'],
      ['DECADE-END','/decade-end'],['GREATEST OF ALL TIME','/goat'],['STATS','/stats'],
      ['AWARDS','/awards'],["#1'S",'/number-ones'],['ABOUT','/about']
    ].map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('');
    mobileBtn.onclick=()=>mobileMenu.classList.toggle('open');
    head.insertBefore(mobileBtn,theme);
    const searchBtn=document.createElement('button');
    searchBtn.id='portalSearchBtn';
    searchBtn.className='portal-search-btn';
    searchBtn.setAttribute('aria-label','Search');
    searchBtn.innerHTML='<i class="fas fa-search"></i>';
    searchBtn.onclick=()=>go('/search');
    head.insertBefore(searchBtn,theme);
    document.querySelector('.site-header').appendChild(mobileMenu);
  }
}

function setMode(portal){
  ensureShell();
  document.body.classList.toggle('portal-mode',!!portal);
  document.body.classList.toggle('weekly-mode',!portal);
  const footer=document.querySelector('.site-footer');
  if(portal){
    weeklyEl.style.display='none';
    portalEl.classList.add('active');
    portalEl.removeAttribute('hidden');
    if(footer)footer.innerHTML='<div class="ref-footer-links"><a href="'+appHref('/artists')+'" data-portal-link="/artists">Artists</a><span>|</span><a href="'+appHref('/albums')+'" data-portal-link="/albums">Albums</a><span>|</span><a href="'+appHref('/songs')+'" data-portal-link="/songs">Songs</a></div><div class="ref-footer-copy"><p>Chart generated based on daegon charts archive.</p><p>Powered by TanStack Start.</p></div>';
  }else{
    weeklyEl.style.display='';
    portalEl.classList.remove('active');
    portalEl.setAttribute('hidden','');
    if(footer)footer.innerHTML='<nav class="footer-links" aria-label="Site information"><a href="/about">About</a><a href="/methodology">Methodology</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/terms">Terms</a></nav><div class="footer-copy">Daegon Charts — independent weekly music charts and historical archive.</div>';
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
  return '<aside class="ref-home-side">'+
    '<div class="ref-side-section"><div class="ref-side-title">Search Artists</div><div class="ref-side-search"><input id="refSideSearch" placeholder="Search Artists"><i class="fas fa-chevron-down"></i></div><div id="refSideResults" class="ref-side-results"></div></div>'+
    '<div class="ref-side-section"><div class="ref-side-title">Weekly Charts</div><div class="ref-side-links">'+
      ['songs','albums','artists','radioSongs','topStreamingAlbums','topAlbumSales','streamingSongs','digitalSongsSales'].map(id=>'<a href="'+appHref(chartPath(id))+'">'+esc(charts[id].title)+'</a>').join('')+
    '</div></div>'+
    '<div class="ref-side-section"><button class="ref-side-toggle" data-side-toggle="goat"><span>Greatest of All Time</span><i class="fas fa-chevron-down"></i></button><div class="ref-side-links ref-side-collapsible" data-side-panel="goat">'+
      '<a href="'+appHref('/goat/songs')+'" data-portal-link="/goat/songs">Songs</a><a href="'+appHref('/goat/artists')+'" data-portal-link="/goat/artists">Artists</a><a href="'+appHref('/goat/albums')+'" data-portal-link="/goat/albums">Albums</a>'+
    '</div></div>'+
    '<div class="ref-side-section"><button class="ref-side-toggle" data-side-toggle="yec"><span>Year-End Charts</span><i class="fas fa-chevron-down"></i></button><div class="ref-side-links ref-side-collapsible" data-side-panel="yec">'+
      '<a href="'+appHref('/year-end/songs')+'" data-portal-link="/year-end/songs">Daegon 100</a><a href="'+appHref('/year-end/artists')+'" data-portal-link="/year-end/artists">Daegon Artists 50</a><a href="'+appHref('/year-end/albums')+'" data-portal-link="/year-end/albums">Daegon Albums 100</a>'+
    '</div></div>'+
    '<a href="'+appHref('/stats')+'" data-portal-link="/stats" class="ref-side-section ref-side-stat"><div class="ref-side-title">Stats</div></a>'+
    '<div id="refOnThisWeek"></div>'+
  '</aside>';
}
function shellHtml(main,withSidebar=false){
  return withSidebar
    ? '<div class="portal-shell ref-home-shell">'+sideHtml()+'<div class="portal-main">'+main+'</div></div>'
    : '<div class="portal-main ref-standalone">'+main+'</div>';
}
function bindHomeSidebar(){
  const search=document.getElementById('refSideSearch'),results=document.getElementById('refSideResults');
  if(search&&results){
    const draw=async()=>{
      const q=search.value.trim().toLowerCase();
      if(!q){results.innerHTML='';return}
      const data=await loadWeekly('artists'),items=aggregateCatalog(data,'artist').filter(x=>x.name.toLowerCase().includes(q)).slice(0,8);
      results.innerHTML=items.map(x=>'<a href="'+appHref(entityPath(x,'artist'))+'" data-portal-link="'+entityPath(x,'artist')+'">'+esc(x.name)+'</a>').join('');
      bindLinks();
    };
    search.oninput=draw;
  }
  portalEl.querySelectorAll('[data-side-toggle]').forEach(btn=>btn.onclick=()=>{
    const key=btn.dataset.sideToggle,p=portalEl.querySelector('[data-side-panel="'+key+'"]'),i=btn.querySelector('i');
    p.classList.toggle('open');i.className='fas fa-chevron-'+(p.classList.contains('open')?'up':'down');
  });
}

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
function refThumb(e,kind){
  const round=kind==='artist'?' ref-thumb-round':'';
  return '<div class="ref-thumb'+round+'" data-portal-image data-kind="'+kind+'" data-name="'+escAttr(e.name)+'" data-artist="'+escAttr(e.artist||e.name)+'"><i class="fas '+iconFor(kind)+'"></i></div>';
}
function refHero(word,title,sub){
  return '<div class="ref-hero"><div class="ref-hero-bg">'+esc(word)+'</div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div>';
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
  const ids=['songs','albums','artists','radioSongs','topStreamingAlbums','topAlbumSales','streamingSongs','digitalSongsSales'];
  const all=await Promise.all(ids.map(async id=>{try{return await loadWeekly(id)}catch{return {chartId:id,dates:[],entriesByDate:{}}}}));
  const byId=Object.fromEntries(ids.map((id,i)=>[id,all[i]]));
  const mainIds=['songs','albums','artists'];
  const latest=id=>{const d=byId[id],date=d.dates[d.dates.length-1]||'';return{date,entries:d.entriesByDate[date]||[]}};
  const no1s=ids.map(id=>{const l=latest(id);return{id,date:l.date,e:l.entries[0]||null}});
  const artistsData=byId.artists,firstTimers=[];
  for(const d of [...artistsData.dates].reverse()){
    for(const e of artistsData.entriesByDate[d]||[]){
      if(e.diff==='NEW'&&!firstTimers.some(x=>x.name===e.name)){firstTimers.push({...e,date:d});if(firstTimers.length>=4)break}
    }
    if(firstTimers.length>=4)break;
  }
  const songLatest=latest('songs');
  const latestDate=songLatest.date;
  const currentYear=latestDate?Number(latestDate.slice(0,4)):new Date().getFullYear();
  const years=[];
  for(let y=currentYear;y>=2000;y--)years.push(y);

  const topSection=(active='songs')=>{
    const cfg=charts[active],l=latest(active),entries=l.entries.slice(0,5);
    return '<section class="ref-home-section"><div class="ref-section-banner"><span>Top Charts</span><a href="'+appHref(chartPath(active,l.date))+'">View Chart <i class="fas fa-arrow-right"></i></a></div>'+
      '<div class="ref-home-tabs"><button data-home-tab="songs" class="'+(active==='songs'?'active':'')+'">DAEGON 100</button><button data-home-tab="albums" class="'+(active==='albums'?'active':'')+'">DAEGON ALBUMS 100</button><button data-home-tab="artists" class="'+(active==='artists'?'active':'')+'">DAEGON ARTISTS 50</button></div>'+
      '<div class="ref-top-grid">'+entries.map(e=>'<div class="ref-top-card"><div class="ref-top-art">'+refThumb(e,cfg.kind)+'<div class="ref-rank-badge">'+e.position+'</div></div><div class="ref-top-copy"><div class="ref-top-title">'+entityLink(e,cfg.kind)+'</div>'+(cfg.kind!=='artist'?'<div class="ref-top-sub">'+esc(e.artist)+'</div>':'')+'</div></div>').join('')+'</div></section>';
  };

  const numberOnes='<section class="ref-home-section"><div class="ref-section-banner"><span>No. 1 This Week</span><a href="'+appHref('/number-ones')+'" data-portal-link="/number-ones">View All <i class="fas fa-arrow-right"></i></a></div><div class="ref-home-no1-grid">'+
    no1s.filter(x=>x.e).map(x=>'<div class="ref-home-no1"><div class="ref-home-no1-body">'+refThumb(x.e,charts[x.id].kind)+'<div><div class="ref-no1-chart">'+esc(charts[x.id].title)+'</div><div class="ref-no1-title">'+entityLink(x.e,charts[x.id].kind)+'</div>'+(charts[x.id].kind!=='artist'?'<div class="ref-no1-artist">'+esc(x.e.artist)+'</div>':'')+'</div></div><a href="'+appHref(chartPath(x.id,x.date))+'" class="ref-no1-view">View Chart →</a></div>').join('')+
    '</div></section>';

  const first='<section class="ref-home-section"><div class="ref-section-banner"><span>First-Timers</span><a href="'+appHref('/artists')+'" data-portal-link="/artists">View All <i class="fas fa-arrow-right"></i></a></div><div class="ref-first-grid">'+
    firstTimers.map(e=>'<div class="ref-first-card"><div class="ref-first-chart">'+esc(charts.artists.title)+'</div><div class="ref-first-art">'+refThumb(e,'artist')+'<span>DEBUT</span></div><div class="ref-first-copy"><div class="ref-first-pos">NO. '+e.position+'</div><div class="ref-first-title">'+entityLink(e,'artist')+'</div><a href="'+appHref(chartPath('artists',e.date))+'" class="ref-first-see">See Chart</a></div></div>').join('')+
    '</div></section>';

  const beatDates=[...byId.songs.dates].reverse().slice(0,3);
  const beat='<section class="ref-home-section"><div class="ref-section-banner"><span>Chart Beat</span><a href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">View All <i class="fas fa-arrow-right"></i></a></div><div class="ref-beat-list">'+
    beatDates.map(d=>{const es=byId.songs.entriesByDate[d]||[],e=es[0];return e?'<a href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat" class="ref-beat-card"><div class="ref-beat-art">'+refThumb({name:e.artist,artist:e.artist},'artist')+'</div><div class="ref-beat-copy"><div class="ref-no1-chart">'+esc(charts.songs.title)+'</div><div class="ref-beat-title">'+esc(e.name)+' leads the '+esc(charts.songs.title)+'</div><div class="ref-beat-date">'+fmtDate(d)+'</div></div></a>':''}).join('')+
    '</div></section>';

  const main='<div class="ref-home-hero"><div>CHARTS</div><h1>daegon charts</h1><p>Weekly music charts, year-end rankings & greatest of all time lists</p></div>'+
    '<div id="refTopCharts">'+topSection('songs')+'</div>'+numberOnes+first+beat+
    '<a href="'+appHref('/chart-battle')+'" data-portal-link="/chart-battle" class="ref-battle-float"><span>VS</span><div><small>New Mini-Game!</small><strong>Play Chart Battle 🏆</strong></div></a>';

  setMode(true);portalEl.innerHTML=shellHtml(main,true);setMeta('Daegon Charts','Weekly music charts, year-end rankings and greatest of all time lists.','/');
  bindLinks();hydratePortalImages();bindHomeSidebar();

  let active='songs',timer=null;
  const bindTabs=()=>{
    portalEl.querySelectorAll('[data-home-tab]').forEach(btn=>btn.onclick=()=>{active=btn.dataset.homeTab;document.getElementById('refTopCharts').innerHTML=topSection(active);bindLinks();hydratePortalImages();bindTabs();if(timer)clearInterval(timer);timer=setInterval(rotate,10000)});
  };
  const rotate=()=>{const order=['songs','albums','artists'];active=order[(order.indexOf(active)+1)%order.length];document.getElementById('refTopCharts').innerHTML=topSection(active);bindLinks();hydratePortalImages();bindTabs()};
  bindTabs();timer=setInterval(rotate,4000);

  const on=document.getElementById('refOnThisWeek');
  if(on){
    let selected=years[Math.min(new Date().getDay(),years.length-1)]||currentYear;
    const drawOn=()=>{
      const items=mainIds.map(id=>{
        const d=byId[id],target=latestDate?new Date(latestDate+'T00:00:00'):new Date();target.setFullYear(selected);
        let best='',diff=Infinity;
        for(const dt of d.dates){const dd=Math.abs(new Date(dt+'T00:00:00')-target);if(dd<diff){diff=dd;best=dt}}
        const e=(d.entriesByDate[best]||[])[0];return{id,date:best,e};
      });
      on.innerHTML='<div class="ref-side-section ref-on-week"><div class="ref-side-title">On This Week</div><div class="ref-year-scroll">'+years.map(y=>'<button data-on-year="'+y+'" class="'+(y===selected?'active':'')+'">'+y+'</button>').join('')+'</div><div class="ref-on-list">'+items.filter(x=>x.e).map(x=>'<div class="ref-on-item">'+refThumb(x.e,charts[x.id].kind)+'<div><div class="ref-no1-chart">'+esc(charts[x.id].title)+'</div><div class="ref-on-title">'+entityLink(x.e,charts[x.id].kind)+'</div>'+(charts[x.id].kind!=='artist'?'<div class="ref-on-artist">'+esc(x.e.artist)+'</div>':'')+'</div></div>').join('')+'</div><a class="ref-on-view" href="'+appHref(chartPath('songs',items[0]?.date||latestDate))+'">View Full Chart <i class="fas fa-arrow-right"></i></a></div>';
      bindLinks();hydratePortalImages();on.querySelectorAll('[data-on-year]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.onYear);drawOn()});
    };
    drawOn();
  }
}

async function renderCatalog(kind){
  const id=chartIdForKind(kind);
  loading(labelFor(kind)+'s');
  const data=await loadWeekly(id),items=aggregateCatalog(data,kind).map(x=>({...x,entries:x.weeks,slug:entitySlug(x,kind)}));
  const letters=[...new Set(items.map(x=>(x.name||'').charAt(0).toUpperCase()).filter(Boolean))].sort();
  let selected=letters[0]||'',searchValue=new URLSearchParams(location.search).get('q')||'';

  const title=labelFor(kind)+'s';
  const drawPage=()=>{
    const q=searchValue.trim().toLowerCase();
    const filtered=items.filter(x=>{
      const matchesLetter=q||String(x.name||'').charAt(0).toUpperCase()===selected;
      const hay=(x.name+' '+(x.artist||'')).toLowerCase();
      return matchesLetter&&(!q||hay.includes(q));
    });
    const groups={};
    for(const x of filtered){const l=String(x.name||'').charAt(0).toUpperCase();(groups[l]??=[]).push(x)}
    const lettersHtml=letters.map(l=>'<button class="ref-letter '+(l===selected?'active':'')+'" data-letter="'+escAttr(l)+'">'+esc(l)+'</button>').join('');
    const rows=Object.keys(groups).sort().map(l=>'<section class="ref-alpha-section"><h2>'+esc(l)+'</h2><div class="ref-catalog-grid">'+groups[l].map(x=>
      '<a href="'+appHref(entityPath(x,kind))+'" data-portal-link="'+entityPath(x,kind)+'" class="ref-catalog-card">'+
      refThumb(x,kind)+
      '<div class="ref-catalog-copy"><div class="ref-catalog-title">'+esc(x.name)+'</div>'+
      '<div class="ref-catalog-sub">'+(kind==='artist'?fmtNum(x.entries)+' entries':esc(x.artist)+' · '+fmtNum(x.entries)+' entries')+'</div></div></a>'
    ).join('')+'</div></section>').join('');

    portalEl.innerHTML=shellHtml(
      refHero(title.toUpperCase(),title,fmtNum(items.length)+' '+title.toLowerCase()+' tracked across all charts')+
      '<div class="ref-catalog-tools"><div class="ref-letters">'+lettersHtml+'</div><div class="ref-search-wrap"><input id="refCatalogSearch" type="search" placeholder="Search '+(kind==='artist'?'artists':kind+'s or artists')+'" value="'+escAttr(searchValue)+'"></div></div>'+
      (filtered.length?rows:'<div class="ref-empty">No '+title.toLowerCase()+' found for that filter.</div>')
    );
    bindLinks();hydratePortalImages();
    portalEl.querySelectorAll('[data-letter]').forEach(btn=>btn.onclick=()=>{selected=btn.dataset.letter;drawPage()});
    const input=document.getElementById('refCatalogSearch');
    if(input)input.oninput=e=>{
      searchValue=e.target.value;
      if(kind==='artist'){
        const u=new URL(location.href);
        if(searchValue)u.searchParams.set('q',searchValue);else u.searchParams.delete('q');
        history.replaceState({},'',u.pathname+u.search);
      }
      drawPage();
      const ni=document.getElementById('refCatalogSearch'); if(ni){ni.focus();ni.setSelectionRange(searchValue.length,searchValue.length)}
    };
  };
  setMode(true);setMeta(title,'Every '+labelFor(kind).toLowerCase()+' that has appeared on Daegon Charts.','/'+kind+'s');drawPage();
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
  loading("#1's");
  const ids=['songs','albums','artists','radioSongs','topStreamingAlbums','topAlbumSales','streamingSongs','digitalSongsSales'];
  const datasets=await Promise.all(ids.map(async id=>{try{return await loadWeekly(id)}catch{return {chartId:id,dates:[],entriesByDate:{}}}}));
  const allDates=[...new Set(datasets.flatMap(d=>d.dates||[]))].sort().reverse();
  let selected=allDates[0]||'';

  const draw=()=>{
    const idx=allDates.indexOf(selected),prev=idx<allDates.length-1?allDates[idx+1]:null,next=idx>0?allDates[idx-1]:null;
    const cards=datasets.map((data,i)=>{
      const id=ids[i],cfg=charts[id],entry=(data.entriesByDate[selected]||[]).find(e=>e.position===1);
      if(!entry)return '<div class="ref-no1-card"><div class="ref-no1-empty">No data</div></div>';
      return '<div class="ref-no1-card"><div class="ref-no1-body">'+refThumb(entry,cfg.kind)+'<div class="ref-no1-copy"><div class="ref-no1-chart">'+esc(cfg.title)+'</div><div class="ref-no1-title">'+entityLink(entry,cfg.kind)+'</div>'+(cfg.kind!=='artist'?'<div class="ref-no1-artist">'+esc(entry.artist)+'</div>':'')+'</div></div><a class="ref-no1-view" href="'+appHref(chartPath(id,selected))+'">View Chart →</a></div>';
    }).join('');
    portalEl.innerHTML=shellHtml(
      refHero("#1'S","#1's","The #1 hit on every chart this week")+
      '<div class="ref-week"><div class="ref-week-label">Week</div><div class="ref-week-controls">'+
      '<button id="refNo1Prev" class="ref-gold" '+(!prev?'disabled':'')+'><i class="fas fa-chevron-left"></i> Prev</button>'+
      '<div class="ref-date-select-wrap"><button id="refNo1DateBtn" class="ref-date-btn">'+fmtDate(selected)+' <i class="fas fa-chevron-down"></i></button><div id="refNo1DateMenu" class="ref-date-menu">'+allDates.map(d=>'<button data-no1-date="'+d+'" class="'+(d===selected?'active':'')+'">'+fmtDate(d)+'</button>').join('')+'</div></div>'+
      '<button id="refNo1Next" class="ref-gold" '+(!next?'disabled':'')+'>Next <i class="fas fa-chevron-right"></i></button></div></div>'+
      '<div class="ref-no1-grid">'+cards+'</div>'
    );
    bindLinks();hydratePortalImages();
    document.getElementById('refNo1Prev').onclick=()=>{if(prev){selected=prev;draw()}};
    document.getElementById('refNo1Next').onclick=()=>{if(next){selected=next;draw()}};
    document.getElementById('refNo1DateBtn').onclick=()=>document.getElementById('refNo1DateMenu').classList.toggle('open');
    portalEl.querySelectorAll('[data-no1-date]').forEach(x=>x.onclick=()=>{selected=x.dataset.no1Date;draw()});
  };
  setMode(true);setMeta("#1's","See the #1 hit on every chart for any given week.","/number-ones");draw();
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
  if(type==='year'){
    const cfg=officialYearEnd[kindSeg]||officialYearEnd.songs;
    const official=await loadOfficialRanking(cfg,{yearly:true});
    const selected=new URLSearchParams(location.search).get('year')||official.years[0];
    const arr=official.entriesByYear[selected]||[];
    const path='/year-end/'+kindSeg;
    const options=official.years.map(v=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+v+'</option>').join('');
    const main='<div class="portal-hero"><div class="portal-kicker">Year-End Charts</div><h1 class="portal-title">'+esc(cfg.title)+'</h1><p class="portal-subtitle">Official Daegon Charts year-end ranking.</p></div>'+
      '<div class="portal-toolbar"><select id="periodChart" class="portal-select"><option value="songs" '+(kindSeg==='songs'?'selected':'')+'>Songs</option><option value="albums" '+(kindSeg==='albums'?'selected':'')+'>Albums</option><option value="artists" '+(kindSeg==='artists'?'selected':'')+'>Artists</option></select><select id="periodValue" class="portal-select">'+options+'</select></div>'+
      '<div class="portal-list">'+arr.map(x=>'<div class="portal-row"><div class="portal-row-rank">'+x.position+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">'+(x.peak?'Peak #'+x.peak:'')+(x.weeks?' · '+x.weeks+' weeks':'')+'</div></div>').join('')+'</div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Year-End Charts','Official Daegon Charts year-end rankings.',path);
    document.getElementById('periodChart').onchange=e=>go('/year-end/'+e.target.value);
    document.getElementById('periodValue').onchange=e=>{history.replaceState({},'',appHref(path)+'?year='+encodeURIComponent(e.target.value));renderPeriod('year',kindSeg)};
    return;
  }
  const data=await loadWeekly(chartId),years=[...new Set(data.dates.map(d=>d.slice(0,4)))].sort().reverse();
  const decades=[...new Set(years.map(y=>Math.floor(Number(y)/10)*10))].sort((a,b)=>b-a);
  const selected=String(new URLSearchParams(location.search).get('decade')||decades[0]);
  const pred=d=>Number(d.slice(0,4))>=Number(selected)&&Number(d.slice(0,4))<Number(selected)+10;
  const arr=aggregatePeriod(data,chartId,pred).slice(0,100);
  const path='/decade-end/'+kindSeg;
  const options=decades.map(String).map(v=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+v+'s</option>').join('');
  const main='<div class="portal-hero"><div class="portal-kicker">Decade-End</div><h1 class="portal-title">'+esc(charts[chartId].title)+'</h1><p class="portal-subtitle">Decade ranking generated from the weekly archive.</p></div>'+
    '<div class="portal-toolbar"><select id="periodChart" class="portal-select"><option value="songs" '+(kindSeg==='songs'?'selected':'')+'>Songs</option><option value="albums" '+(kindSeg==='albums'?'selected':'')+'>Albums</option><option value="artists" '+(kindSeg==='artists'?'selected':'')+'>Artists</option></select><select id="periodValue" class="portal-select">'+options+'</select></div>'+
    '<div class="portal-list">'+arr.map((x,i)=>'<div class="portal-row"><div class="portal-row-rank">'+(i+1)+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">'+x.weeks+' weeks · Peak #'+x.peak+'</div></div>').join('')+'</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Decade-End Charts','Daegon Charts decade rankings.',path);
  document.getElementById('periodChart').onchange=e=>go('/decade-end/'+e.target.value);
  document.getElementById('periodValue').onchange=e=>{history.replaceState({},'',appHref(path)+'?decade='+encodeURIComponent(e.target.value));renderPeriod('decade',kindSeg)};
}

async function renderGoat(kindSeg){
  const cfg=officialGoat[kindSeg]||officialGoat.songs,kind=cfg.kind;
  loading('Greatest of All Time');
  const {entries}=await loadOfficialRanking(cfg);
  const arr=entries.slice(0,100);
  const main='<div class="portal-hero"><div class="portal-kicker">Greatest of All Time</div><h1 class="portal-title">'+esc(cfg.title)+'</h1><p class="portal-subtitle">Official all-time ranking from the Daegon Charts archive.</p></div>'+
    '<div class="portal-toolbar"><button class="portal-btn '+(kindSeg==='songs'?'active':'')+'" data-goat="songs">Songs</button><button class="portal-btn '+(kindSeg==='albums'?'active':'')+'" data-goat="albums">Albums</button><button class="portal-btn '+(kindSeg==='artists'?'active':'')+'" data-goat="artists">Artists</button></div>'+
    '<div class="portal-list">'+arr.map(x=>'<div class="portal-row"><div class="portal-row-rank">'+x.position+'</div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="portal-row-sub">'+esc(x.artist)+'</div>':'')+'</div><div class="portal-row-meta">'+(x.peak?'Peak #'+x.peak:'')+(x.weeks?' · '+x.weeks+' weeks':'')+'</div></div>').join('')+'</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Greatest of All Time','Official Daegon Charts all-time rankings.','/goat/'+kindSeg);
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
  const artistData=await loadWeekly('artists');
  const artists=aggregateCatalog(artistData,'artist').map(x=>x.name).sort((a,b)=>a.localeCompare(b));
  const allIds=['songs','albums','artists','radioSongs','topStreamingAlbums','topAlbumSales','streamingSongs','digitalSongsSales'];
  const allData=await Promise.all(allIds.map(async id=>{try{return await loadWeekly(id)}catch{return null}}));

  let a1=null,a2=null,started=false,selectedChart='All';
  const statsFor=name=>{
    if(!name)return null;
    let totalNo1s=0,totalTop10s=0,totalWeeks=0,totalEntries=0,totalUnits=0;
    for(let i=0;i<allData.length;i++){
      const d=allData[i],id=allIds[i]; if(!d)continue;
      if(selectedChart!=='All'&&selectedChart!==id)continue;
      const seen=new Map();
      for(const date of d.dates)for(const e of d.entriesByDate[date]||[]){
        const artist=d.chartId==='artists'?e.name:e.artist;
        if(String(artist).toLowerCase()!==String(name).toLowerCase())continue;
        const key=(d.chartId==='artists'?e.name:e.name+'|'+e.artist).toLowerCase();
        let x=seen.get(key);if(!x){x={peak:e.position,weeks:0,units:0};seen.set(key,x)}
        x.peak=Math.min(x.peak,e.position);x.weeks++;
        const u=parseFloat(String(e.totalUnits||e.units||'0').replace(/[^0-9.]/g,''))||0;x.units=Math.max(x.units,u);
      }
      for(const x of seen.values()){if(x.peak===1)totalNo1s++;if(x.peak<=10)totalTop10s++;totalWeeks+=x.weeks;totalEntries++;totalUnits+=x.units}
    }
    return {totalNo1s,totalTop10s,totalWeeks,totalEntries,totalUnits};
  };
  const selectHtml=(label,id,value)=>'<div class="ref-battle-select"><label>'+label+'</label>'+(value?
    '<div class="ref-selected-artist"><strong>'+esc(value)+'</strong><button data-clear="'+id+'"><i class="fas fa-times"></i></button></div>':
    '<div class="ref-search-select"><i class="fas fa-search"></i><input data-artist-search="'+id+'" placeholder="Search artist..."><div class="ref-search-results" id="'+id+'Results"></div></div>')+'</div>';

  const draw=()=>{
    if(!started){
      portalEl.innerHTML=shellHtml(
        '<div class="ref-battle-page">'+refHero('BATTLE','Chart Battle','Select two artists and a chart to see who dominates').replace('<h1>','<h1><i class="fas fa-bolt"></i> ')+
        '<div class="ref-battle-setup"><div class="ref-battle-picks">'+selectHtml('Artist 1','a1',a1)+'<div class="ref-vs">VS</div>'+selectHtml('Artist 2','a2',a2)+'</div>'+
        '<div class="ref-chart-select"><label>Select Chart</label><select id="refBattleChart"><option value="All">All</option>'+allIds.map(id=>'<option value="'+id+'" '+(id===selectedChart?'selected':'')+'>'+esc(charts[id]?.title||id)+'</option>').join('')+'</select></div>'+
        '<button id="refFight" class="ref-fight" '+(!(a1&&a2)?'disabled':'')+'>Fight!</button></div></div>'
      );
      const bindSearch=(id,setter)=>{
        const input=portalEl.querySelector('[data-artist-search="'+id+'"]'),res=document.getElementById(id+'Results');
        if(!input)return;
        const show=()=>{const q=input.value.toLowerCase();const opts=artists.filter(x=>!q||x.toLowerCase().includes(q)).slice(0,50);res.innerHTML=opts.map(x=>'<button data-pick="'+id+'" data-name="'+escAttr(x)+'">'+esc(x)+'</button>').join('');res.classList.add('open');portalEl.querySelectorAll('[data-pick="'+id+'"]').forEach(b=>b.onmousedown=()=>{setter(b.dataset.name);draw()})};
        input.onfocus=show;input.oninput=show;input.onblur=()=>setTimeout(()=>res.classList.remove('open'),200);
      };
      bindSearch('a1',v=>a1=v);bindSearch('a2',v=>a2=v);
      portalEl.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>{if(b.dataset.clear==='a1')a1=null;else a2=null;draw()});
      document.getElementById('refBattleChart').onchange=e=>selectedChart=e.target.value;
      document.getElementById('refFight').onclick=()=>{if(a1&&a2){started=true;draw()}};
      return;
    }
    const s1=statsFor(a1),s2=statsFor(a2);
    let p1=0,p2=0;
    const comps=[['totalNo1s',false],['totalTop10s',false],['totalWeeks',false],['totalEntries',false],['totalUnits',false]];
    for(const [k] of comps){if(s1[k]>s2[k])p1++;else if(s2[k]>s1[k])p2++}
    const artistCard=(name,score,stats,win)=>'<div class="ref-battle-artist '+(win?'winner':'')+'">'+
      '<div class="ref-battle-avatar" data-portal-image data-kind="artist" data-name="'+escAttr(name)+'" data-artist="'+escAttr(name)+'"><i class="fas fa-user"></i></div>'+
      '<h2>'+esc(name)+'</h2><div class="ref-battle-score">'+score+'</div></div>';
    const statRows=[
      ["#1's",'totalNo1s'],["Top 10's",'totalTop10s'],['Weeks','totalWeeks'],['Entries','totalEntries'],['Units','totalUnits']
    ].map(([label,k])=>'<div class="ref-battle-stat"><div class="ref-battle-stat-label">'+label+'</div><div class="ref-battle-stat-values"><strong class="'+(s1[k]>s2[k]?'better':'')+'">'+(k==='totalUnits'?fmtNum(s1[k]):s1[k])+'</strong><i class="fas fa-arrows-alt-h"></i><strong class="'+(s2[k]>s1[k]?'better':'')+'">'+(k==='totalUnits'?fmtNum(s2[k]):s2[k])+'</strong></div></div>').join('');
    portalEl.innerHTML=shellHtml('<div class="ref-battle-page">'+
      refHero('BATTLE','Chart Battle','Select two artists and a chart to see who dominates').replace('<h1>','<h1><i class="fas fa-bolt"></i> ')+
      '<button id="refResetBattle" class="ref-reset"><i class="fas fa-redo"></i> New Battle</button>'+
      '<div class="ref-battle-results">'+artistCard(a1,p1,s1,p1>p2)+'<div class="ref-battle-center"><div class="ref-battle-chart">'+esc(selectedChart==='All'?'All':charts[selectedChart]?.title||selectedChart)+'</div>'+statRows+'</div>'+artistCard(a2,p2,s2,p2>p1)+'</div>'+
      '<div class="ref-battle-trophy"><i class="fas fa-trophy"></i><div>'+(p1>p2?esc(a1)+' WINS!':p2>p1?esc(a2)+' WINS!':"IT'S A TIE!")+'</div></div></div>');
    document.getElementById('refResetBattle').onclick=()=>{a1=null;a2=null;started=false;draw()};hydratePortalImages();
  };
  setMode(true);setMeta('Chart Battle','Compare two artists in a head-to-head chart battle!','/chart-battle');draw();
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
