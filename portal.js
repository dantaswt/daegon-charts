(function(){
'use strict';

const PORTAL_ROUTES=new Set(['','songs','albums','artists','number-ones','stats','year-end','decade-end','goat','chart-beat','awards','chart-battle','search','song','album','artist']);
const mainChartIds={song:'songs',album:'albums',artist:'artists'};
const periodLimits={songs:100,albums:100,artists:50};
const PORTAL_SHEET='https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/gviz/tq?tq=select%20*&tqx=out:csv&gid=';
const officialYearEnd={
  yearEndSongs:{kind:'song',title:'Daegon 100',weeklyId:'songs'},
  yearEndArtists:{kind:'artist',title:'Daegon Artists 50',weeklyId:'artists'},
  yearEndAlbums:{kind:'album',title:'Daegon Albums 100',weeklyId:'albums'},
  yearEndRadio:{kind:'song',title:'Radio Songs',weeklyId:'radioSongs'},
  yearEndStreamingSongs:{kind:'song',title:'Streaming Songs',weeklyId:'streamingSongs'},
  yearEndTopStreamingAlbums:{kind:'album',title:'Top Streaming Albums',weeklyId:'topStreamingAlbums'},
  yearEndTopAlbumSales:{kind:'album',title:'Top Album Sales',weeklyId:'topAlbumSales'},
  yearEndDigitalSongsSales:{kind:'song',title:'Digital Songs Sales',weeklyId:'digitalSongsSales'},
  yearEndNewArtists:{kind:'artist',title:'Top New Artists',weeklyId:'artists'},
  yecHot100Artists:{kind:'artist',title:'Daegon 100 — Artists',weeklyId:'songs'},
  yecTop100AlbumsArtists:{kind:'artist',title:'Daegon Albums 100 — Artists',weeklyId:'albums'},
  yecArtist50Female:{kind:'artist',title:'Top Artists — Female',weeklyId:'artists'},
  yecArtist50Male:{kind:'artist',title:'Top Artists — Male',weeklyId:'artists'},
  yecArtist50DuoGroup:{kind:'artist',title:'Top Artists — Duo/Group',weeklyId:'artists'},
  yecRadioSongsArtists:{kind:'artist',title:'Radio Songs — Artists',weeklyId:'radioSongs'}
};
const officialGoat={
  goatSongs:{kind:'song',title:'Greatest Daegon 100 Songs',weeklyId:'songs'},
  goatArtists:{kind:'artist',title:'Greatest Daegon Artists 50',weeklyId:'artists'},
  goatAlbums:{kind:'album',title:'Greatest Daegon Albums 100',weeklyId:'albums'},
  goatRadio:{kind:'song',title:'Greatest of All Time Radio',weeklyId:'radioSongs'}
};
const exactYearEndIds=['yearEndSongs','yearEndArtists','yearEndAlbums','yearEndRadio','yearEndDigitalSongsSales','yearEndStreamingSongs','yearEndTopAlbumSales','yearEndTopStreamingAlbums','yecHot100Artists','yecArtist50Female','yecArtist50Male','yecArtist50DuoGroup','yearEndNewArtists','yecTop100AlbumsArtists','yecRadioSongsArtists'];
const exactGoatIds=['goatSongs','goatArtists','goatAlbums','goatRadio'];
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
async function fetchCsv(url){
  if(typeof fetchRows==='function') return fetchRows(url);
  const res=await fetch(url,{cache:'default'});
  if(!res.ok) throw new Error('CSV '+res.status);
  let text=await res.text();
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const parseLine=(line)=>{
    const out=[];let cur='',q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(q&&line[i+1]==='"'){cur+='"';i++}
        else q=!q;
      }else if(ch===','&&!q){out.push(cur);cur=''}
      else cur+=ch;
    }
    out.push(cur);
    return out;
  };
  return text.trim().split(/\r?\n/).filter(Boolean).map(parseLine);
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
      ['HOT 100','/chart/daegon-100'],['CHART BEAT','/chart-beat'],['YEAR-END CHARTS','/year-end'],
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
      ['HOT 100','/chart/daegon-100'],['CHART BEAT','/chart-beat'],['YEAR-END CHARTS','/year-end'],
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
  document.body.classList.add('global-site-shell');
  document.body.classList.add('global-bars-weekly');
  document.body.classList.add('global-header-canonical');

  // Keep Weekly branding untouched, but mirror the daegoncharts header on portal routes.
  const brand=document.querySelector('.brand');
  if(brand){
    brand.innerHTML='<span class="brand-mark" aria-hidden="true">D</span><span class="brand-word">aegon charts</span>';
  }

  if(portal){
    weeklyEl.setAttribute('hidden','');
    weeklyEl.style.setProperty('display','none','important');
    portalEl.classList.add('active');
    portalEl.removeAttribute('hidden');
  }else{
    weeklyEl.removeAttribute('hidden');
    weeklyEl.style.removeProperty('display');
    portalEl.classList.remove('active');
    portalEl.setAttribute('hidden','');
  }
}
function portalSkeleton(title='Loading'){
  const cards=Array.from({length:7},(_,i)=>'<div class="portal-sk-card">'+
    '<div class="portal-sk-rank sk"></div>'+
    '<div class="portal-sk-art sk '+(/artist/i.test(title)?'circle':'')+'"></div>'+
    '<div class="portal-sk-copy"><div class="portal-sk-title sk"></div><div class="portal-sk-sub sk"></div></div>'+
    '<div class="portal-sk-action sk"></div>'+
  '</div>').join('');
  return '<div class="portal-skeleton-wrap" aria-hidden="true">'+
    '<div class="portal-sk-heading sk"></div>'+
    '<div class="portal-sk-control sk"></div>'+
    '<div class="portal-sk-list">'+cards+'</div>'+
  '</div>';
}
function loading(title='Loading'){
  setMode(true);
  portalEl.innerHTML=portalSkeleton(title);
}
function setMeta(title,desc,path){
  document.title=title+' | Daegon Charts';
  const d=document.querySelector('meta[name="description"]');if(d)d.content=desc;
  let robots=document.querySelector('meta[name="robots"]');
  if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.appendChild(robots)}
  const noindexPaths=new Set(['/search','/chart-battle','/awards']);
  robots.content=noindexPaths.has(path)?'noindex,follow':'index,follow,max-image-preview:large';
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

function editorialBlock(title,paragraphs,links=[]){
  return '<section class="editorial-block">'+
    '<div class="editorial-kicker">About this section</div>'+
    '<h2>'+esc(title)+'</h2>'+
    paragraphs.map(p=>'<p>'+p+'</p>').join('')+
    (links.length?'<div class="editorial-links">'+links.map(x=>'<a href="'+appHref(x[0])+'">'+esc(x[1])+' <i class="fas fa-arrow-right"></i></a>').join('')+'</div>':'')+
  '</section>';
}

function catalogEditorial(kind){
  if(kind==='song')return editorialBlock(
    'Explore every song in the Daegon chart archive',
    [
      'This directory brings together songs that have appeared on the Daegon 100 across the project’s weekly history. It is designed as an index into the archive rather than a popularity list: each entry links to its own chart history, peak position and week-by-week run.',
      'The archive preserves the same title and artist identity rules used by the weekly chart so historical runs stay connected instead of being split across spelling variants or duplicated credits.'
    ],
    [['/methodology','How the rankings are built'],['/chart/daegon-100','Open the current Daegon 100']]
  );
  if(kind==='album')return editorialBlock(
    'Explore the Daegon Albums archive',
    [
      'This directory collects albums that have charted in Daegon Albums 100. Each album page links its historical performance back to the weekly archive, including peak, weeks charted and available charting tracks.',
      'Album rankings are kept separate from song performance so catalog titles are not automatically boosted simply because an artist has a successful single. The project methodology explains how album performance and historical continuity are handled.'
    ],
    [['/methodology','Read the album methodology'],['/chart/daegon-albums-100','Open the current albums chart']]
  );
  return editorialBlock(
    'Explore artists across the Daegon archive',
    [
      'The artist directory indexes performers who have appeared in Daegon Artists 50. Artist pages consolidate weekly chart history and connect an artist to charting songs and albums, making the directory a navigation layer for the wider archive.',
      'Artist credits are normalized so the archive follows the project’s main-artist rules and avoids splitting the same performer across aliases, capitalization differences or secondary featuring credits.'
    ],
    [['/methodology','Read the crediting methodology'],['/chart/daegon-artists-50','Open the current artists chart']]
  );
}

async function renderHome(){
  loading('Home');
  // Match the real daegoncharts home loader: only the three primary charts are blocking.
  const ids=['songs','albums','artists'];
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
    editorialBlock(
      'An independent weekly music chart and historical archive',
      [
        'Daegon Charts follows songs, albums and artists week by week, preserving movement, peaks, weeks charted and long-term chart runs in one continuous archive. The main rankings are original Daegon Charts outputs rather than copies of a commercial chart.',
        'Beyond the current week, the site generates year-end and all-time rankings from the underlying weekly history. That means the archive can be explored from several angles while keeping the same underlying chart record.'
      ],
      [['/methodology','Read the methodology'],['/about','About the project']]
    )+
    '<div id="refTopCharts">'+topSection('songs')+'</div>'+numberOnes+first+beat+
    '<a href="'+appHref('/chart-battle')+'" data-portal-link="/chart-battle" class="ref-battle-float"><span>VS</span><div><small>New Mini-Game!</small><strong>Play Chart Battle 🏆</strong></div></a>';

  setMode(true);portalEl.innerHTML=shellHtml(main,true);setMeta('Daegon Charts','Weekly music charts, year-end rankings and greatest of all time lists.','/');
  bindLinks();hydratePortalImages();bindHomeSidebar();

  let active='songs';
  const bindTabs=()=>{
    portalEl.querySelectorAll('[data-home-tab]').forEach(btn=>btn.onclick=()=>{
      active=btn.dataset.homeTab;
      document.getElementById('refTopCharts').innerHTML=topSection(active);
      bindLinks();
      hydratePortalImages();
      bindTabs();
    });
  };
  bindTabs();

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
      catalogEditorial(kind)+
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



const generatedYecCache=new Map();
const generatedGoatCache=new Map();
function metricNumber(v){return toInt(String(v??'0'))}
async function computeYearEndExact(weeklyId){
  if(generatedYecCache.has(weeklyId))return generatedYecCache.get(weeklyId);
  const job=(async()=>{
    const chartData=await loadWeekly(weeklyId);
    const years={};
    const metricKey=weeklyId==='songs'?'points':(weeklyId==='streamingSongs'||weeklyId==='topStreamingAlbums')?'streams':weeklyId==='radioSongs'?'audience':(weeklyId==='topAlbumSales'||weeklyId==='digitalSongsSales')?'sales':'units';
    const seenGlobal=new Set();
    for(const date of chartData.dates){
      const year=date.slice(0,4); if(!years[year])years[year]={};
      for(const e of chartData.entriesByDate[date]||[]){
        const key=(e.name+'||'+e.artist).toLowerCase();
        if(!years[year][key])years[year][key]={position:0,name:e.name,artist:e.artist,peak:e.peak||e.position,weeks:0,weeksAt1:0,totalUnits:0,kind:chartData.kind};
        const x=years[year][key];
        x.weeks++;
        x.peak=Math.min(x.peak||999,e.peak||e.position||999);
        x.weeksAt1+=(e.weeksAt1||0);
        const first=!seenGlobal.has(key);seenGlobal.add(key);
        if(first&&weeklyId==='topStreamingAlbums'&&e.totalStreams)x.totalUnits+=metricNumber(e.totalStreams);
        else x.totalUnits+=metricNumber(e[metricKey]??e.units??0);
      }
    }
    const entriesByYear={};
    for(const [year,obj] of Object.entries(years)){
      entriesByYear[year]=Object.values(obj)
        .sort((a,b)=>b.totalUnits-a.totalUnits||a.peak-b.peak)
        .slice(0,100)
        .map((e,i)=>({...e,position:i+1}));
    }
    return {years:Object.keys(entriesByYear).sort().reverse(),entriesByYear,kind:chartData.kind,title:charts[weeklyId]?.title||weeklyId};
  })();
  generatedYecCache.set(weeklyId,job);
  try{return await job}catch(err){generatedYecCache.delete(weeklyId);throw err}
}
async function computeArtistAggregateExact(weeklyId,title,metricField){
  const chartData=await loadWeekly(weeklyId),years={};
  for(const date of chartData.dates){
    const year=date.slice(0,4);if(!years[year])years[year]={};
    for(const e of chartData.entriesByDate[date]||[]){
      const artist=weeklyId==='artists'?e.name:e.artist;if(!artist)continue;
      const key=artist.toLowerCase();
      if(!years[year][key])years[year][key]={position:0,name:artist,artist,peak:100,weeks:0,weeksAt1:0,totalUnits:0,entriesSet:new Set(),kind:'artist'};
      const x=years[year][key];x.weeks++;x.entriesSet.add(e.name.toLowerCase());x.peak=Math.min(x.peak,e.peak||e.position||100);x.weeksAt1+=(e.weeksAt1||0);x.totalUnits+=metricNumber(e[metricField]??e.units??0);
    }
  }
  const entriesByYear={};
  for(const [year,obj] of Object.entries(years)){
    entriesByYear[year]=Object.values(obj).sort((a,b)=>b.totalUnits-a.totalUnits||a.peak-b.peak).slice(0,20).map((e,i)=>({position:i+1,name:e.name,artist:e.artist,peak:e.peak,weeks:e.weeks,weeksAt1:e.weeksAt1,totalUnits:e.totalUnits,entries:e.entriesSet.size,kind:'artist'}));
  }
  return {years:Object.keys(entriesByYear).sort().reverse(),entriesByYear,kind:'artist',title};
}
let exactArtistMetaPromise=null;
async function loadExactArtistMetadata(){
  if(exactArtistMetaPromise)return exactArtistMetaPromise;
  exactArtistMetaPromise=(async()=>{try{
    const r=await fetch('https://raw.githubusercontent.com/dantaswt/daegoncharts/main/src/lib/artist-metadata.json',{cache:'force-cache'});
    if(!r.ok)throw new Error('artist metadata '+r.status);return await r.json();
  }catch{return {}}})();
  return exactArtistMetaPromise;
}
async function computeGenderYecExact(category){
  const [base,meta]=await Promise.all([computeYearEndExact('artists'),loadExactArtistMetadata()]);
  const entriesByYear={};
  for(const y of base.years){
    entriesByYear[y]=(base.entriesByYear[y]||[]).filter(e=>{
      const m=meta[slugify(e.name)];return m?.categoryConfirmed&&m.category===category;
    }).slice(0,10).map((e,i)=>({...e,position:i+1}));
  }
  return {years:base.years,entriesByYear,kind:'artist',title:category==='FEMALE'?'Top Artists — Female':category==='MALE'?'Top Artists — Male':'Top Artists — Duo/Group'};
}
const CURATED_NEW_ARTISTS_EXACT={
  "2017":["camila cabello","dua lipa","julia michaels","prettymuch","mgk","niall horan","pabllo vittar","marian hill","zara larsson","harry styles","neiked","louis tomlinson","blackpink","poppy","iza","zayn"],
  "2018":["jão","declan mckenna","duda beat","post malone","cardi b","lil peep","ava max","(g)i-dle","iza","bebe rexha","hayley kiyoko","the aces","gustavo mioto","bazzi","louisa johnson","luísa sonza","khalid","greeicy","lauv"],
  "2019":["billie eilish","lizzo","lil nas x","mc tha","rosalía","kim petras","bad bunny","normani","dinah jane","luísa sonza","blaya","mahmundi","paloma mami","lewis capaldi","davi sabbag"],
  "2020":["doja cat","chloe x halle","conan gray","megan thee stallion","rina sawayama","aminé","summer walker","alma","karol g","dadá boladão","alina baraz","yung beef"],
  "2021":["olivia rodrigo","marina sena","potyguara bardo","phoebe bridgers","don l","clarissa","juliette","nathy peluso","chlöe","lisa","giveon","c. tangana","faye webster","slayyyter","måneskin","day","paloma mami","annikko","chameleo"],
  "2022":["jovem dionisio","tate mcrae","steve lacy","dove cameron","omar apollo","lele pons","elley duhé","gayle","urias","sabrina carpenter","veridiana benassi","latto","newjeans","maria becerra","måneskin","orville peck","flo","liniker","rebelde la serie","pedro sampaio"],
  "2023":["newjeans","bizarrap","gracie abrams","raye","melanie fiona","maria becerra","eslabon armando","la cruz","käärijä","doechii","emilia","clarissa","coi leray","coco jones","jung kook","ice spice"],
  "2024":["chappell roan","beabadoobee","sevdaliza","tyla","addison rae","dasha","benson boone","rosé","caroline polachek","wicked movie cast","flo","magdalena bay","ayra starr","ice spice"],
  "2025":["lola young","pinkpantheress","guitarricadelafuente","katseye","jade","reneé rapp","lucas pretti","sombr","ravyn lenae","cynthia erivo","huntr/x","mariah the scientist","olivia dean","amaarae","laufey","os garotin","rose gray","destin conrad"]
};
async function computeNewArtistsExact(){
  const chartData=await loadWeekly('artists');
  const years={};

  for(const date of chartData.dates){
    const year=date.slice(0,4);
    const entries=chartData.entriesByDate[date]||[];
    if(!years[year])years[year]={};

    const curated=CURATED_NEW_ARTISTS_EXACT[year];
    if(!curated)continue;

    for(const e of entries){
      const name=String(e.name||'').trim();
      const artist=String(e.artist||name).trim();
      const key=(name+'||'+artist).toLowerCase();

      if(!curated.some(c=>c.toLowerCase()===name.toLowerCase()))continue;

      if(!years[year][key]){
        years[year][key]={
          position:0,
          name,
          artist,
          peak:e.peak||e.position||999,
          weeks:0,
          weeksAt1:0,
          totalUnits:0,
          kind:'artist'
        };
      }

      const entry=years[year][key];
      entry.weeks+=1;
      if((e.peak||e.position||999)<entry.peak)entry.peak=e.peak||e.position;
      entry.weeksAt1+=(e.weeksAt1||0);
      entry.totalUnits+=metricNumber(e.units??0);
    }
  }

  const entriesByYear={};
  for(const [year,items] of Object.entries(years)){
    entriesByYear[year]=Object.values(items)
      .sort((a,b)=>b.totalUnits-a.totalUnits||a.peak-b.peak)
      .slice(0,10)
      .map((e,i)=>({...e,position:i+1}));
  }

  return {
    years:Object.keys(entriesByYear).sort().reverse(),
    entriesByYear,
    kind:'artist',
    title:'Year-End New Artists'
  };
}
async function loadYecExact(chartId){
  if(chartId==='yecHot100Artists')return computeArtistAggregateExact('songs','Daegon 100 — Artists','points');
  if(chartId==='yecTop100AlbumsArtists')return computeArtistAggregateExact('albums','Daegon Albums 100 — Artists','units');
  if(chartId==='yecRadioSongsArtists')return computeArtistAggregateExact('radioSongs','Radio Songs — Artists','audience');
  if(chartId==='yecArtist50Female')return computeGenderYecExact('FEMALE');
  if(chartId==='yecArtist50Male')return computeGenderYecExact('MALE');
  if(chartId==='yecArtist50DuoGroup')return computeGenderYecExact('GROUP');
  if(chartId==='yearEndNewArtists')return computeNewArtistsExact();
  const cfg=officialYearEnd[chartId];if(!cfg)throw new Error('Unknown Year-End chart');
  return computeYearEndExact(cfg.weeklyId);
}
async function computeGoatExact(chartId){
  if(generatedGoatCache.has(chartId))return generatedGoatCache.get(chartId);
  const job=(async()=>{
    const cfg=officialGoat[chartId]||officialGoat.goatSongs;
    const data=await loadWeekly(cfg.weeklyId);
    const aggregated={};
    for(const date of data.dates){
      for(const e of data.entriesByDate[date]||[]){
        const key=(e.name+'||'+e.artist).toLowerCase();
        if(!aggregated[key])aggregated[key]={
          position:0,name:e.name,artist:e.artist,peak:e.peak||e.position,weeks:0,weeksAt1:0,
          totalUnits:0,totalStreams:0,totalSales:0,totalAudience:0,totalPoints:0,kind:cfg.kind
        };
        const x=aggregated[key];
        x.weeks++;
        x.peak=Math.min(x.peak||999,e.peak||e.position||999);
        x.weeksAt1+=(e.weeksAt1||0);
        x.totalUnits+=metricNumber(e.units);
        x.totalStreams+=metricNumber(e.streams);
        x.totalSales+=metricNumber(e.sales);
        x.totalAudience+=metricNumber(e.audience);
        x.totalPoints+=metricNumber(e.points);
      }
    }
    const entries=Object.values(aggregated)
      .sort((a,b)=>b.weeks-a.weeks||a.peak-b.peak)
      .slice(0,500)
      .map((e,i)=>({...e,position:i+1}));
    return {entries,kind:cfg.kind,title:cfg.title};
  })();
  generatedGoatCache.set(chartId,job);
  try{return await job}catch(err){generatedGoatCache.delete(chartId);throw err}
}

function originalHero(bg,title,subtitle){
  return '<div class="orig-hero"><div class="orig-hero-bg">'+esc(bg)+'</div><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div>';
}
function originalTop5(title,entries,kind,path){
  if(!entries||!entries.length)return '';
  return '<section class="orig-top5"><h2>'+esc(title)+'</h2><div class="orig-top5-row">'+entries.slice(0,5).map((e,i)=>
    '<div class="orig-top5-card '+(i===0?'lead':'')+'"><div class="orig-top5-art">'+refThumb(e,kind)+'<div class="orig-rank">'+(e.position||i+1)+'</div></div><div class="orig-top5-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="orig-top5-artist">'+esc(e.artist||'')+'</div>':'')+'</div>'
  ).join('')+'</div><div class="orig-view-wrap"><a class="orig-view" href="'+appHref(path)+'">VIEW CHART</a></div></section>';
}
function originalChartGrid(title,items,base){
  return '<section class="orig-chart-grid-section"><h2>'+esc(title)+'</h2><div class="orig-chart-grid">'+items.map(x=>'<a class="orig-chart-link" href="'+appHref(base+x.id)+'">'+esc(x.title)+'</a>').join('')+'</div></section>';
}
function originalYearControls(label,values,selected,onKey){
  const idx=values.indexOf(selected),prev=idx<values.length-1?values[idx+1]:null,next=idx>0?values[idx-1]:null;
  return '<div class="orig-period-control"><div class="orig-period-label">'+esc(label)+'</div><div class="orig-period-row">'+
    '<button class="ref-gold" data-'+onKey+'-prev '+(!prev?'disabled':'')+'><i class="fas fa-chevron-left"></i> Prev</button>'+
    '<div class="orig-select-wrap"><button class="orig-select-btn" data-'+onKey+'-toggle>'+esc(selected)+' <i class="fas fa-chevron-down"></i></button><div class="orig-select-menu" data-'+onKey+'-menu>'+values.map(v=>'<button data-'+onKey+'-value="'+escAttr(v)+'" class="'+(v===selected?'active':'')+'">'+esc(v)+'</button>').join('')+'</div></div>'+
    '<button class="ref-gold" data-'+onKey+'-next '+(!next?'disabled':'')+'>Next <i class="fas fa-chevron-right"></i></button>'+
  '</div></div>';
}
async function renderYearEndIndex(){
  loading('Year-End Charts');
  const [songs,albums,artists]=await Promise.all([
    loadYecExact('yearEndSongs'),
    loadYecExact('yearEndAlbums'),
    loadYecExact('yearEndArtists')
  ]);
  const allYears=songs.years||[];
  const years=allYears.filter(y=>y!=='2026');
  let selected=new URLSearchParams(location.search).get('year')||(years.includes('2025')?'2025':years[0]||'');
  if(!years.includes(selected))selected=years[0]||selected;
  const SONG_CHARTS=[
    {id:'yearEndSongs',title:'Daegon 100'},{id:'yearEndRadio',title:'Radio Songs'},{id:'yearEndDigitalSongsSales',title:'Digital Songs Sales'},{id:'yearEndStreamingSongs',title:'Streaming Songs'}
  ];
  const ALBUM_CHARTS=[
    {id:'yearEndAlbums',title:'Daegon Albums 100'},{id:'yearEndTopAlbumSales',title:'Top Album Sales'},{id:'yearEndTopStreamingAlbums',title:'Top Streaming Albums'}
  ];
  const ARTIST_CHARTS=[
    {id:'yecHot100Artists',title:'Daegon 100 — Artists'},{id:'yecArtist50Female',title:'Top Artists — Female'},{id:'yecArtist50Male',title:'Top Artists — Male'},{id:'yecArtist50DuoGroup',title:'Top Artists — Duo/Group'},{id:'yearEndNewArtists',title:'Top New Artists'},{id:'yecTop100AlbumsArtists',title:'Daegon Albums 100 — Artists'},{id:'yecRadioSongsArtists',title:'Radio Songs — Artists'}
  ];
  const draw=()=>{
    const main='<div class="orig-page">'+originalHero('YEAR-END CHARTS','Year-End Charts','Annual rankings generated from the weekly Daegon chart history')+
      editorialBlock(
        'How the Year-End Charts work',
        [
          'Year-End Charts are calculated from the weekly Daegon archive for the selected calendar year. They reward sustained chart performance across the year rather than simply reproducing one week or importing a separate year-end list.',
          'Songs, albums and artists use the performance metric attached to their weekly chart. Additional artist views — including Female, Male, Duo/Group and New Artists — are filtered from the same underlying history using the project’s artist metadata and curated eligibility rules.'
        ],
        [['/methodology','See the full methodology'],['/stats','Explore chart records']]
      )+
      originalYearControls('Year',years,selected,'year')+
      originalTop5('Daegon 100',(songs.entriesByYear[selected]||[]).slice(0,5),'song','/year-end/yearEndSongs')+
      originalTop5('Daegon Albums 100',(albums.entriesByYear[selected]||[]).slice(0,5),'album','/year-end/yearEndAlbums')+
      originalTop5('Daegon Artists 50',(artists.entriesByYear[selected]||[]).slice(0,5),'artist','/year-end/yearEndArtists')+
      originalChartGrid('Songs',SONG_CHARTS,'/year-end/')+
      originalChartGrid('Albums',ALBUM_CHARTS,'/year-end/')+
      originalChartGrid('Artists',ARTIST_CHARTS,'/year-end/')+
      '<div class="orig-bottom-control">'+originalYearControls('Year',years,selected,'yearbottom')+'</div></div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Year-End Charts','The definitive year-end rankings across every chart.','/year-end');
    const change=v=>{selected=v;history.replaceState({},'',appHref('/year-end')+'?year='+encodeURIComponent(v));draw()};
    for(const key of ['year','yearbottom']){
      const toggle=portalEl.querySelector('[data-'+key+'-toggle]'),menu=portalEl.querySelector('[data-'+key+'-menu]');if(toggle&&menu)toggle.onclick=()=>menu.classList.toggle('open');
      portalEl.querySelectorAll('[data-'+key+'-value]').forEach(b=>b.onclick=()=>change(b.dataset[key+'Value']));
      const idx=years.indexOf(selected),prev=idx<years.length-1?years[idx+1]:null,next=idx>0?years[idx-1]:null;
      const pb=portalEl.querySelector('[data-'+key+'-prev]'),nb=portalEl.querySelector('[data-'+key+'-next]');if(pb)pb.onclick=()=>prev&&change(prev);if(nb)nb.onclick=()=>next&&change(next);
    }
    bindLinks();hydratePortalImages();
  };
  draw();
}

async function renderDecadeIndex(){
  loading('Decade-End Charts');
  const ids=['songs','albums','artists'],data=await Promise.all(ids.map(loadWeekly));
  const years=[...new Set(data.flatMap(d=>d.dates.map(x=>Number(x.slice(0,4)))))].sort((a,b)=>b-a);
  const decades=[...new Set(years.map(y=>Math.floor(y/10)*10))].sort((a,b)=>b-a).map(x=>String(x));
  let selected=new URLSearchParams(location.search).get('decade')||decades[0]||'2000';
  const aggregate=(d,id)=>aggregatePeriod(d,id,x=>Number(x.slice(0,4))>=Number(selected)&&Number(x.slice(0,4))<Number(selected)+10).slice(0,5).map((x,i)=>({...x,position:i+1}));
  const draw=()=>{
    const main='<div class="orig-page">'+originalHero('DECADE-END CHARTS','Decade-End Charts','The definitive decade-end rankings across every chart')+
      originalYearControls('Decade',decades.map(x=>x+'s'),selected+'s','decade')+
      originalTop5('Daegon 100',aggregate(data[0],'songs'),'song','/decade-end/songs?decade='+selected)+
      originalTop5('Daegon Albums 100',aggregate(data[1],'albums'),'album','/decade-end/albums?decade='+selected)+
      originalTop5('Daegon Artists 50',aggregate(data[2],'artists'),'artist','/decade-end/artists?decade='+selected)+
      originalChartGrid('Songs',[{id:'songs',title:'Daegon 100'},{id:'radio',title:'Radio Songs'},{id:'digital-songs-sales',title:'Digital Songs Sales'},{id:'streaming-songs',title:'Streaming Songs'}],'/decade-end/')+
      originalChartGrid('Albums',[{id:'albums',title:'Daegon Albums 100'},{id:'top-album-sales',title:'Top Album Sales'},{id:'top-streaming-albums',title:'Top Streaming Albums'}],'/decade-end/')+
      originalChartGrid('Artists',[{id:'artists',title:'Daegon Artists 50'}],'/decade-end/')+
    '</div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Decade-End Charts','The definitive decade-end rankings across every chart.','/decade-end');
    const vals=decades.map(x=>x+'s'),sel=selected+'s',idx=vals.indexOf(sel),prev=idx<vals.length-1?vals[idx+1]:null,next=idx>0?vals[idx-1]:null;
    const toggle=portalEl.querySelector('[data-decade-toggle]'),menu=portalEl.querySelector('[data-decade-menu]');
    if(toggle&&menu)toggle.onclick=()=>menu.classList.toggle('open');
    portalEl.querySelectorAll('[data-decade-value]').forEach(b=>b.onclick=()=>{selected=String(b.dataset.decadeValue).replace(/s$/,'');history.replaceState({},'',appHref('/decade-end')+'?decade='+selected);draw()});
    const pb=portalEl.querySelector('[data-decade-prev]'),nb=portalEl.querySelector('[data-decade-next]');
    if(pb)pb.onclick=()=>{if(prev){selected=prev.replace(/s$/,'');draw()}}; if(nb)nb.onclick=()=>{if(next){selected=next.replace(/s$/,'');draw()}};
    bindLinks();hydratePortalImages();
  };
  draw();
}
async function renderGoatIndex(){
  loading('Greatest of All Time');
  const [songs,albums,artists]=await Promise.all([computeGoatExact('goatSongs'),computeGoatExact('goatAlbums'),computeGoatExact('goatArtists')]);
  const topSongs=[...songs.entries].sort((a,b)=>b.totalPoints-a.totalPoints).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const topAlbums=[...albums.entries].sort((a,b)=>b.totalUnits-a.totalUnits).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const topArtists=[...artists.entries].sort((a,b)=>b.totalUnits-a.totalUnits).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const allCharts=exactGoatIds.map(id=>({id,title:officialGoat[id].title}));
  const main='<div class="orig-page">'+originalHero('GREATEST OF ALL TIME','Greatest of All Time','Long-term rankings built from the complete weekly archive')+
    editorialBlock(
      'What Greatest of All Time means here',
      [
        'The GOAT pages aggregate the project’s weekly history instead of relying on a one-time editorial ranking. Songs, albums and artists accumulate their relevant chart totals across every available week, so longevity and sustained performance remain visible in the all-time view.',
        'Each GOAT chart can be explored by multiple measures such as points, units, audience, sales, streams or weeks on chart where those metrics are available. The underlying weekly pages remain accessible so a high all-time placement can be traced back to actual chart history.'
      ],
      [['/methodology','How chart metrics are calculated'],['/number-ones','Browse every No. 1']]
    )+
    originalTop5('Greatest Songs',topSongs,'song','/goat/goatSongs')+
    originalTop5('Greatest Albums',topAlbums,'album','/goat/goatAlbums')+
    originalTop5('Greatest Artists',topArtists,'artist','/goat/goatArtists')+
    originalChartGrid('All Charts',allCharts,'/goat/')+
  '</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Greatest of All Time','The definitive all-time rankings.','/goat');bindLinks();hydratePortalImages();
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
  const chartStats={};
  ids.forEach((id,i)=>{
    const kind=charts[id].kind,items=aggregateCatalog(datasets[i],kind);
    chartStats[id]=[
      {title:'Most Weeks Charted',icon:'fa-calendar',records:[...items].sort((a,b)=>b.weeks-a.weeks).slice(0,25),value:x=>x.weeks+' Weeks'},
      {title:'Most Weeks at #1',icon:'fa-trophy',records:[...items].sort((a,b)=>b.weeksAt1-a.weeksAt1||b.weeks-a.weeks).slice(0,25),value:x=>x.weeksAt1+' Weeks'},
      {title:'Best Peak',icon:'fa-arrow-trend-up',records:[...items].sort((a,b)=>a.peak-b.peak||b.weeks-a.weeks).slice(0,25),value:x=>'Peak #'+x.peak}
    ];
  });
  let active='songs',type=0;
  const draw=()=>{
    const cats=chartStats[active],cat=cats[type],kind=charts[active].kind;
    const summary=cats.map(c=>{const x=c.records[0];return '<div class="orig-summary-card"><div class="orig-summary-head"><span class="orig-summary-icon"><i class="fas '+c.icon+'"></i></span><span>'+esc(c.title)+'</span></div>'+(x?'<div class="orig-summary-name">'+esc(x.name)+'</div>'+(kind!=='artist'?'<div class="orig-summary-artist">'+esc(x.artist||'')+'</div>':'')+'<div class="orig-summary-value">'+esc(c.value(x))+'</div>':'')+'</div>'}).join('');
    const rows=cat.records.map((x,i)=>'<div class="orig-record-row"><div class="orig-record-rank '+(i<3?'top':'')+'">'+(i+1)+'</div>'+refThumb(x,kind)+'<div class="orig-record-main"><div class="orig-record-name">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="orig-record-artist">'+esc(x.artist||'')+'</div>':'')+'</div><div class="orig-record-value">'+esc(cat.value(x))+(x.peak?'<small>Peak #'+x.peak+'</small>':'')+'</div></div>').join('');
    const main='<div class="orig-stats-page">'+originalHero('STATS','Stats','Records, milestones & chart history across every chart')+
      '<section class="orig-stats-tools"><select id="origStatsChart"><option value="songs" '+(active==='songs'?'selected':'')+'>Hot 100</option><option value="albums" '+(active==='albums'?'selected':'')+'>Top 100 Albums</option><option value="artists" '+(active==='artists'?'selected':'')+'>Artist 50</option></select><select id="origStatsType">'+cats.map((c,i)=>'<option value="'+i+'" '+(i===type?'selected':'')+'>'+esc(c.title)+'</option>').join('')+'</select></section>'+
      '<section class="orig-overview"><div class="orig-eyebrow">Overview</div><div class="orig-summary-grid">'+summary+'</div></section>'+
      '<section class="orig-record-list">'+rows+'</section>'+
    '</div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Stats','Records, milestones & chart history across every chart.','/stats');bindLinks();hydratePortalImages();
    document.getElementById('origStatsChart').onchange=e=>{active=e.target.value;type=0;draw()};
    document.getElementById('origStatsType').onchange=e=>{type=Number(e.target.value);draw()};
  };
  draw();
}

async function renderPeriod(type,chartSeg){
  if(type!=='year')return renderDecadeDetailExact(chartSeg);

  const cfg=officialYearEnd[chartSeg]||officialYearEnd.yearEndSongs;
  loading('Year-End');

  const data=await loadYecExact(chartSeg);
  const years=(data.years||[]).filter(y=>y!=='2026');
  let selected=new URLSearchParams(location.search).get('year')||(years.includes('2025')?'2025':years[0]||'');
  if(!years.includes(selected))selected=years[0]||selected;

  const kind=data.kind||cfg.kind;
  const path='/year-end/'+chartSeg;
  const pre2017=['yearEndSongs','yearEndArtists','yearEndAlbums','yecHot100Artists','yecArtist50Female','yecArtist50Male','yecArtist50DuoGroup','yearEndNewArtists','yecTop100AlbumsArtists'];
  const visibleIds=(selected&&selected<'2017')?pre2017:exactYearEndIds;
  let mobileExpanded=false;
  const openDetails=new Set();

  const metricLabel=kind==='artist'&&chartSeg.startsWith('yec')?'Entries':'Units';

  const draw=()=>{
    const arr=data.entriesByYear[selected]||[];

    const desktopCards=arr.map((e,i)=>{
      const pos=e.position||i+1,isFirst=pos===1,key='yec-'+selected+'-'+pos+'-'+slugify(e.name);
      return '<div class="exact-chart-card '+(isFirst?'first':'')+'">'+
        '<div class="exact-desktop-row">'+
          '<div class="exact-rank '+(isFirst?'first':'')+'">'+pos+'</div>'+
          '<div class="exact-art '+(kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,kind)+'</div>'+
          '<div class="exact-entry"><div class="exact-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="exact-artist">'+esc(e.artist||'')+'</div>':'')+'</div>'+
          '<button type="button" class="exact-plus" data-yec-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-mobile-row">'+
          '<div class="exact-mobile-rank">'+pos+'</div>'+
          '<div class="exact-mobile-art '+(kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,kind)+'</div>'+
          '<div class="exact-mobile-copy"><div class="exact-mobile-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="exact-mobile-artist">'+esc(e.artist||'')+'</div>':'')+'</div>'+
          '<button type="button" class="exact-plus" data-yec-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-details '+(openDetails.has(key)?'open':'')+'">'+
          '<div><span>'+(kind==='artist'&&chartSeg.startsWith('yec')?'Entries':'Peak')+'</span><strong>'+(kind==='artist'&&chartSeg.startsWith('yec')?(e.entries||1):'#'+(e.peak||pos))+'</strong></div>'+
          '<div><span>Weeks</span><strong>'+(e.weeks||'—')+'</strong></div>'+
          '<div><span>'+metricLabel+'</span><strong>'+(metricLabel==='Entries'?(e.entries||1):fmtNum(e.totalUnits||0))+'</strong></div>'+
        '</div>'+
      '</div>';
    }).join('');

    const mobileNav=
      '<div class="exact-mobile-only exact-mobile-chart-nav">'+
        '<a class="exact-mobile-active" href="'+appHref(path)+'?year='+encodeURIComponent(selected)+'">'+esc(cfg.title)+'</a>'+
        '<button type="button" class="exact-mobile-more" data-yec-more>'+(mobileExpanded?'− Less':'+ More Charts')+'</button>'+
        '<div class="exact-mobile-more-list '+(mobileExpanded?'open':'')+'">'+
          visibleIds.filter(id=>id!==chartSeg).map(id=>'<a href="'+appHref('/year-end/'+id)+'?year='+encodeURIComponent(selected)+'">'+esc(officialYearEnd[id]?.title||id)+'</a>').join('')+
        '</div>'+
      '</div>';

    const desktopNav=
      '<div class="exact-desktop-only exact-desktop-chart-nav">'+
        visibleIds.map(id=>'<a href="'+appHref('/year-end/'+id)+'?year='+encodeURIComponent(selected)+'" class="'+(id===chartSeg?'active':'')+'">'+esc(officialYearEnd[id]?.title||id)+'</a>').join('')+
      '</div>';

    const main=
      '<div class="exact-yec-layout">'+
        '<aside class="exact-yec-sidebar">'+
          mobileNav+desktopNav+
          '<a class="exact-back-card" href="'+appHref('/year-end')+'?year='+encodeURIComponent(selected)+'"><i class="fas fa-arrow-left"></i> All Year-End</a>'+
        '</aside>'+
        '<main class="exact-yec-main">'+
          '<div class="exact-yec-heading"><h1>'+esc(cfg.title)+'</h1></div>'+
          originalYearControls('Year',years,selected,'detailperiod')+
          '<div class="exact-chart-list">'+desktopCards+'</div>'+
          (!arr.length?'<div class="exact-empty">'+(selected?'No data for this year.':'Select a year.')+'</div>':'')+
        '</main>'+
      '</div>';

    setMode(true);
    portalEl.innerHTML=shellHtml(main);
    setMeta('Year-End Charts - '+cfg.title,cfg.title,path);
    bindLinks();
    hydratePortalImages();

    const change=v=>{
      selected=v;
      history.replaceState({},'',appHref(path)+'?year='+encodeURIComponent(v));
      mobileExpanded=false;
      draw();
    };

    const toggle=portalEl.querySelector('[data-detailperiod-toggle]');
    const menu=portalEl.querySelector('[data-detailperiod-menu]');
    if(toggle&&menu)toggle.onclick=()=>menu.classList.toggle('open');
    portalEl.querySelectorAll('[data-detailperiod-value]').forEach(b=>b.onclick=()=>change(b.dataset.detailperiodValue));

    const idx=years.indexOf(selected),prev=idx<years.length-1?years[idx+1]:null,next=idx>0?years[idx-1]:null;
    const pb=portalEl.querySelector('[data-detailperiod-prev]'),nb=portalEl.querySelector('[data-detailperiod-next]');
    if(pb)pb.onclick=()=>prev&&change(prev);
    if(nb)nb.onclick=()=>next&&change(next);

    const more=portalEl.querySelector('[data-yec-more]');
    if(more)more.onclick=()=>{mobileExpanded=!mobileExpanded;draw()};

    portalEl.querySelectorAll('[data-yec-detail]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.yecDetail;
      if(openDetails.has(key))openDetails.delete(key);else openDetails.add(key);
      draw();
    });
  };

  draw();
}

async function renderDecadeDetailExact(chartSeg){
  const oldMap={songs:'songs',albums:'albums',artists:'artists'},weeklyId=oldMap[chartSeg]||'songs';
  const data=await loadWeekly(weeklyId),years=[...new Set(data.dates.map(d=>Number(d.slice(0,4))))].sort((a,b)=>b-a),decades=[...new Set(years.map(y=>Math.floor(y/10)*10))].sort((a,b)=>b-a);
  const selected=String(new URLSearchParams(location.search).get('decade')||decades[0]||'2000'),pred=d=>Number(d.slice(0,4))>=Number(selected)&&Number(d.slice(0,4))<Number(selected)+10,arr=aggregatePeriod(data,weeklyId,pred).slice(0,100);
  const path='/decade-end/'+chartSeg,kind=charts[weeklyId].kind,title=charts[weeklyId].title;
  const main='<div class="orig-period-layout"><aside class="orig-period-side"><div class="orig-period-side-links">'+['songs','albums','artists'].map(id=>'<a href="'+appHref('/decade-end/'+id)+'" class="'+(id===chartSeg?'active':'')+'">'+esc(charts[id].title)+'</a>').join('')+'</div><a class="orig-period-back" href="'+appHref('/decade-end')+'"><i class="fas fa-arrow-left"></i> All Decade-End</a></aside><main class="orig-period-main"><div class="orig-period-heading"><h1>'+esc(title)+'</h1></div><div class="orig-period-list">'+arr.map((e,i)=>'<div class="orig-period-card"><div class="orig-period-rank">'+(i+1)+'</div><div class="orig-period-art">'+refThumb(e,kind)+'</div><div class="orig-period-entry"><div class="orig-period-name">'+entityLink(e,kind)+'</div></div></div>').join('')+'</div></main></div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);bindLinks();hydratePortalImages();
}

async function renderGoat(chartSeg){
  const cfg=officialGoat[chartSeg]||officialGoat.goatSongs;
  loading('Greatest of All Time');

  const data=await computeGoatExact(chartSeg);
  const isRadio=chartSeg==='goatRadio';
  let sort=chartSeg==='goatSongs'?'points':isRadio?'audience':'units';
  let search='';
  let page=1;
  let mobileExpanded=false;
  const openDetails=new Set();
  const PAGE_SIZE=50;

  const sortOptions=[
    ...(chartSeg==='goatSongs'?[['points','Total Points']]:[]),
    ...(isRadio?[['audience','Total Audience']]:[]),
    ['units','Total Units'],
    ...((chartSeg==='goatSongs'||chartSeg==='goatAlbums')?[['sales','Total Sales'],['streams','Total Streams']]:[]),
    ['weeks','Weeks on Chart']
  ];

  const metricValue=e=>{
    if(sort==='units')return fmtNum(e.totalUnits||0)+' units';
    if(sort==='streams')return fmtNum(e.totalStreams||0)+' streams';
    if(sort==='sales')return fmtNum(e.totalSales||0)+' sales';
    if(sort==='audience')return fmtNum(e.totalAudience||0)+' audience';
    if(sort==='points')return fmtNum(e.totalPoints||0)+' points';
    return (e.weeks||0)+' weeks';
  };

  const draw=()=>{
    let sorted=[...data.entries];
    const sorters={
      units:(a,b)=>b.totalUnits-a.totalUnits||a.peak-b.peak,
      streams:(a,b)=>b.totalStreams-a.totalStreams||a.peak-b.peak,
      sales:(a,b)=>b.totalSales-a.totalSales||a.peak-b.peak,
      audience:(a,b)=>b.totalAudience-a.totalAudience||a.peak-b.peak,
      points:(a,b)=>b.totalPoints-a.totalPoints||a.peak-b.peak,
      weeks:(a,b)=>b.weeks-a.weeks||a.peak-b.peak
    };
    sorted.sort(sorters[sort]||sorters.weeks);
    sorted=sorted.map((e,i)=>({...e,position:i+1}));

    let filtered=sorted;
    if(search.trim()){
      const q=search.toLowerCase();
      filtered=sorted.filter(e=>(e.name||'').toLowerCase().includes(q)||(e.artist||'').toLowerCase().includes(q));
    }

    const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
    page=Math.min(page,totalPages);
    const displayed=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
    const top3=sorted.slice(0,3);
    const podiumOrder=top3.length>=3?[top3[1],top3[0],top3[2]]:top3;

    const desktopNav=
      '<div class="exact-desktop-only exact-goat-chart-links">'+
        exactGoatIds.map(id=>'<a class="'+(id===chartSeg?'active':'')+'" href="'+appHref('/goat/'+id)+'">'+esc(officialGoat[id].title)+'</a>').join('')+
      '</div>';

    const mobileNav=
      '<div class="exact-mobile-only exact-goat-mobile-nav">'+
        '<a class="exact-goat-mobile-active" href="'+appHref('/goat/'+chartSeg)+'">'+esc(cfg.title)+'</a>'+
        '<button type="button" class="exact-mobile-more" data-goat-more>'+(mobileExpanded?'− Less':'+ More Charts')+'</button>'+
        '<div class="exact-mobile-more-list '+(mobileExpanded?'open':'')+'">'+
          exactGoatIds.filter(id=>id!==chartSeg).map(id=>'<a href="'+appHref('/goat/'+id)+'">'+esc(officialGoat[id].title)+'</a>').join('')+
        '</div>'+
      '</div>';

    const cards=displayed.map((e,i)=>{
      const key='goat-'+chartSeg+'-'+e.position+'-'+slugify(e.name);
      const isFirst=e.position===1;
      return '<div class="exact-chart-card '+(isFirst?'first':'')+'">'+
        '<div class="exact-desktop-row">'+
          '<div class="exact-rank '+(isFirst?'first':'')+'">'+e.position+'</div>'+
          '<div class="exact-art '+(data.kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,data.kind)+'</div>'+
          '<div class="exact-entry"><div class="exact-title">'+entityLink(e,data.kind)+'</div>'+(data.kind!=='artist'?'<div class="exact-artist">'+esc(e.artist||'')+'</div>':'')+'</div>'+
          '<div class="exact-goat-desktop-metric">'+esc(metricValue(e))+'</div>'+
          '<button type="button" class="exact-plus" data-goat-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-mobile-row">'+
          '<div class="exact-mobile-rank">'+e.position+'</div>'+
          '<div class="exact-mobile-art '+(data.kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,data.kind)+'</div>'+
          '<div class="exact-mobile-copy"><div class="exact-mobile-title">'+entityLink(e,data.kind)+'</div>'+(data.kind!=='artist'?'<div class="exact-mobile-artist">'+esc(e.artist||'')+'</div>':'')+'</div>'+
          '<button type="button" class="exact-plus" data-goat-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-details '+(openDetails.has(key)?'open':'')+'">'+
          '<div><span>Peak</span><strong>#'+(e.peak||e.position)+'</strong></div>'+
          '<div><span>Weeks</span><strong>'+(e.weeks||0)+'</strong></div>'+
          '<div><span>'+esc(sortOptions.find(x=>x[0]===sort)?.[1]||'Metric')+'</span><strong>'+esc(metricValue(e))+'</strong></div>'+
        '</div>'+
      '</div>';
    }).join('');

    const main=
      '<div class="exact-goat-page">'+
        '<div class="exact-goat-flex">'+
          '<aside class="exact-goat-sidebar">'+
            '<div class="exact-sidebar-section"><div class="exact-sidebar-label">Sort By</div><select id="exactGoatSort">'+
              sortOptions.map(([k,l])=>'<option value="'+k+'" '+(sort===k?'selected':'')+'>'+esc(l)+'</option>').join('')+
            '</select></div>'+
            '<div class="exact-sidebar-section"><div class="exact-sidebar-label">Charts</div>'+mobileNav+desktopNav+'</div>'+
            '<a class="exact-back-card" href="'+appHref('/goat')+'"><i class="fas fa-arrow-left"></i> All Greatest of All Time</a>'+
          '</aside>'+
          '<main class="exact-goat-content">'+
            '<div class="exact-goat-heading"><div class="exact-goat-bg">Greatest of All Time</div><h1>'+esc(cfg.title)+'</h1><p>'+sorted.length+' greatest of all time</p></div>'+
            (podiumOrder.length?'<div class="exact-goat-podium">'+podiumOrder.map((e,idx)=>{
              const first=top3[0]&&e.position===top3[0].position;
              return '<div class="exact-podium-card '+(first?'first':'')+'"><div class="exact-podium-rank">'+e.position+'</div><div class="exact-podium-title">'+esc(e.name)+'</div>'+(data.kind!=='artist'?'<div class="exact-podium-artist">'+esc(e.artist||'')+'</div>':'')+'<div class="exact-podium-metric">'+esc(metricValue(e))+'</div></div>';
            }).join('')+'</div>':'')+
            '<div class="exact-goat-search-wrap"><input id="exactGoatSearch" value="'+escAttr(search)+'" placeholder="Search...">'+(search?'<button id="exactGoatClear">×</button>':'')+'</div>'+
            '<div class="exact-results-count">'+filtered.length+' item'+(filtered.length===1?'':'s')+' found'+(search?' matching “'+esc(search)+'”':'')+'</div>'+
            '<div class="exact-chart-list">'+cards+'</div>'+
            (totalPages>1?'<div class="exact-pagination"><button id="exactGoatPrev" '+(page<=1?'disabled':'')+'><i class="fas fa-chevron-left"></i></button><span>Page '+page+' of '+totalPages+'</span><button id="exactGoatNext" '+(page>=totalPages?'disabled':'')+'><i class="fas fa-chevron-right"></i></button></div>':'')+
          '</main>'+
        '</div>'+
      '</div>';

    setMode(true);
    portalEl.innerHTML=shellHtml(main);
    setMeta(cfg.title,cfg.title,'/goat/'+chartSeg);
    bindLinks();
    hydratePortalImages();

    const sortEl=document.getElementById('exactGoatSort');
    if(sortEl)sortEl.onchange=e=>{sort=e.target.value;page=1;draw()};

    const searchEl=document.getElementById('exactGoatSearch');
    if(searchEl)searchEl.oninput=e=>{
      search=e.target.value;
      page=1;
      clearTimeout(window.__exactGoatSearchTimer);
      window.__exactGoatSearchTimer=setTimeout(draw,120);
    };

    const clear=document.getElementById('exactGoatClear');
    if(clear)clear.onclick=()=>{search='';page=1;draw()};

    const more=portalEl.querySelector('[data-goat-more]');
    if(more)more.onclick=()=>{mobileExpanded=!mobileExpanded;draw()};

    portalEl.querySelectorAll('[data-goat-detail]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.goatDetail;
      if(openDetails.has(key))openDetails.delete(key);else openDetails.add(key);
      draw();
    });

    const prev=document.getElementById('exactGoatPrev'),next=document.getElementById('exactGoatNext');
    if(prev)prev.onclick=()=>{if(page>1){page--;draw();window.scrollTo({top:0,behavior:'smooth'})}};
    if(next)next.onclick=()=>{if(page<totalPages){page++;draw();window.scrollTo({top:0,behavior:'smooth'})}};
  };

  draw();
}

async function renderChartBeat(){
  loading('Chart Beat');
  const ids=['songs','albums','artists','radioSongs','streamingSongs','digitalSongsSales','topStreamingAlbums','topAlbumSales'];
  const data=await Promise.all(ids.map(async id=>{try{return await loadWeekly(id)}catch{return null}}));
  let active='songs',date=(data[0]?.dates||[]).slice(-1)[0]||'';
  const draw=()=>{
    const d=data[ids.indexOf(active)],dates=[...(d?.dates||[])].reverse(),entries=d?.entriesByDate?.[date]||[],no1=entries[0],debuts=entries.filter(x=>x.diff==='NEW').slice(0,5);
    const mover=[...entries].filter(x=>String(x.diff).startsWith('▲')).sort((a,b)=>toInt(String(b.diff).slice(1))-toInt(String(a.diff).slice(1)))[0];
    const top10=entries.slice(0,10),returners=entries.filter(x=>x.diff==='RE').slice(0,5),steady=entries.filter(x=>String(x.diff)==='0').slice(0,5);
    const article='<article class="orig-beat-article">'+
      '<div class="editorial-kicker">Weekly analysis</div>'+
      (no1?'<h2>'+esc(no1.name)+' leads the '+esc(charts[active].title)+'</h2><p><strong>'+esc(no1.artist||no1.name)+'</strong> holds No. 1 for the chart week of '+fmtDate(date)+'. The chart below is read from the same weekly dataset used throughout the archive, so movement and historical runs remain directly traceable to the source week.</p>':'')+
      (top10.length?'<h3>Inside the Top 10</h3><p>The week’s Top 10 contains '+top10.length+' entries. '+top10.slice(0,3).map((x,i)=>(i+1)+'. <strong>'+esc(x.name)+'</strong>').join(' · ')+' lead the upper tier.</p>':'')+
      (debuts.length?'<h3>New entries</h3><p>'+debuts.map(x=>'<strong>'+esc(x.name)+'</strong>').join(', ')+' '+(debuts.length===1?'makes':'make')+' a first chart appearance this week.</p>':'')+
      (returners.length?'<h3>Returns</h3><p>'+returners.map(x=>'<strong>'+esc(x.name)+'</strong>').join(', ')+' return to the ranking after appearing in an earlier week.</p>':'')+
      (mover?'<h3>Biggest upward move</h3><p><strong>'+esc(mover.name)+'</strong> posts the strongest climb among the entries shown this week ('+esc(mover.diff)+').</p>':'')+
      (steady.length?'<h3>Holding position</h3><p>'+steady.slice(0,3).map(x=>'<strong>'+esc(x.name)+'</strong>').join(', ')+' remain at the same rank as the previous chart week.</p>':'')+
      '<div class="beat-method-note"><strong>About Chart Beat:</strong> this page summarizes movements already present in the Daegon weekly chart. It does not add a separate editorial score to the rankings. <a href="'+appHref('/methodology')+'">Read the methodology →</a></div>'+
    '</article>';
    const main='<div class="orig-beat-layout"><aside class="orig-beat-side"><h2>Chart Beat</h2><div class="orig-beat-charts">'+ids.map(id=>'<button data-beat-chart="'+id+'" class="'+(id===active?'active':'')+'"><i class="fas '+(charts[id].icon||'fa-chart-bar')+'"></i>'+esc(charts[id].title)+'</button>').join('')+'</div><h3>Weeks</h3><div class="orig-beat-weeks">'+dates.slice(0,80).map(x=>'<button data-beat-date="'+x+'" class="'+(x===date?'active':'')+'">'+fmtDate(x)+'</button>').join('')+'</div></aside><main class="orig-beat-main"><div class="orig-beat-title"><h1>Chart Beat</h1><p>'+esc(charts[active].title)+' · '+fmtDate(date)+'</p></div><div class="orig-beat-actions"><a href="'+appHref(chartPath(active,date))+'" class="orig-view"><i class="fas fa-chart-bar"></i> View Raw Chart</a></div>'+article+'</main></div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Chart Beat','Weekly analysis of No. 1s, debuts, returns and movement across Daegon Charts.','/chart-beat');bindLinks();
    portalEl.querySelectorAll('[data-beat-chart]').forEach(b=>b.onclick=()=>{active=b.dataset.beatChart;const dd=data[ids.indexOf(active)];date=(dd?.dates||[]).slice(-1)[0]||'';draw()});
    portalEl.querySelectorAll('[data-beat-date]').forEach(b=>b.onclick=()=>{date=b.dataset.beatDate;draw()});
  };
  draw();
}

async function renderAwards(){
  loading('Awards');
  const editions=[2025,2024,2023,2022,2021,2020,2019,2018,2017];
  const main='<div class="orig-awards"><div class="orig-awards-bar"><a href="'+appHref('/awards')+'" class="orig-awards-logo"><i class="fas fa-trophy"></i><span>DAEGON AWARDS</span></a><nav><a class="active" href="'+appHref('/awards')+'">Home</a><a href="#">Categories</a><a href="#">Artists</a><a href="'+appHref('/stats')+'">Stats</a><a href="'+appHref('/about')+'">About</a></nav><div class="orig-awards-search"><i class="fas fa-search"></i><input placeholder="Search artists, songs..."></div></div><div class="orig-awards-body"><div class="orig-awards-intro"><h2>Daegon Music Awards</h2><p>Celebrating excellence in music across multiple genres and categories. Explore past editions, winners, and nominees.</p></div><div class="orig-editions">'+editions.map(y=>'<button data-award-year="'+y+'"><strong>'+y+'</strong><span>EDITION</span></button>').join('')+'</div></div></div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Daegon Awards','Daegon Music Awards.','/awards');
  portalEl.querySelectorAll('[data-award-year]').forEach(b=>b.onclick=()=>{history.replaceState({},'',appHref('/awards')+'?year='+b.dataset.awardYear);renderAwardsYear(b.dataset.awardYear)});
}
async function renderAwardsYear(year){
  const datasets=await Promise.all(['songs','albums','artists'].map(loadWeekly));
  const winners=datasets.map((d,i)=>{const id=['songs','albums','artists'][i];return{id,kind:charts[id].kind,list:aggregatePeriod(d,id,x=>x.startsWith(year+'-')).slice(0,5)}});
  const main='<div class="orig-awards"><div class="orig-awards-bar"><a href="'+appHref('/awards')+'" class="orig-awards-logo"><i class="fas fa-trophy"></i><span>DAEGON AWARDS</span></a></div><div class="orig-awards-body"><div class="orig-awards-intro"><h2>Daegon Music Awards '+esc(year)+'</h2></div><div class="orig-award-winners">'+winners.map(w=>'<section><h3>'+esc(charts[w.id].title)+'</h3>'+w.list.map((x,i)=>'<div class="orig-record-row"><div class="orig-record-rank '+(i===0?'top':'')+'">'+(i+1)+'</div><div class="orig-record-main"><div class="orig-record-name">'+entityLink(x,w.kind)+'</div>'+(w.kind!=='artist'?'<div class="orig-record-artist">'+esc(x.artist||'')+'</div>':'')+'</div></div>').join('')+'</section>').join('')+'</div></div></div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);bindLinks();
}

async function renderBattle(){
  loading('Chart Battle');
  const artistData=await loadWeekly('artists');
  const artists=aggregateCatalog(artistData,'artist').map(x=>x.name).sort((a,b)=>a.localeCompare(b));
  const allIds=['songs','albums','artists','radioSongs','topStreamingAlbums','topAlbumSales','streamingSongs','digitalSongsSales'];
  let allData=null;

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
      document.getElementById('refFight').onclick=async()=>{
        if(!(a1&&a2))return;
        const btn=document.getElementById('refFight');
        btn.disabled=true;btn.textContent='Loading…';
        allData=await Promise.all(allIds.map(async id=>{try{return await loadWeekly(id)}catch{return null}}));
        started=true;draw();
      };
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
  const main='<div class="portal-hero"><div class="portal-kicker">Archive search</div><h1 class="portal-title">Search</h1><p class="portal-subtitle">Search songs, albums and artists across the complete archive.</p></div><div class="portal-toolbar"><input id="globalSearch" class="portal-input" placeholder="Type a song, album or artist…" autofocus></div><div id="searchRows" class="portal-empty">Start typing to search.</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Search','Search the Daegon Charts archive.','/search');

  const inp=document.getElementById('globalSearch'),rows=document.getElementById('searchRows');
  let all=null,loadingPromise=null,timer=null;

  const ensureData=()=>{
    if(all)return Promise.resolve(all);
    if(loadingPromise)return loadingPromise;
    loadingPromise=Promise.all([loadWeekly('songs'),loadWeekly('albums'),loadWeekly('artists')]).then(([songs,albums,artists])=>{
      all=[
        ...aggregateCatalog(songs,'song').map(x=>({...x,kind:'song'})),
        ...aggregateCatalog(albums,'album').map(x=>({...x,kind:'album'})),
        ...aggregateCatalog(artists,'artist').map(x=>({...x,kind:'artist'}))
      ];
      return all;
    }).finally(()=>{loadingPromise=null});
    return loadingPromise;
  };

  const draw=async()=>{
    const q=inp.value.trim().toLowerCase();
    if(!q){rows.className='portal-empty';rows.innerHTML='Start typing to search.';return}
    rows.className='portal-empty';rows.innerHTML='Searching archive…';
    const data=await ensureData();
    if(inp.value.trim().toLowerCase()!==q)return;
    const hits=data.filter(x=>(x.name+' '+(x.artist||'')).toLowerCase().includes(q)).slice(0,100);
    rows.className='portal-list';
    rows.innerHTML=hits.map(x=>'<div class="portal-row"><div class="portal-row-rank"><i class="fas '+iconFor(x.kind)+'"></i></div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,x.kind)+'</div><div class="portal-row-sub">'+labelFor(x.kind)+(x.kind!=='artist'?' · '+esc(x.artist):'')+'</div></div><div class="portal-row-meta">Peak #'+x.peak+' · '+x.weeks+' weeks</div></div>').join('')||'<div class="portal-empty">No results.</div>';
    bindLinks();
  };

  inp.oninput=()=>{
    clearTimeout(timer);
    if(!inp.value.trim()){rows.className='portal-empty';rows.innerHTML='Start typing to search.';return}
    timer=setTimeout(draw,180);
  };
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
    else if(p[0]==='year-end'){if(p[1])await renderPeriod('year',({songs:'yearEndSongs',albums:'yearEndAlbums',artists:'yearEndArtists'}[p[1]]||p[1]));else await renderYearEndIndex()}
    else if(p[0]==='decade-end'){if(p[1])await renderPeriod('decade',p[1]);else await renderDecadeIndex()}
    else if(p[0]==='goat'){if(p[1])await renderGoat(({songs:'goatSongs',albums:'goatAlbums',artists:'goatArtists',radio:'goatRadio'}[p[1]]||p[1]));else await renderGoatIndex()}
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
