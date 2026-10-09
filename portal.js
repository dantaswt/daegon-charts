(function(){
'use strict';

const PORTAL_ROUTES=new Set(['','news','features','reviews','trending','community','forum','plans','ai','my-daegon','my-charts','songs','albums','artists','number-ones','stats','year-end','decade-end','goat','chart-beat','awards','chart-battle','search','song','album','artist']);
const mainChartIds={song:'songs',album:'albums',artist:'artists'};
const periodLimits={songs:100,albums:100,artists:50};
const PORTAL_SHEET='https://docs.google.com/spreadsheets/d/1t6_7SOlspmNYrXq8PSfJ74frIdrWwQBFITQ3bQmRzeg/gviz/tq?tq=select%20*&tqx=out:csv&gid=';
const officialYearEnd={
  yearEndSongs:{kind:'song',title:'Daegon 100',weeklyId:'songs'},
  yearEndArtists:{kind:'artist',title:'Artist 50',weeklyId:'artists'},
  yearEndAlbums:{kind:'album',title:'Top 100 Albums',weeklyId:'albums'},
  yearEndRadio:{kind:'song',title:'Radio Songs',weeklyId:'radioSongs'},
  yearEndStreamingSongs:{kind:'song',title:'Streaming Songs',weeklyId:'streamingSongs'},
  yearEndTopStreamingAlbums:{kind:'album',title:'Top Streaming Albums',weeklyId:'topStreamingAlbums'},
  yearEndTopAlbumSales:{kind:'album',title:'Top Album Sales',weeklyId:'topAlbumSales'},
  yearEndDigitalSongsSales:{kind:'song',title:'Digital Songs Sales',weeklyId:'digitalSongsSales'},
  yearEndNewArtists:{kind:'artist',title:'Top New Artists',weeklyId:'artists'},
  yecHot100Artists:{kind:'artist',title:'Daegon 100 — Artists',weeklyId:'songs'},
  yecTop100AlbumsArtists:{kind:'artist',title:'Top 100 Albums — Artists',weeklyId:'albums'},
  yecArtist50Female:{kind:'artist',title:'Top Artists — Female',weeklyId:'artists'},
  yecArtist50Male:{kind:'artist',title:'Top Artists — Male',weeklyId:'artists'},
  yecArtist50DuoGroup:{kind:'artist',title:'Top Artists — Duo/Group',weeklyId:'artists'},
  yecRadioSongsArtists:{kind:'artist',title:'Radio Songs — Artists',weeklyId:'radioSongs'}
};
const officialGoat={
  goatSongs:{kind:'song',title:'Greatest Daegon 100 Songs',weeklyId:'songs'},
  goatArtists:{kind:'artist',title:'Greatest Artist 50',weeklyId:'artists'},
  goatAlbums:{kind:'album',title:'Greatest Top 100 Albums',weeklyId:'albums'},
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
function closePortalMenu(){
  const menu=document.getElementById('portalMobileMenu');
  const btn=document.getElementById('portalMenuToggle');
  const globalDrawer=document.getElementById('globalMobileDrawer');
  const globalBtn=document.getElementById('globalMenuToggle');
  if(menu){
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    menu.style.display='none';
  }
  if(btn)btn.setAttribute('aria-expanded','false');
  if(globalDrawer){
    globalDrawer.classList.remove('open');
    globalDrawer.setAttribute('aria-hidden','true');
  }
  if(globalBtn)globalBtn.setAttribute('aria-expanded','false');
  document.documentElement.classList.remove('menu-open');
  document.body.classList.remove('menu-open');
  if(document.body.style.overflow==='hidden')document.body.style.removeProperty('overflow');
}
function keepViewportPosition(y){
  const restore=()=>window.scrollTo(0,y);
  restore();
  requestAnimationFrame(()=>{
    restore();
    requestAnimationFrame(restore);
  });
  setTimeout(restore,80);
  setTimeout(restore,180);
}
function scrollPageTop(){
  const top=()=>window.scrollTo({top:0,left:0,behavior:'auto'});
  top();
  requestAnimationFrame(()=>{
    top();
    requestAnimationFrame(top);
  });
  setTimeout(top,60);
  setTimeout(top,180);
}
function go(path,replace=false){
  closePortalMenu();
  const target=appHref(path);
  history[replace?'replaceState':'pushState']({},'',target);
  scrollPageTop();
  const job=renderRoute();
  Promise.resolve(job).finally(scrollPageTop);
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



let _dcSupabase=null,_dcAuthUser=null,_dcAuthSub=null;
function dcSupabaseClient(){
  if(_dcSupabase)return _dcSupabase;
  if(!window.supabase?.createClient||typeof SUPABASE_URL==='undefined'||typeof SUPABASE_KEY==='undefined')return null;
  _dcSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  return _dcSupabase;
}
function dcSafeDisplayName(user){
  const email=String(user?.email||'reader');
  const base=email.split('@')[0].replace(/[._-]+/g,' ').trim()||'Daegon reader';
  return base.slice(0,40);
}
async function dcEnsureProfile(user){
  const sb=dcSupabaseClient();if(!sb||!user)return null;
  const {data}=await sb.from('community_profiles').select('user_id,display_name,avatar_url,bio').eq('user_id',user.id).maybeSingle();
  if(data)return data;
  const profile={user_id:user.id,display_name:dcSafeDisplayName(user)};
  const {data:created,error}=await sb.from('community_profiles').insert(profile).select('user_id,display_name,avatar_url,bio').single();
  if(error){console.warn('Profile create',error);return profile}
  return created;
}
function dcAccountLabel(){return _dcAuthUser?'MY DAEGON':'SIGN IN'}
function dcSyncAccountButton(){
  const b=document.getElementById('portalAccountBtn');if(!b)return;
  b.innerHTML='<i class="fas '+(_dcAuthUser?'fa-user-circle':'fa-user')+'"></i><span>'+dcAccountLabel()+'</span>';
  b.setAttribute('aria-label',_dcAuthUser?'My Daegon account':'Sign in to Daegon');
}
function dcCloseAuthModal(){document.getElementById('dcAuthModal')?.remove()}
function dcShowAuthModal(){
  dcCloseAuthModal();
  const wrap=document.createElement('div');wrap.id='dcAuthModal';wrap.className='dc-auth-modal';
  wrap.innerHTML=_dcAuthUser
    ? '<div class="dc-auth-card"><button class="dc-auth-close" data-auth-close>×</button><div class="mag-kicker">My Daegon</div><h2>'+esc(_dcAuthUser.email||'Signed in')+'</h2><p>Follow artists, save stories and build your personal music feed.</p><div class="dc-auth-actions"><button class="portal-btn active" data-open-my-daegon>Open My Daegon</button><button class="portal-btn" data-auth-signout>Sign out</button></div></div>'
    : '<div class="dc-auth-card"><button class="dc-auth-close" data-auth-close>×</button><div class="mag-kicker">Daegon Community</div><h2>Sign in by email</h2><p>We’ll send you a secure magic link. No password required.</p><form id="dcMagicForm"><label>Email</label><input id="dcMagicEmail" type="email" autocomplete="email" required placeholder="you@example.com"><button class="portal-btn active" type="submit">Send magic link</button><div id="dcAuthStatus" class="dc-auth-status"></div></form><small>By signing in, you agree to the site terms and community moderation rules.</small></div>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-auth-close]').onclick=dcCloseAuthModal;
  wrap.onclick=e=>{if(e.target===wrap)dcCloseAuthModal()};
  const openMy=wrap.querySelector('[data-open-my-daegon]');if(openMy)openMy.onclick=()=>{dcCloseAuthModal();go('/my-daegon')};
  const out=wrap.querySelector('[data-auth-signout]');
  if(out)out.onclick=async()=>{const sb=dcSupabaseClient();if(sb)await sb.auth.signOut();_dcAuthUser=null;dcSyncAccountButton();dcCloseAuthModal();renderRoute()};
  const form=wrap.querySelector('#dcMagicForm');
  if(form)form.onsubmit=async e=>{
    e.preventDefault();
    const status=wrap.querySelector('#dcAuthStatus'),email=wrap.querySelector('#dcMagicEmail').value.trim();
    status.textContent='Sending…';
    const sb=dcSupabaseClient();if(!sb){status.textContent='Sign-in service unavailable.';return}
    const {error}=await sb.auth.signInWithOtp({email});
    status.textContent=error?error.message:'Check your inbox for the Daegon sign-in link.';
  };
}
async function dcInitAuth(){
  const sb=dcSupabaseClient();if(!sb)return;
  try{
    const {data}=await sb.auth.getSession();
    _dcAuthUser=data?.session?.user||null;
    dcSyncAccountButton();
    if(_dcAuthUser)dcEnsureProfile(_dcAuthUser);
    if(!_dcAuthSub){
      const sub=sb.auth.onAuthStateChange(async(_event,session)=>{
        _dcAuthUser=session?.user||null;dcSyncAccountButton();
        if(_dcAuthUser)await dcEnsureProfile(_dcAuthUser);
        const mount=document.getElementById('dcCommentsMount');
        if(mount&&mount.dataset.articleId)dcRenderComments(Number(mount.dataset.articleId));
      });
      _dcAuthSub=sub?.data?.subscription||true;
    }
  }catch(e){console.warn('Auth init',e)}
}
async function dcRenderComments(articleId){
  const mount=document.getElementById('dcCommentsMount');if(!mount||!articleId)return;
  const sb=dcSupabaseClient();if(!sb){mount.innerHTML='<p class="dc-comment-empty">Comments are temporarily unavailable.</p>';return}
  mount.dataset.articleId=String(articleId);
  mount.innerHTML='<div class="dc-comment-loading">Loading discussion…</div>';
  const {data:comments,error}=await sb.from('article_comments').select('id,user_id,parent_id,body,status,created_at').eq('article_id',articleId).order('created_at',{ascending:true});
  if(error){mount.innerHTML='<p class="dc-comment-empty">Discussion could not load.</p>';return}
  const ids=[...new Set((comments||[]).map(x=>x.user_id).filter(Boolean))];
  let profiles=[];
  if(ids.length){const p=await sb.from('community_profiles').select('user_id,display_name,avatar_url').in('user_id',ids);profiles=p.data||[]}
  const pm=new Map(profiles.map(x=>[x.user_id,x]));
  const visible=(comments||[]).filter(x=>x.status==='approved'||(_dcAuthUser&&x.user_id===_dcAuthUser.id));
  const form=_dcAuthUser
    ? '<form id="dcCommentForm" class="dc-comment-form"><textarea id="dcCommentBody" maxlength="2000" required placeholder="Join the discussion…"></textarea><div><span>Comments are reviewed before publication.</span><button type="submit">Post comment</button></div><div id="dcCommentStatus"></div></form>'
    : '<div class="dc-comment-signin"><p>Sign in to join the discussion.</p><button type="button" data-comment-signin>Sign in</button></div>';
  const rows=visible.length?visible.map(x=>{
    const p=pm.get(x.user_id),mine=_dcAuthUser&&x.user_id===_dcAuthUser.id;
    return '<article class="dc-comment '+(x.status!=='approved'?'pending':'')+'"><div class="dc-comment-head"><strong>'+esc(p?.display_name||'Daegon reader')+'</strong><span>'+new Date(x.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})+(x.status!=='approved'?' · Awaiting moderation':'')+'</span></div><p>'+esc(x.body)+'</p>'+(mine?'<button data-delete-comment="'+x.id+'">Delete</button>':'')+'</article>';
  }).join(''):'<p class="dc-comment-empty">No approved comments yet. Start the discussion.</p>';
  mount.innerHTML='<section class="dc-comments"><div class="dc-comments-head"><div class="mag-kicker">Community</div><h2>Discussion</h2><p>Talk about the story, not the person. Comments are moderated.</p></div>'+form+'<div class="dc-comment-list">'+rows+'</div></section>';
  const signin=mount.querySelector('[data-comment-signin]');if(signin)signin.onclick=dcShowAuthModal;
  const formEl=mount.querySelector('#dcCommentForm');
  if(formEl)formEl.onsubmit=async e=>{
    e.preventDefault();const body=mount.querySelector('#dcCommentBody').value.trim(),st=mount.querySelector('#dcCommentStatus');
    if(!body)return;st.textContent='Submitting…';
    await dcEnsureProfile(_dcAuthUser);
    const {error:insErr}=await sb.from('article_comments').insert({article_id:articleId,user_id:_dcAuthUser.id,body,status:'pending'});
    if(insErr){st.textContent=insErr.message;return}
    st.textContent='Submitted for moderation.';mount.querySelector('#dcCommentBody').value='';dcRenderComments(articleId);
  };
  mount.querySelectorAll('[data-delete-comment]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Delete this comment?'))return;
    await sb.from('article_comments').delete().eq('id',Number(b.dataset.deleteComment));dcRenderComments(articleId);
  });
}

async function dcRequireUser(){
  if(_dcAuthUser)return _dcAuthUser;
  dcShowAuthModal();return null;
}
async function dcToggleArtistFollow(button,artistName){
  const user=await dcRequireUser();if(!user)return;
  const sb=dcSupabaseClient(),key=slugify(artistName);
  const {data}=await sb.from('user_artist_follows').select('artist_key').eq('user_id',user.id).eq('artist_key',key).maybeSingle();
  if(data)await sb.from('user_artist_follows').delete().eq('user_id',user.id).eq('artist_key',key);
  else await sb.from('user_artist_follows').insert({user_id:user.id,artist_key:key,artist_name:artistName});
  if(button){button.classList.toggle('active',!data);button.innerHTML='<i class="fas fa-'+(data?'plus':'check')+'"></i> '+(data?'Follow':'Following')}
}
async function dcSyncArtistFollow(button,artistName){
  if(!button)return;
  if(!_dcAuthUser){button.innerHTML='<i class="fas fa-plus"></i> Follow';return}
  const sb=dcSupabaseClient(),key=slugify(artistName);
  const {data}=await sb.from('user_artist_follows').select('artist_key').eq('user_id',_dcAuthUser.id).eq('artist_key',key).maybeSingle();
  button.classList.toggle('active',!!data);button.innerHTML='<i class="fas fa-'+(data?'check':'plus')+'"></i> '+(data?'Following':'Follow');
}
async function dcToggleFavorite(button,kind,name,artist){
  const user=await dcRequireUser();if(!user)return;
  const sb=dcSupabaseClient(),key=slugify(name)+'--'+slugify(artist||'');
  const {data}=await sb.from('user_favorites').select('entity_key').eq('user_id',user.id).eq('entity_type',kind).eq('entity_key',key).maybeSingle();
  if(data)await sb.from('user_favorites').delete().eq('user_id',user.id).eq('entity_type',kind).eq('entity_key',key);
  else await sb.from('user_favorites').insert({user_id:user.id,entity_type:kind,entity_key:key,entity_name:name,artist_name:artist||null});
  if(button){button.classList.toggle('active',!data);button.innerHTML='<i class="'+(data?'far':'fas')+' fa-star"></i>'}
}
async function dcSyncFavorite(button,kind,name,artist){
  if(!button||!_dcAuthUser){if(button)button.innerHTML='<i class="far fa-star"></i>';return}
  const sb=dcSupabaseClient(),key=slugify(name)+'--'+slugify(artist||'');
  const {data}=await sb.from('user_favorites').select('entity_key').eq('user_id',_dcAuthUser.id).eq('entity_type',kind).eq('entity_key',key).maybeSingle();
  button.classList.toggle('active',!!data);button.innerHTML='<i class="'+(data?'fas':'far')+' fa-star"></i>';
}
async function dcToggleSavedArticle(button,articleId){
  const user=await dcRequireUser();if(!user||!articleId)return;
  const sb=dcSupabaseClient();
  const {data}=await sb.from('user_saved_articles').select('article_id').eq('user_id',user.id).eq('article_id',articleId).maybeSingle();
  if(data)await sb.from('user_saved_articles').delete().eq('user_id',user.id).eq('article_id',articleId);
  else await sb.from('user_saved_articles').insert({user_id:user.id,article_id:articleId});
  if(button){button.classList.toggle('active',!data);button.innerHTML='<i class="'+(data?'far':'fas')+' fa-bookmark"></i> '+(data?'Save':'Saved')}
}
async function dcSyncSavedArticle(button,articleId){
  if(!button||!articleId){return}
  if(!_dcAuthUser){button.innerHTML='<i class="far fa-bookmark"></i> Save';return}
  const sb=dcSupabaseClient();
  const {data}=await sb.from('user_saved_articles').select('article_id').eq('user_id',_dcAuthUser.id).eq('article_id',articleId).maybeSingle();
  button.classList.toggle('active',!!data);button.innerHTML='<i class="'+(data?'fas':'far')+' fa-bookmark"></i> '+(data?'Saved':'Save');
}

function dcSaturdayFor(ts){
  const d=new Date(ts);const day=d.getUTCDay();const add=(6-day+7)%7;
  const out=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+add));
  return out.toISOString().slice(0,10);
}
function dcPersonalChartWeek(events){
  const songs=new Map(),albums=new Map(),artists=new Map();
  for(const e of events){
    const day=String(e.played_at||'').slice(0,10),ms=Number(e.ms_played||0);
    if(ms<30000)continue;
    const sk=slugify(e.track_name)+'--'+slugify(e.artist_name);
    const ak=slugify(e.album_name||'')+'--'+slugify(e.artist_name);
    const rk=slugify(e.artist_name);
    const add=(map,key,name,artist)=>{
      const x=map.get(key)||{entity_key:key,entity_name:name,artist_name:artist||null,streams:0,listening_ms:0,days:new Set()};
      x.streams++;x.listening_ms+=ms;x.days.add(day);map.set(key,x);
    };
    add(songs,sk,e.track_name,e.artist_name);
    if(e.album_name)add(albums,ak,e.album_name,e.artist_name);
    add(artists,rk,e.artist_name,null);
  }
  const rank=(map,limit)=>{
    const list=[...map.values()].map(x=>{
      const active=x.days.size;
      const score=x.streams*100+(x.listening_ms/60000)*1.5+active*18;
      return {...x,active_days:active,score};
    }).sort((a,b)=>b.score-a.score||b.streams-a.streams||b.listening_ms-a.listening_ms).slice(0,limit);
    return list.map((x,i)=>({...x,rank:i+1}));
  };
  return {songs:rank(songs,100),albums:rank(albums,50),artists:rank(artists,50)};
}
async function dcImportSpotifyHistory(file,statusEl){
  const user=await dcRequireUser();if(!user)return;
  const sb=dcSupabaseClient();
  statusEl.textContent='Reading Spotify history…';
  let raw;
  try{raw=JSON.parse(await file.text())}catch{statusEl.textContent='This file is not valid JSON.';return}
  const rows=Array.isArray(raw)?raw:(Array.isArray(raw?.items)?raw.items:[]);
  const normalized=rows.map(x=>{
    const played=x.ts||x.endTime||x.played_at;
    const artist=x.master_metadata_album_artist_name||x.artistName||x.artist_name;
    const track=x.master_metadata_track_name||x.trackName||x.track_name;
    const album=x.master_metadata_album_album_name||x.albumName||x.album_name||null;
    const ms=Number(x.ms_played??x.msPlayed??0);
    const uri=x.spotify_track_uri||x.track_uri||null;
    if(!played||!artist||!track)return null;
    const dt=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(played)?new Date(played.replace(' ','T')+'Z'):new Date(played);
    if(Number.isNaN(dt.getTime()))return null;
    return {user_id:user.id,provider:'spotify',played_at:dt.toISOString(),track_name:track,artist_name:artist,album_name:album,track_uri:uri,ms_played:ms,source_file:file.name};
  }).filter(Boolean);
  if(!normalized.length){statusEl.textContent='No recognizable Spotify listening rows were found.';return}
  statusEl.textContent='Importing '+normalized.length.toLocaleString()+' plays…';
  for(let i=0;i<normalized.length;i+=500){
    const {error}=await sb.from('user_listening_events').upsert(normalized.slice(i,i+500),{onConflict:'user_id,provider,played_at,track_uri,track_name,artist_name,ms_played',ignoreDuplicates:true});
    if(error){statusEl.textContent=error.message;return}
  }
  const weeks=new Map();
  for(const e of normalized){const w=dcSaturdayFor(e.played_at);(weeks.get(w)??weeks.set(w,[]).get(w)).push(e)}
  const dates=[...weeks.keys()].sort();
  const hist={songs:new Map(),albums:new Map(),artists:new Map()};
  for(const date of dates){
    const charts=dcPersonalChartWeek(weeks.get(date));
    for(const type of ['songs','albums','artists']){
      const output=[];
      for(const x of charts[type]){
        const h=hist[type].get(x.entity_key)||{peak:999,weeks:0,weeksAt1:0,lastRank:null};
        h.weeks++;h.peak=Math.min(h.peak,x.rank);if(x.rank===1)h.weeksAt1++;
        const movement=h.lastRank==null?'NEW':h.lastRank===x.rank?'0':h.lastRank>x.rank?'▲'+(h.lastRank-x.rank):'▼'+(x.rank-h.lastRank);
        h.lastRank=x.rank;hist[type].set(x.entity_key,h);
        output.push({user_id:user.id,chart_type:type,chart_date:date,rank:x.rank,entity_key:x.entity_key,entity_name:x.entity_name,artist_name:x.artist_name,score:x.score,streams:x.streams,listening_ms:x.listening_ms,active_days:x.active_days,peak:h.peak,weeks:h.weeks,weeks_at_no1:h.weeksAt1,movement});
      }
      if(output.length){
        const {error}=await sb.from('personal_chart_entries').upsert(output,{onConflict:'user_id,chart_type,chart_date,entity_key'});
        if(error){statusEl.textContent=error.message;return}
      }
    }
  }
  statusEl.textContent='Imported '+normalized.length.toLocaleString()+' plays and generated '+dates.length+' weekly chart'+(dates.length===1?'':'s')+'.';
  setTimeout(()=>renderMyCharts(),900);
}
async function renderMyCharts(){
  loading('My Charts');
  if(!_dcAuthUser){
    const main='<main class="my-daegon"><header class="mag-index-head"><div class="mag-kicker">Personal Charts</div><h1>My Charts</h1><p>Turn your own listening history into a Daegon-style chart archive.</p></header><div class="my-empty"><h2>Sign in to build your charts</h2><button data-my-signin>Sign in</button></div></main>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('My Charts','Personal music charts generated from your listening history.','/my-charts');portalEl.querySelector('[data-my-signin]').onclick=dcShowAuthModal;return;
  }
  const sb=dcSupabaseClient();
  const {data:dates}=await sb.from('personal_chart_entries').select('chart_date').eq('user_id',_dcAuthUser.id).eq('chart_type','songs').order('chart_date',{ascending:false}).limit(250);
  const unique=[...new Set((dates||[]).map(x=>x.chart_date))];
  const selected=new URLSearchParams(location.search).get('date')||unique[0]||'';
  const [{data:songs},{data:albums},{data:artists}]=selected?await Promise.all([
    sb.from('personal_chart_entries').select('*').eq('user_id',_dcAuthUser.id).eq('chart_type','songs').eq('chart_date',selected).order('rank').limit(100),
    sb.from('personal_chart_entries').select('*').eq('user_id',_dcAuthUser.id).eq('chart_type','albums').eq('chart_date',selected).order('rank').limit(50),
    sb.from('personal_chart_entries').select('*').eq('user_id',_dcAuthUser.id).eq('chart_type','artists').eq('chart_date',selected).order('rank').limit(50)
  ]):[{data:[]},{data:[]},{data:[]}];
  const top=(rows,label)=>'<section class="myp-chart-section"><div class="mag-section-head"><h2>'+label+'</h2><span>'+rows.length+' entries</span></div><div class="myp-chart-list">'+rows.slice(0,10).map(x=>'<div><b>'+x.rank+'</b><span><strong>'+esc(x.entity_name)+'</strong><small>'+esc(x.artist_name||'')+'</small></span><em>'+esc(x.movement||'')+'</em><i>'+x.streams+' streams · '+Math.round(Number(x.listening_ms||0)/60000)+' min</i></div>').join('')+'</div></section>';
  const main='<main class="my-daegon"><header class="mag-index-head"><div class="mag-kicker">Your listening, charted</div><h1>My Charts</h1><p>Weekly personal rankings generated from your own listening history.</p></header>'+
    '<section class="myp-import"><div><h2>Import Spotify history</h2><p>Upload a Spotify Extended Streaming History JSON file. Plays under 30 seconds are excluded. Your file is processed into your private account data.</p></div><label>Choose JSON<input id="mypHistoryFile" type="file" accept=".json,application/json"></label><div id="mypImportStatus"></div></section>'+
    (unique.length?'<div class="myp-datebar"><label>Chart week</label><select id="mypDateSelect">'+unique.map(d=>'<option value="'+d+'" '+(d===selected?'selected':'')+'>'+fmtDate(d)+'</option>').join('')+'</select></div>':'<div class="my-empty-inline">Import listening history to generate your first personal chart.</div>')+
    (selected?top(songs||[],'My Songs 100')+top(albums||[],'My Albums 50')+top(artists||[],'My Artists 50'):'')+
    '<section class="myp-method"><h2>Personal Daegon Score</h2><p>The first version combines valid streams, listening minutes and active listening days. It rewards repeated listening without letting a single binge session dominate the entire week.</p><code>score = streams × 100 + listening minutes × 1.5 + active days × 18</code></section>'+
  '</main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('My Charts','Personal Daegon music charts generated from your listening history.','/my-charts');bindLinks();
  const file=portalEl.querySelector('#mypHistoryFile'),st=portalEl.querySelector('#mypImportStatus');
  if(file)file.onchange=()=>{const f=file.files?.[0];if(f)dcImportSpotifyHistory(f,st)};
  const sel=portalEl.querySelector('#mypDateSelect');if(sel)sel.onchange=()=>{const u=new URL(location.href);u.searchParams.set('date',sel.value);history.replaceState({},'',u.pathname+u.search);renderMyCharts()};
}
async function renderForum(){
  loading('Forum');
  const sb=dcSupabaseClient();
  const {data:topics}=await sb.from('forum_topics').select('id,user_id,category,title,body,status,created_at').order('created_at',{ascending:false}).limit(50);
  const ids=[...new Set((topics||[]).map(x=>x.user_id))];let profiles=[];
  if(ids.length){const p=await sb.from('community_profiles').select('user_id,display_name').in('user_id',ids);profiles=p.data||[]}
  const pm=new Map(profiles.map(x=>[x.user_id,x]));
  const rows=(topics||[]).map(t=>'<a class="forum-topic '+(t.status==='pending'?'pending':'')+'" href="'+appHref('/forum/'+t.id)+'" data-portal-link="/forum/'+t.id+'"><div class="forum-cat">'+esc(t.category)+'</div><h2>'+esc(t.title)+'</h2><p>'+esc(t.body.slice(0,220))+(t.body.length>220?'…':'')+'</p><div>By '+esc(pm.get(t.user_id)?.display_name||'Daegon reader')+' · '+new Date(t.created_at).toLocaleDateString('en-US')+(t.status==='pending'?' · Awaiting moderation':'')+'</div></a>').join('');
  const compose=_dcAuthUser?'<form id="forumTopicForm" class="forum-compose"><div class="mag-kicker">Start a discussion</div><select id="forumCategory"><option value="general">General</option><option value="charts">Charts</option><option value="reviews">Reviews</option><option value="industry">Industry</option><option value="artists">Artists</option><option value="off-topic">Off-topic</option></select><input id="forumTitle" maxlength="140" required placeholder="Topic title"><textarea id="forumBody" maxlength="6000" required placeholder="What do you want to discuss?"></textarea><button type="submit">Submit for moderation</button><div id="forumStatus"></div></form>':'<div class="dc-comment-signin"><p>Sign in to start a topic.</p><button data-forum-signin>Sign in</button></div>';
  const main='<main class="forum-page"><header class="mag-index-head"><div class="mag-kicker">Daegon Community</div><h1>Forum</h1><p>Charts, pop history, reviews, industry news and music arguments — with accounts and moderation from day one.</p></header>'+compose+'<section class="forum-list">'+(rows||'<div class="my-empty-inline">No approved topics yet.</div>')+'</section></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Forum','Daegon community forum for charts, reviews, artists and music-industry discussion.','/forum');bindLinks();
  portalEl.querySelector('[data-forum-signin]')?.addEventListener('click',dcShowAuthModal);
  const form=portalEl.querySelector('#forumTopicForm');
  if(form)form.onsubmit=async e=>{
    e.preventDefault();const status=portalEl.querySelector('#forumStatus');status.textContent='Submitting…';
    await dcEnsureProfile(_dcAuthUser);
    const {error}=await sb.from('forum_topics').insert({user_id:_dcAuthUser.id,category:portalEl.querySelector('#forumCategory').value,title:portalEl.querySelector('#forumTitle').value.trim(),body:portalEl.querySelector('#forumBody').value.trim(),status:'pending'});
    if(error){status.textContent=error.message;return}status.textContent='Submitted for moderation.';form.reset();setTimeout(renderForum,700);
  };
}

async function renderForumTopic(id){
  loading('Forum');
  const sb=dcSupabaseClient();
  const {data:topic,error}=await sb.from('forum_topics').select('id,user_id,category,title,body,status,created_at').eq('id',Number(id)).maybeSingle();
  if(error||!topic){renderNotFound();return}
  const {data:posts}=await sb.from('forum_posts').select('id,user_id,parent_id,body,status,created_at').eq('topic_id',Number(id)).order('created_at',{ascending:true});
  const ids=[...new Set([topic.user_id,...(posts||[]).map(x=>x.user_id)])];let profiles=[];
  if(ids.length){const p=await sb.from('community_profiles').select('user_id,display_name').in('user_id',ids);profiles=p.data||[]}
  const pm=new Map(profiles.map(x=>[x.user_id,x]));
  const visible=(posts||[]).filter(x=>x.status==='approved'||(_dcAuthUser&&x.user_id===_dcAuthUser.id));
  const reply=_dcAuthUser&&topic.status!=='locked'
    ? '<form id="forumReplyForm" class="forum-compose reply"><textarea id="forumReplyBody" maxlength="4000" required placeholder="Write a reply…"></textarea><button type="submit">Reply</button><div id="forumReplyStatus"></div></form>'
    : topic.status==='locked'?'<div class="my-empty-inline">This topic is locked.</div>':'<div class="dc-comment-signin"><p>Sign in to reply.</p><button data-forum-signin>Sign in</button></div>';
  const rows=visible.length?visible.map(x=>'<article class="forum-post '+(x.status==='pending'?'pending':'')+'"><div class="forum-post-head"><strong>'+esc(pm.get(x.user_id)?.display_name||'Daegon reader')+'</strong><span>'+new Date(x.created_at).toLocaleDateString('en-US')+(x.status==='pending'?' · Awaiting moderation':'')+'</span></div><p>'+esc(x.body)+'</p></article>').join(''):'<div class="my-empty-inline">No approved replies yet.</div>';
  const main='<main class="forum-page"><a class="cb-back" href="'+appHref('/forum')+'" data-portal-link="/forum">← Forum</a><article class="forum-topic-detail"><div class="forum-cat">'+esc(topic.category)+'</div><h1>'+esc(topic.title)+'</h1><div class="forum-topic-meta">By '+esc(pm.get(topic.user_id)?.display_name||'Daegon reader')+' · '+new Date(topic.created_at).toLocaleDateString('en-US')+(topic.status==='pending'?' · Awaiting moderation':'')+'</div><p>'+esc(topic.body)+'</p></article><section class="forum-replies"><div class="mag-section-head"><h2>Replies</h2><span>'+visible.length+'</span></div>'+reply+'<div class="forum-post-list">'+rows+'</div></section></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(topic.title,'Daegon forum discussion: '+topic.title,'/forum/'+id);bindLinks();
  portalEl.querySelector('[data-forum-signin]')?.addEventListener('click',dcShowAuthModal);
  const form=portalEl.querySelector('#forumReplyForm');
  if(form)form.onsubmit=async e=>{
    e.preventDefault();const st=portalEl.querySelector('#forumReplyStatus');st.textContent='Submitting…';
    await dcEnsureProfile(_dcAuthUser);
    const {error:ins}=await sb.from('forum_posts').insert({topic_id:Number(id),user_id:_dcAuthUser.id,body:portalEl.querySelector('#forumReplyBody').value.trim(),status:'pending'});
    if(ins){st.textContent=ins.message;return}
    st.textContent='Submitted for moderation.';form.reset();setTimeout(()=>renderForumTopic(id),700);
  };
}

function renderPlans(){
  const plan=(name,price,tag,features,featured=false)=>'<article class="plan-card '+(featured?'featured':'')+'"><div class="mag-kicker">'+tag+'</div><h2>'+name+'</h2><div class="plan-price">'+price+'</div><ul>'+features.map(x=>'<li>'+x+'</li>').join('')+'</ul><button data-plan="'+name.toLowerCase()+'" '+(name==='Free'?'disabled':'')+'>'+(name==='Free'?'Included':'Choose '+name)+'</button></article>';
  const main='<main class="plans-page"><header class="mag-index-head"><div class="mag-kicker">Membership</div><h1>Choose your Daegon</h1><p>Core charts and journalism stay open. Paid plans are designed around personalization, deeper history and community tools.</p></header><div class="plan-grid">'+
    plan('Free','R$ 0','Start here',['Daegon charts and editorial portal','My Daegon follows and favorites','Forum participation','Basic My Charts import'])+
    plan('Fan','Coming soon','For chart lovers',['Everything in Free','Full personal chart archive','Year-End personal charts','Expanded listening stats','Custom public profile'],true)+
    plan('Insider','Coming soon','Power user',['Everything in Fan','Personal GOAT and decade-end charts','Advanced export and comparisons','Early access to new Daegon labs','Insider community badge'])+
    '</div><div class="plan-note"><strong>Billing is not active yet.</strong><p>The membership model is ready in Daegon, but checkout will only be enabled after the payment provider is connected and prices are finalized.</p></div></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Plans','Daegon Free, Fan and Insider membership plans.','/plans');bindLinks();
}
async function renderMyDaegon(){
  loading('My Daegon');
  if(!_dcAuthUser){
    const main='<main class="my-daegon"><header class="mag-index-head"><div class="mag-kicker">Personalize Daegon</div><h1>My Daegon</h1><p>Follow artists, save stories and build a personal music feed.</p></header><div class="my-empty"><h2>Sign in to start</h2><p>Your follows and favorites stay connected to your account.</p><button data-my-signin>Sign in</button></div></main>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('My Daegon','Your personalized Daegon music feed.','/my-daegon');bindLinks();
    portalEl.querySelector('[data-my-signin]').onclick=dcShowAuthModal;return;
  }
  const sb=dcSupabaseClient();
  await loadPublishedChartBeatArticles();
  const [{data:follows},{data:favorites},{data:saved},{data:prefs}]=await Promise.all([
    sb.from('user_artist_follows').select('*').eq('user_id',_dcAuthUser.id).order('created_at',{ascending:false}),
    sb.from('user_favorites').select('*').eq('user_id',_dcAuthUser.id).order('created_at',{ascending:false}),
    sb.from('user_saved_articles').select('article_id,created_at').eq('user_id',_dcAuthUser.id).order('created_at',{ascending:false}),
    sb.from('user_notification_preferences').select('*').eq('user_id',_dcAuthUser.id).maybeSingle()
  ]);
  const pref=prefs||{new_number_ones:true,followed_artist_news:true,followed_artist_reviews:true,chart_milestones:true,email_enabled:false};
  const followNames=(follows||[]).map(x=>x.artist_name);
  const savedIds=new Set((saved||[]).map(x=>Number(x.article_id)));
  const savedArticles=CHART_BEAT_ARTICLES.filter(a=>savedIds.has(Number(a.cmsId)));
  const personalStories=CHART_BEAT_ARTICLES.filter(a=>{
    const hay=(a.headline+' '+(a.dek||'')+' '+(a.body||'')).toLowerCase();
    return followNames.some(n=>hay.includes(String(n).toLowerCase()));
  }).slice(0,10);

  let chartAlerts=[];
  if(followNames.length){
    const songs=await loadWeekly('songs').catch(()=>null);
    const latestDate=songs?.dates?.[songs.dates.length-1];
    const latest=songs?.entriesByDate?.[latestDate]||[];
    chartAlerts=latest.filter(e=>followNames.some(n=>creditNorm(n)===creditNorm(e.artist))).slice(0,8).map(e=>({date:latestDate,e}));
  }
  const articleCard=a=>'<a class="my-story" href="'+appHref('/chart-beat/'+a.slug)+'" data-portal-link="/chart-beat/'+a.slug+'"><div class="mag-kicker">'+esc(a.category)+'</div><strong>'+esc(a.headline)+'</strong><span>'+esc(a.dek||'')+'</span></a>';
  const main='<main class="my-daegon"><header class="mag-index-head"><div class="mag-kicker">Personalized</div><h1>My Daegon</h1><p>'+esc(_dcAuthUser.email||'')+'</p></header>'+
    '<div class="my-quick-links"><a href="'+appHref('/my-charts')+'" data-portal-link="/my-charts"><strong>My Charts</strong><span>Turn your listening into weekly charts →</span></a><a href="'+appHref('/forum')+'" data-portal-link="/forum"><strong>Forum</strong><span>Join the discussion →</span></a><a href="'+appHref('/plans')+'" data-portal-link="/plans"><strong>Plans</strong><span>Compare membership tiers →</span></a></div>'+
    '<section class="my-dashboard-grid">'+
      '<div class="my-panel"><div class="my-panel-head"><h2>Following</h2><span>'+(follows||[]).length+'</span></div><div class="my-chip-list">'+((follows||[]).length?(follows||[]).map(x=>'<a href="'+appHref('/artist/'+x.artist_key)+'" data-portal-link="/artist/'+x.artist_key+'">'+esc(x.artist_name)+'</a>').join(''):'<p>Follow artists from their profile pages.</p>')+'</div></div>'+
      '<div class="my-panel"><div class="my-panel-head"><h2>Favorites</h2><span>'+(favorites||[]).length+'</span></div><div class="my-fav-list">'+((favorites||[]).length?(favorites||[]).slice(0,8).map(x=>'<div><strong>'+esc(x.entity_name)+'</strong><span>'+esc(x.artist_name||x.entity_type)+'</span></div>').join(''):'<p>Favorite songs and albums from their chart-history pages.</p>')+'</div></div>'+
    '</section>'+
    '<section class="my-section"><div class="mag-section-head"><h2>Your Feed</h2><span>Based on artists you follow</span></div><div class="my-story-grid">'+(personalStories.length?personalStories.map(articleCard).join(''):'<div class="my-empty-inline">Follow artists to build your editorial feed.</div>')+'</div></section>'+
    '<section class="my-section"><div class="mag-section-head"><h2>Chart Alerts</h2><span>Latest tracked week</span></div><div class="my-alert-list">'+(chartAlerts.length?chartAlerts.map(x=>'<a href="'+appHref(chartPath('songs',x.date))+'"><strong>'+esc(portalText(x.e.name))+'</strong><span>'+esc(portalArtist(x.e.artist))+' · No. '+x.e.position+(x.e.diff==='NEW'?' · NEW':String(x.e.diff).startsWith('▲')?' · '+esc(x.e.diff):'')+'</span></a>').join(''):'<div class="my-empty-inline">No followed artists appear in the latest Daegon 100.</div>')+'</div></section>'+
    '<section class="my-section"><div class="mag-section-head"><h2>Saved Stories</h2><span>'+savedArticles.length+'</span></div><div class="my-story-grid">'+(savedArticles.length?savedArticles.map(articleCard).join(''):'<div class="my-empty-inline">Use Save on any article to keep it here.</div>')+'</div></section>'+
    '<section class="my-section my-prefs"><div class="mag-section-head"><h2>Alerts</h2><span>In-site preferences</span></div>'+
      [['new_number_ones','New No. 1s'],['followed_artist_news','News about followed artists'],['followed_artist_reviews','Reviews about followed artists'],['chart_milestones','Chart milestones']].map(([k,l])=>'<label><input type="checkbox" data-pref="'+k+'" '+(pref[k]?'checked':'')+'><span>'+l+'</span></label>').join('')+
      '<div class="my-email-note"><strong>Email delivery</strong><span>Preferences are ready, but external email alerts are not enabled yet. Your personalized alerts already appear inside My Daegon.</span></div>'+
    '</section>'+
  '</main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('My Daegon','Followed artists, favorites, saved stories and personalized chart alerts.','/my-daegon');bindLinks();
  portalEl.querySelectorAll('[data-pref]').forEach(input=>input.onchange=async()=>{
    const payload={user_id:_dcAuthUser.id,new_number_ones:!!portalEl.querySelector('[data-pref="new_number_ones"]')?.checked,followed_artist_news:!!portalEl.querySelector('[data-pref="followed_artist_news"]')?.checked,followed_artist_reviews:!!portalEl.querySelector('[data-pref="followed_artist_reviews"]')?.checked,chart_milestones:!!portalEl.querySelector('[data-pref="chart_milestones"]')?.checked,email_enabled:false,updated_at:new Date().toISOString()};
    await sb.from('user_notification_preferences').upsert(payload,{onConflict:'user_id'});
  });
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
      ['NEWS','/news'],['TRENDING','/trending'],['CHART BEAT','/chart-beat'],['FEATURES','/features'],['REVIEWS','/reviews'],
      ['CHARTS','/chart/daegon-100'],['FORUM','/forum'],['PLANS','/plans'],['ABOUT','/about']
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
      ['NEWS','/news'],['TRENDING','/trending'],['CHART BEAT','/chart-beat'],['FEATURES','/features'],['REVIEWS','/reviews'],
      ['CHARTS','/chart/daegon-100'],['FORUM','/forum'],['PLANS','/plans'],['ABOUT','/about']
    ].map(([l,p])=>'<a href="'+appHref(p)+'" data-portal-link="'+p+'">'+l+'</a>').join('');
    mobileBtn.setAttribute('aria-expanded','false');
    mobileMenu.setAttribute('aria-hidden','true');
    mobileMenu.style.display='none';
    mobileBtn.onclick=()=>{
      const willOpen=!mobileMenu.classList.contains('open');
      if(willOpen){
        mobileMenu.style.display='';
        mobileMenu.setAttribute('aria-hidden','false');
        mobileMenu.classList.add('open');
      }else{
        closePortalMenu();
      }
      mobileBtn.setAttribute('aria-expanded',willOpen?'true':'false');
    };
    mobileMenu.addEventListener('click',e=>{
      const link=e.target.closest('a[data-portal-link]');
      if(!link)return;
      e.preventDefault();
      e.stopPropagation();
      closePortalMenu();
      go(link.dataset.portalLink);
    });
    head.insertBefore(mobileBtn,theme);
    const searchBtn=document.createElement('button');
    searchBtn.id='portalSearchBtn';
    searchBtn.className='portal-search-btn';
    searchBtn.setAttribute('aria-label','Search');
    searchBtn.innerHTML='<i class="fas fa-search"></i>';
    searchBtn.onclick=()=>go('/search');
    head.insertBefore(searchBtn,theme);
    const accountBtn=document.createElement('button');
    accountBtn.id='portalAccountBtn';
    accountBtn.className='portal-account-btn';
    accountBtn.type='button';
    accountBtn.onclick=()=>_dcAuthUser?go('/my-daegon'):dcShowAuthModal();
    head.insertBefore(accountBtn,theme);
    dcSyncAccountButton();
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
    weeklyEl.classList.add('route-hidden');
    weeklyEl.setAttribute('hidden','');
    weeklyEl.style.setProperty('display','none','important');
    portalEl.classList.add('active');
    portalEl.removeAttribute('hidden');
  }else{
    weeklyEl.classList.remove('route-hidden');
    weeklyEl.removeAttribute('hidden');
    weeklyEl.style.removeProperty('display');
    portalEl.classList.remove('active');
    portalEl.setAttribute('hidden','');
  }
}
function portalSkeleton(title='Loading',kind=''){
  const isArtist=kind==='artist'||/artist/i.test(title);
  const cards=Array.from({length:7},(_,i)=>'<div class="portal-sk-card">'+
    '<div class="portal-sk-rank sk"></div>'+
    '<div class="portal-sk-art sk '+(isArtist?'circle':'')+'"></div>'+
    '<div class="portal-sk-copy"><div class="portal-sk-title sk"></div><div class="portal-sk-sub sk"></div></div>'+
    '<div class="portal-sk-action sk"></div>'+
  '</div>').join('');
  return '<div class="portal-skeleton-wrap" aria-hidden="true">'+
    '<div class="portal-sk-heading sk"></div>'+
    '<div class="portal-sk-control sk"></div>'+
    '<div class="portal-sk-list">'+cards+'</div>'+
  '</div>';
}
function loading(title='Loading',kind=''){
  setMode(true);
  portalEl.innerHTML=portalSkeleton(title,kind);
}
function routeSkeletonMeta(parts){
  const p=parts||[];
  const first=p[0]||'';
  const second=p[1]||'';
  let kind='';
  if(first==='artist'||first==='artists')kind='artist';
  else if(first==='album'||first==='albums')kind='album';
  else if(first==='song'||first==='songs')kind='song';
  else if(first==='decade-end'){
    if(second==='artists')kind='artist';
    else if(second==='albums')kind='album';
    else if(second==='songs')kind='song';
  }else if(first==='goat'){
    if(/artist/i.test(second))kind='artist';
    else if(/album/i.test(second))kind='album';
    else if(second)kind='song';
  }else if(first==='year-end'){
    if(/artist/i.test(second))kind='artist';
    else if(/album/i.test(second))kind='album';
    else if(second)kind='song';
  }
  const title=
    first==='decade-end'?'Decade-End Charts':
    first==='year-end'?'Year-End Charts':
    first==='goat'?'Greatest of All Time':
    first==='artist'||first==='artists'?'Artists':
    first==='album'||first==='albums'?'Albums':
    first==='song'||first==='songs'?'Songs':
    first==='number-ones'?'Number Ones':
    first==='chart-beat'?'Chart Beat':
    first==='news'?'Music News':
    first==='trending'?'Trending':
    first==='features'?'Features':
    first==='reviews'?'Reviews':
    first==='community'?'Community':
    first==='forum'?'Forum':
    first==='plans'?'Plans':
    first==='my-daegon'?'My Daegon':
    first==='my-charts'?'My Charts':
    first==='ai'?'AI at Daegon':
    first==='stats'?'Stats':
    first==='search'?'Search':
    first==='chart-battle'?'Chart Battle':
    first==='awards'?'Awards':
    'Daegon Charts';
  return {title,kind};
}
function setMeta(title,desc,path,exactTitle=false){
  document.title=exactTitle?title:title+' | Daegon Charts';
  const d=document.querySelector('meta[name="description"]');if(d)d.content=desc;
  let robots=document.querySelector('meta[name="robots"]');
  if(!robots){robots=document.createElement('meta');robots.name='robots';document.head.appendChild(robots)}
  const noindexPaths=new Set(['/search','/chart-battle','/awards','/my-daegon','/my-charts']);
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
      '<a href="'+appHref('/year-end/songs')+'" data-portal-link="/year-end/songs">Daegon 100</a><a href="'+appHref('/year-end/artists')+'" data-portal-link="/year-end/artists">Artist 50</a><a href="'+appHref('/year-end/albums')+'" data-portal-link="/year-end/albums">Top 100 Albums</a>'+
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
      results.innerHTML=items.map(x=>'<a href="'+appHref(entityPath(x,'artist'))+'" data-portal-link="'+entityPath(x,'artist')+'">'+esc(portalText(x.name))+'</a>').join('');
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
function portalText(value){return typeof smartDisplayCase==='function'?smartDisplayCase(value):String(value??'')}
function portalArtist(value){return typeof displayArtist==='function'?displayArtist(value):portalText(value)}
const appleArtistCreditCatalogCache=new Map();
function creditNorm(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function creditBaseTitle(v){
  return typeof artworkSearchTitle==='function'?artworkSearchTitle('song',v):String(v||'')
    .replace(/\s*[\(\[]\s*(?:with|feat\.?|ft\.?|featuring)\b[^\)\]]*[\)\]]/gi,'')
    .replace(/\s+/g,' ').trim();
}
async function loadAppleArtistCreditCatalog(artist){
  const key=creditNorm(artist);
  if(appleArtistCreditCatalogCache.has(key))return appleArtistCreditCatalogCache.get(key);
  const job=(async()=>{
    try{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),16000);
      const r=await fetch(SUPABASE_URL+'/functions/v1/apple-song-credits',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':SUPABASE_ANON_JWT,
          'Authorization':'Bearer '+SUPABASE_ANON_JWT
        },
        body:JSON.stringify({mode:'artist',artist}),
        signal:ctrl.signal
      });
      clearTimeout(timer);
      if(!r.ok)return [];
      const d=await r.json();
      return Array.isArray(d?.items)?d.items:[];
    }catch{return []}
  })();
  appleArtistCreditCatalogCache.set(key,job);
  return job;
}
function appleCreditDateOkay(releaseDate,chartDate){
  if(!releaseDate||!chartDate)return true;
  const r=new Date(releaseDate).getTime(),c=new Date(chartDate+'T00:00:00Z').getTime();
  if(!Number.isFinite(r)||!Number.isFinite(c))return true;
  return r<=c+370*86400000;
}
function appleCreditForEntry(entry,targetArtist,catalog,chartDate=''){
  const target=creditNorm(targetArtist),title=creditNorm(creditBaseTitle(entry?.name||'')),primary=creditNorm(entry?.artist||'');
  if(!title||!target)return null;
  const matches=(catalog||[]).filter(x=>{
    const xt=creditNorm(creditBaseTitle(x.title||x.appleTrackName||''));
    if(xt!==title)return false;
    if(!appleCreditDateOkay(x.releaseDate,chartDate))return false;
    const xp=creditNorm(x.primaryArtist||'');
    const collabs=(x.collaborators||[]).map(creditNorm);
    const targetParticipates=xp===target||collabs.includes(target);
    if(!targetParticipates)return false;
    return !xp||xp===primary;
  });
  return matches[0]||null;
}
function appleCreditText(primary,credit){
  const collabs=Array.isArray(credit?.collaborators)?credit.collaborators.filter(Boolean):[];
  if(!collabs.length)return portalArtist(primary);
  return portalArtist(primary)+(String(credit?.joiner||' feat. ').trim()==='&'?' & ':' feat. ')+collabs.map(portalArtist).join(String(credit?.joiner||'').trim()==='&'?' & ':', ');
}
function portalEntityName(e,kind,text){
  const value=text??e.name;
  return kind==='artist'?portalArtist(value):(typeof displayTitle==='function'?displayTitle(value):portalText(value));
}
function entityLink(e,kind,text){
  const p=entityPath(e,kind);
  return '<a class="portal-link" href="'+appHref(p)+'" data-portal-link="'+p+'">'+esc(portalEntityName(e,kind,text))+'</a>';
}
function artistLink(name,text){
  const artist=String(name||'').trim();
  if(!artist)return '';
  const p='/artist/'+slugify(artist);
  return '<a class="portal-link portal-artist-link" href="'+appHref(p)+'" data-portal-link="'+p+'">'+esc(text??portalArtist(artist))+'</a>';
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
function aggregateDecadePeriod(data,chartId,predicate){
  const kind=charts[chartId].kind;
  const metricField=chartId==='songs'?'points':'units';
  const m=new Map();
  for(const d of data.dates){
    if(!predicate(d))continue;
    for(const e of data.entriesByDate[d]||[]){
      const key=kind==='artist'?String(e.name).toLowerCase():itemKey(e);
      let x=m.get(key);
      if(!x){
        x={name:e.name,artist:e.artist,score:0,totalMetric:0,weeks:0,peak:e.position,weeksAt1:0,lastEntry:e,metricField};
        m.set(key,x);
      }
      const value=metricNumber(e[metricField]??0);
      x.score+=value;
      x.totalMetric+=value;
      x.weeks++;
      x.peak=Math.min(x.peak,e.position);
      if(e.position===1)x.weeksAt1++;
      x.lastEntry=e;
    }
  }
  return [...m.values()].sort((a,b)=>b.totalMetric-a.totalMetric||b.weeks-a.weeks||a.peak-b.peak);
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
      'This directory collects albums that have charted in Top 100 Albums. Each album page links its historical performance back to the weekly archive, including peak, weeks charted and available charting tracks.',
      'Album rankings are kept separate from song performance so catalog titles are not automatically boosted simply because an artist has a successful single. The project methodology explains how album performance and historical continuity are handled.'
    ],
    [['/methodology','Read the album methodology'],['/chart/daegon-albums-100','Open the current albums chart']]
  );
  return editorialBlock(
    'Explore artists across the Daegon archive',
    [
      'The artist directory indexes performers who have appeared in Artist 50. Artist pages consolidate weekly chart history and connect an artist to charting songs and albums, making the directory a navigation layer for the wider archive.',
      'Artist credits are normalized so the archive follows the project’s main-artist rules and avoids splitting the same performer across aliases, capitalization differences or secondary featuring credits.'
    ],
    [['/methodology','Read the crediting methodology'],['/chart/daegon-artists-50','Open the current artists chart']]
  );
}



function renderDaegonAIPage(){
  const main='<main class="mag-static"><header class="mag-index-head"><div class="mag-kicker">Transparency</div><h1>AI at Daegon</h1><p>How artificial intelligence supports research, analysis and publishing — and where human editorial judgment remains essential.</p></header>'+
  '<section class="mag-static-grid">'+
    '<article><h2>What AI does</h2><p>Daegon uses AI to help inspect chart history, detect unusual movements, surface possible records, organize source material, summarize long timelines and prepare editorial drafts. It also helps connect historical chart data with contemporary reporting.</p></article>'+
    '<article><h2>What AI does not decide alone</h2><p>AI output is not treated as a source. Claims about records, dates, quotations, releases, industry events and causation require verification against the Daegon archive or external sources before publication.</p></article>'+
    '<article><h2>Historical reconstruction</h2><p>Historical Daegon charts are reconstructed editorial datasets. AI can assist with reconciliation and anomaly detection, but the project distinguishes reconstructed chart history from externally reported historical facts.</p></article>'+
    '<article><h2>News and trending topics</h2><p>Social-media conversation can trigger a story, but virality is not evidence. Daegon seeks a primary source or reliable reporting before presenting a claim as fact and separates public reaction from verified information.</p></article>'+
    '<article><h2>Corrections</h2><p>Because both data work and AI-assisted research can contain errors, Daegon treats corrections as part of the editorial process. Material factual changes should be reflected in the article and its updated date.</p></article>'+
    '<article><h2>Why use AI?</h2><p>The goal is not to publish more words. It is to make a large music archive useful: identify patterns humans might miss, revisit thousands of chart weeks and build richer context around music history.</p></article>'+
  '</section></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('AI at Daegon','How Daegon Charts uses AI for music research, chart analysis and editorial production.','/ai');bindLinks();
}
function renderCommunity(){
  const main='<main class="mag-community"><header class="mag-index-head"><div class="mag-kicker">Daegon Community</div><h1>Music is better when people argue about it.</h1><p>A future home for chart debates, reviews, reactions and music discussion. Accounts and moderated comments are being built before public posting opens.</p></header>'+
  '<section class="mag-community-grid"><article><div class="mag-kicker">Coming first</div><h2>Article discussions</h2><p>Logged-in readers will be able to discuss Chart Beat, reviews and news beneath each story.</p></article>'+
  '<article><div class="mag-kicker">Community standards</div><h2>Discussion without chaos</h2><p>Comments will launch with accounts, reporting tools and moderation. Anonymous posting will not be enabled.</p></article>'+
  '<article><div class="mag-kicker">Next</div><h2>Profiles & favorites</h2><p>Accounts can later support followed artists, saved charts, favorite songs and personalized alerts.</p></article></section></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Daegon Community','Community discussions, music reactions and future member features at Daegon Charts.','/community');bindLinks();
}
async function renderTrending(){
  loading('Trending');await loadPublishedChartBeatArticles();
  const items=CHART_BEAT_ARTICLES.filter(a=>a.category==='Industry Watch'||a.category==='News'||a.category==='Chart Beat').slice(0,18);
  const main='<main class="mag-index"><header class="mag-index-head"><div class="mag-kicker">The Conversation</div><h1>Trending</h1><p>What music fans and the industry are talking about — verified, contextualized and connected to the charts when the data adds something useful.</p></header>'+
    '<div class="mag-index-grid">'+items.map((a,i)=>'<article class="mag-index-card '+(i===0?'lead':'')+'"><a href="'+appHref('/chart-beat/'+a.slug)+'" data-portal-link="/chart-beat/'+a.slug+'">'+
      '<div class="mag-index-art">'+(a.photo?.url?'<img src="'+escAttr(a.photo.url)+'" alt="'+escAttr(a.photo.alt||a.headline)+'">':'<div class="cb-media-box" data-portal-image data-kind="'+escAttr(a?.media?.primary?.kind||'artist')+'" data-name="'+escAttr(a?.media?.primary?.name||a.headline)+'" data-artist="'+escAttr(a?.media?.primary?.artist||'')+'"></div>')+'</div>'+
      '<div class="mag-index-copy"><div class="mag-kicker">'+esc(a.category)+'</div><h2>'+esc(a.headline)+'</h2><p>'+esc(a.dek||'')+'</p><span>'+fmtDate(a.published)+'</span></div></a></article>').join('')+
    '</div></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Trending','Music hot topics, industry conversation and chart context from Daegon Charts.','/trending');bindLinks();hydratePortalImages();
}
function renderReviews(){
  const main='<main class="mag-reviews"><header class="mag-index-head"><div class="mag-kicker">Criticism</div><h1>Reviews</h1><p>Albums and songs reviewed with musical context, historical perspective and a Chart Outlook — without pretending popularity and quality are the same thing.</p></header>'+
    '<section class="review-manifesto"><h2>The Daegon review system</h2><div class="review-pillars"><div><strong>Review</strong><span>Critical assessment of the music.</span></div><div><strong>Highlights</strong><span>Standout tracks and creative choices.</span></div><div><strong>Context</strong><span>Where the release sits in the artist’s career.</span></div><div><strong>Chart Outlook</strong><span>Data-informed commercial expectations, clearly separated from the review score.</span></div></div><p>No review has been published yet. The section is live now so the first releases can enter a consistent format instead of being retrofitted later.</p></section></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Reviews','Music reviews, album criticism and chart outlooks from Daegon Charts.','/reviews');bindLinks();
}

async function renderEditorialIndex(kind){
  loading(kind==='news'?'Music News':'Features');
  await loadPublishedChartBeatArticles();
  const all=[...CHART_BEAT_ARTICLES];
  const featureCats=new Set(['Chart Analysis','Chart Rewind','Behind the Charts']);
  const items=kind==='features'?all.filter(a=>featureCats.has(a.category)):all.filter(a=>!featureCats.has(a.category));
  const list=(items.length?items:all);
  const main='<main class="mag-index"><header class="mag-index-head"><div class="mag-kicker">Daegon</div><h1>'+(kind==='news'?'Music News':'Features')+'</h1><p>'+(kind==='news'?'Chart-driven music news, weekly developments and stories from across pop culture.':'Long-form music stories, historical reporting and analysis from the Daegon archive.')+'</p></header>'+
    '<div class="mag-index-grid">'+list.map((a,i)=>'<article class="mag-index-card '+(i===0?'lead':'')+'"><a href="'+appHref('/chart-beat/'+a.slug)+'" data-portal-link="/chart-beat/'+a.slug+'">'+
      '<div class="mag-index-art">'+(a.photo?.url?'<img src="'+escAttr(a.photo.url)+'" alt="'+escAttr(a.photo.alt||a.headline)+'">':'<div class="cb-media-box" data-portal-image data-kind="'+escAttr(a?.media?.primary?.kind||'artist')+'" data-name="'+escAttr(a?.media?.primary?.name||a.headline)+'" data-artist="'+escAttr(a?.media?.primary?.artist||'')+'"></div>')+'</div>'+
      '<div class="mag-index-copy"><div class="mag-kicker">'+esc(a.category)+'</div><h2>'+esc(a.headline)+'</h2><p>'+esc(a.dek||'')+'</p><span>'+fmtDate(a.published)+'</span></div></a></article>').join('')+
    '</div></main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(kind==='news'?'Music News':'Features',kind==='news'?'Music news and chart-driven reporting from Daegon Charts.':'Long-form music features and historical analysis from Daegon Charts.','/'+kind);bindLinks();hydratePortalImages();
}

async function renderHome(){
  loading('Home');
  await loadPublishedChartBeatArticles();
  const ids=['songs','albums','artists'];
  const all=await Promise.all(ids.map(async id=>{try{return await loadWeekly(id)}catch{return {chartId:id,dates:[],entriesByDate:{}}}}));
  const byId=Object.fromEntries(ids.map((id,i)=>[id,all[i]]));
  const latest=id=>{const d=byId[id],date=d.dates[d.dates.length-1]||'';return{date,entries:d.entriesByDate[date]||[]}};
  const songLatest=latest('songs'),latestDate=songLatest.date;
  const no1s=ids.map(id=>{const l=latest(id);return{id,date:l.date,e:l.entries[0]||null}});
  const stories=[...CHART_BEAT_ARTICLES];
  const lead=stories[0]||null,secondary=stories.slice(1,5),moreStories=stories.slice(5,9);

  const storyArt=(a,cls='')=>{
    if(a?.photo?.url)return '<div class="mag-story-art '+cls+'"><img src="'+escAttr(a.photo.url)+'" alt="'+escAttr(a.photo.alt||a.headline)+'" loading="eager"></div>';
    const m=a?.media?.primary;
    return '<div class="mag-story-art cb-media-box '+cls+'" data-portal-image data-kind="'+escAttr(m?.kind||'artist')+'" data-name="'+escAttr(m?.name||a?.headline||'Daegon Charts')+'" data-artist="'+escAttr(m?.artist||m?.name||'')+'"></div>';
  };
  const storyLink=a=>appHref('/chart-beat/'+a.slug);

  const hero=lead?'<section class="mag-lead"><a href="'+storyLink(lead)+'" data-portal-link="/chart-beat/'+lead.slug+'">'+
    storyArt(lead,'lead')+
    '<div class="mag-lead-copy"><div class="mag-kicker">'+esc(lead.category)+'</div><h1>'+esc(lead.headline)+'</h1><p>'+esc(lead.dek||'')+'</p><div class="mag-meta">By '+esc(lead.byline||'Daegon Charts Editorial')+' · '+fmtDate(lead.published)+'</div></div>'+
  '</a></section>':'';

  const secondaryHtml=secondary.length?'<section class="mag-latest"><div class="mag-section-head"><h2>Latest</h2><a href="'+appHref('/news')+'" data-portal-link="/news">More stories →</a></div><div class="mag-latest-grid">'+
    secondary.map(a=>'<article class="mag-story-card"><a href="'+storyLink(a)+'" data-portal-link="/chart-beat/'+a.slug+'">'+storyArt(a)+
      '<div class="mag-kicker">'+esc(a.category)+'</div><h3>'+esc(a.headline)+'</h3><p>'+esc(a.dek||'')+'</p><span class="mag-meta">'+fmtDate(a.published)+'</span></a></article>').join('')+
  '</div></section>':'';

  const weeklyStory=latestDate?'<section class="mag-weekly-promo"><div><div class="mag-kicker">Chart Beat Weekly</div><h2>The stories behind this week’s Daegon 100</h2><p>Movement, new peaks, debuts, historical milestones and — from June 2017 onward — sales, streaming and airplay analysis.</p></div><a href="'+appHref('/chart-beat/weekly/'+latestDate)+'" data-portal-link="/chart-beat/weekly/'+latestDate+'">Read '+fmtDate(latestDate)+' →</a></section>':'';

  const chartCards='<section class="mag-charts"><div class="mag-section-head"><h2>This Week’s Charts</h2><a href="'+appHref('/chart/daegon-100')+'">View Daegon 100 →</a></div><div class="mag-chart-grid">'+
    no1s.filter(x=>x.e).map(x=>'<article class="mag-chart-card">'+refThumb(x.e,charts[x.id].kind)+'<div class="mag-chart-copy"><div class="mag-kicker">'+esc(charts[x.id].title)+'</div><div class="mag-chart-rank">No. 1</div><h3>'+entityLink(x.e,charts[x.id].kind)+'</h3>'+(charts[x.id].kind!=='artist'?'<p>'+artistLink(x.e.artist)+'</p>':'')+'<a class="mag-chart-link" href="'+appHref(chartPath(x.id,x.date))+'">Full chart →</a></div></article>').join('')+
  '</div></section>';

  const archiveDates=(byId.songs.dates||[]).filter(d=>d<latestDate).slice(-4).reverse();
  const archive='<section class="mag-archive"><div class="mag-section-head"><h2>From the Archive</h2><a href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">Explore Chart Beat →</a></div><div class="mag-archive-grid">'+
    archiveDates.map(d=>{const e=(byId.songs.entriesByDate[d]||[])[0];return e?'<a class="mag-archive-card" href="'+appHref('/chart-beat/weekly/'+d)+'" data-portal-link="/chart-beat/weekly/'+d+'"><div class="mag-archive-date">'+fmtDate(d)+'</div><strong>'+esc(portalText(e.name))+'</strong><span>'+esc(portalArtist(e.artist))+' led the Daegon 100</span><em>Revisit the week →</em></a>':''}).join('')+
  '</div></section>';

  const features=moreStories.length?'<section class="mag-features"><div class="mag-section-head"><h2>Features</h2><a href="'+appHref('/features')+'" data-portal-link="/features">All features →</a></div><div class="mag-feature-list">'+
    moreStories.map(a=>'<a href="'+storyLink(a)+'" data-portal-link="/chart-beat/'+a.slug+'" class="mag-feature-row">'+storyArt(a,'small')+'<div><div class="mag-kicker">'+esc(a.category)+'</div><h3>'+esc(a.headline)+'</h3><p>'+esc(a.dek||'')+'</p></div></a>').join('')+
  '</div></section>':'';

  const main='<main class="mag-home">'+
    '<div class="mag-brandline"><span>Music. Charts. Culture.</span><p>Independent music journalism powered by the Daegon Charts archive.</p></div>'+
    hero+secondaryHtml+weeklyStory+chartCards+features+archive+
    '<section class="mag-about-strip"><div><div class="mag-kicker">About Daegon</div><h2>Music journalism with its own chart archive.</h2><p>Daegon combines original weekly rankings, historical research and source-backed reporting to explain what is happening in music — and how today connects to the past.</p></div><div><a href="'+appHref('/methodology')+'">Methodology →</a><a href="'+appHref('/ai')+'" data-portal-link="/ai">How we use AI →</a><a href="'+appHref('/about')+'">About the project →</a></div></section>'+
  '</main>';

  setMode(true);portalEl.innerHTML=shellHtml(main);
  setMeta('Daegon Charts — Music News, Charts & Culture','Music news, chart analysis, historical reporting and original weekly rankings from Daegon Charts.','/',true);
  bindLinks();hydratePortalImages();
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
      '<div class="ref-catalog-copy"><div class="ref-catalog-title">'+esc(portalText(x.name))+'</div>'+
      '<div class="ref-catalog-sub">'+(kind==='artist'?fmtNum(x.entries)+' entries':artistLink(x.artist)+' · '+fmtNum(x.entries)+' entries')+'</div></div></a>'
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
function detailStat(label,value,accent=false){
  return '<div class="orig-detail-stat'+(accent?' accent':'')+'"><div class="orig-detail-stat-label">'+esc(label)+'</div><div class="orig-detail-stat-value">'+esc(String(value??'—'))+'</div></div>';
}
function detailActions(name,kind){
  return '<div class="orig-detail-actions">'+
    (kind==='artist'?'<button type="button" class="orig-detail-follow" data-detail-follow="'+escAttr(name)+'" title="Follow artist"><i class="fas fa-plus"></i> Follow</button>':'<button type="button" class="orig-detail-action" data-detail-favorite="'+escAttr(kind+':'+name)+'" title="Favorite"><i class="far fa-star"></i></button>')+
    '<button type="button" class="orig-detail-action" data-detail-share title="Share"><i class="fas fa-share-alt"></i></button>'+
  '</div>';
}
function bindDetailActions(title,kind='artist',artist=''){
  const fav=portalEl.querySelector('[data-detail-favorite]');
  if(fav&&kind!=='artist'){
    dcSyncFavorite(fav,kind,title,artist);
    fav.onclick=()=>dcToggleFavorite(fav,kind,title,artist);
  }
  const follow=portalEl.querySelector('[data-detail-follow]');
  if(follow){
    dcSyncArtistFollow(follow,title);
    follow.onclick=()=>dcToggleArtistFollow(follow,title);
  }
  const share=portalEl.querySelector('[data-detail-share]');
  if(share)share.onclick=async()=>{try{if(navigator.share)await navigator.share({title,url:location.href});else await navigator.clipboard.writeText(location.href)}catch{}};
}

function detailRunGrid(title,chartId,runs){
  if(!runs.length)return '';
  const sorted=[...runs].sort((a,b)=>a.date.localeCompare(b.date));
  const peak=Math.min(...sorted.map(x=>Number(x.position)||999));
  const weeks=sorted.length;
  const weeksAt1=sorted.filter(x=>Number(x.position)===1).length;
  let cells='';
  sorted.forEach((x,i)=>{
    if(i){
      const prev=new Date(sorted[i-1].date+'T00:00:00'),cur=new Date(x.date+'T00:00:00');
      const gap=Math.round((cur-prev)/(7*86400000))-1;
      if(gap>0)cells+='<span class="orig-run-out" title="Out for '+gap+' week'+(gap>1?'s':'')+'">OUT'+(gap>1?' '+gap+'x':'')+'</span>';
    }
    const pos=Number(x.position)||0;
    const tone=pos<=10?' top10':pos<=25?' top25':pos<=50?' top50':'';
    cells+='<a class="orig-run-cell'+tone+'" href="'+appHref(chartPath(chartId,x.date))+'" title="'+fmtDate(x.date)+' — #'+pos+'">'+pos+'</a>';
  });
  return '<section class="orig-run-card">'+
    '<div class="orig-run-title">'+esc(title)+'</div>'+
    '<div class="orig-run-chips"><span>Peak #'+peak+'</span><span>'+weeks+' weeks</span>'+(weeksAt1?'<span class="no1">'+weeksAt1+' #1'+(weeksAt1>1?'s':'')+'</span>':'')+'</div>'+
    '<div class="orig-run-grid">'+cells+'</div>'+
  '</section>';
}


function albumTrackHistorySection(album,albumArtist,songsData){
  if(!songsData)return '';
  const albumKey=slugify(album||'');
  const artistKey=slugify(albumArtist||'');
  const tracks=new Map();
  for(const date of songsData.dates||[]){
    for(const e of songsData.entriesByDate?.[date]||[]){
      if(!e.album||slugify(e.album)!==albumKey)continue;
      if(artistKey&&slugify(e.artist||'')!==artistKey)continue;
      const key=itemKey(e);
      let t=tracks.get(key);
      if(!t){
        t={name:e.name,artist:e.artist||albumArtist,runs:[],peak:999,weeks:0,weeksAt1:0,first:date};
        tracks.set(key,t);
      }
      const pos=Number(e.position)||999;
      t.runs.push({...e,date});
      t.weeks++;
      if(pos<t.peak)t.peak=pos;
      if(pos===1)t.weeksAt1++;
    }
  }
  const list=[...tracks.values()].sort((a,b)=>a.first.localeCompare(b.first)||a.peak-b.peak||a.name.localeCompare(b.name));
  if(!list.length)return '';
  const no1=list.filter(t=>t.peak===1).length;
  const top10=list.filter(t=>t.peak<=10).length;
  const summary='<section class="orig-album-track-summary">'+
    '<div class="orig-detail-section-head"><h2>Tracks</h2></div>'+
    '<div class="orig-album-summary-grid">'+
      detailStat('Entries',list.length,true)+
      detailStat("#1's",no1)+
      detailStat('Top 10',top10)+
    '</div>'+
  '</section>';
  const cards=list.map((t,i)=>{
    const song={name:t.name,artist:t.artist};
    const href=appHref(entityPath(song,'song'));
    return '<article class="orig-album-track-card">'+
      '<div class="orig-album-track-head">'+
        '<div class="orig-album-track-index">'+(i+1)+'</div>'+
        '<div class="orig-album-track-title-wrap">'+
          '<a class="orig-album-track-title portal-link" href="'+href+'" data-portal-link="'+entityPath(song,'song')+'">'+esc(typeof visibleChartTitle==='function'?visibleChartTitle(t.name):t.name)+'</a>'+
          '<div class="orig-album-track-meta">Peak #'+t.peak+' · '+t.weeks+' week'+(t.weeks===1?'':'s')+(t.weeksAt1?' · '+t.weeksAt1+' week'+(t.weeksAt1===1?'':'s')+' at #1':'')+'</div>'+
        '</div>'+
      '</div>'+
      detailRunGrid('Daegon 100','songs',t.runs)+
    '</article>';
  }).join('');
  return summary+'<section class="orig-album-tracks-list">'+cards+'</section>';
}

async function renderItemDetailExact(kind,slug,found){
  const ids=kind==='song'?['songs','digitalSongsSales','streamingSongs','radioSongs']:['albums','topStreamingAlbums','topAlbumSales'];
  const labels={songs:'Hot 100',digitalSongsSales:'Digital Songs Sales',streamingSongs:'Streaming Songs',radioSongs:'Radio Songs',albums:'Top 100 Albums',topStreamingAlbums:'Top Streaming Albums',topAlbumSales:'Top Album Sales'};
  const datasets=await Promise.all(ids.map(id=>loadWeekly(id).catch(()=>null)));
  const albumSongsData=kind==='album'?await loadWeekly('songs').catch(()=>null):null;
  const grids=[];
  for(let i=0;i<ids.length;i++){
    const data=datasets[i];if(!data)continue;
    const runs=[];
    for(const date of data.dates){
      const e=(data.entriesByDate[date]||[]).find(x=>entitySlug(x,kind)===slug);
      if(e)runs.push({...e,date});
    }
    if(runs.length)grids.push({id:ids[i],title:labels[ids[i]]||charts[ids[i]]?.title||ids[i],runs});
  }
  const primary=grids.find(g=>g.id===(kind==='song'?'songs':'albums'))||grids[0];
  const allRuns=primary?.runs||[];
  const peak=allRuns.length?Math.min(...allRuns.map(x=>Number(x.position)||999)):'—';
  const weeks=allRuns.length;
  const latest=allRuns[allRuns.length-1]||found;
  const metric=(...keys)=>{for(const k of keys){const v=latest?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return fmtNum(metricNumber(v))}return null};
  const back=kind==='song'?'/chart/daegon-100':'/chart/daegon-albums-100';
  const backLabel=kind==='song'?'Back to Hot 100':'Back to Albums';
  const art='<div class="orig-detail-cover" data-portal-image data-kind="'+kind+'" data-name="'+escAttr(found.name)+'" data-artist="'+escAttr(found.artist||found.name)+'"><i class="fas '+iconFor(kind)+'"></i></div>';
  let stats=detailStat('Peak','#'+peak)+detailStat('Weeks',weeks);
  if(kind==='song'){
    const points=metric('totalPoints','points'),units=metric('totalUnits','units'),sales=metric('totalSales','sales'),streams=metric('totalStreams','streams'),aud=metric('totalAudience','audience');
    if(points)stats+=detailStat('Points',points); if(units)stats+=detailStat('Total Units',units); if(sales)stats+=detailStat('Sales',sales); if(streams)stats+=detailStat('Streams',streams); if(aud)stats+=detailStat('Audience',aud);
  }else{
    stats+=detailStat('Total Units',metric('totalUnits','units')||'—')+detailStat('Sales',metric('totalSales','sales')||'—')+detailStat('Streams',metric('totalStreams','streams')||'—');
  }
  const main='<div class="orig-detail-page">'+
    '<a class="orig-detail-back" href="'+appHref(back)+'"><i class="fas fa-arrow-left"></i> '+backLabel+'</a>'+
    '<section class="orig-detail-hero-card">'+art+
      '<div class="orig-detail-hero-copy">'+
        '<a class="orig-detail-artist-link" href="'+appHref('/artist/'+slugify(found.artist||''))+'">'+esc(found.artist||'')+'</a>'+
        '<h1>'+esc(found.name)+'</h1>'+
        detailActions(found.name,kind)+
        '<div class="orig-detail-stats">'+stats+'</div>'+
      '</div>'+
    '</section>'+
    '<section class="orig-detail-runs"><div class="orig-detail-section-head"><h2>Chart Runs</h2></div>'+
      grids.map(g=>detailRunGrid(g.title,g.id,g.runs)).join('')+
    '</section>'+
    (kind==='album'?albumTrackHistorySection(found.name,found.artist,albumSongsData):'')+
  '</div>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(found.name+' — '+(found.artist||''),found.name+' chart history on Daegon Charts.',entityPath(found,kind));
  bindLinks();hydratePortalImages();bindDetailActions(found.name,kind,found.artist||'');
}

async function renderArtistDetailExact(slug,found){
  const artistName=found.name;
  const chartDefs=[
    ['songs','Hot 100 Songs','song'],['digitalSongsSales','Digital Songs Sales','song'],['streamingSongs','Streaming Songs','song'],['radioSongs','Top 40 Radio','song'],
    ['albums','Top 100 Albums','album'],['topAlbumSales','Top Album Sales','album'],['topStreamingAlbums','Top Streaming Albums','album']
  ];
  const chartDefById=new Map(chartDefs.map(x=>[x[0],x]));
  const groups=new Map();
  const pendingGroups=new Map();
  let selected='songs',expanded=false,creditsReady=false,appleCreditCatalog=[];
  let artistRuns=[],peak=null,weeks=0;

  function buildGroup(data,def,creditCatalog=null){
    if(!data||!def)return null;
    const [id,title,entryKind]=def;
    const map=new Map();
    for(const date of data.dates||[])for(const e of data.entriesByDate?.[date]||[]){
      const primaryMatch=creditNorm(e.artist||'')===creditNorm(artistName);
      const appleCredit=entryKind==='song'&&creditCatalog?appleCreditForEntry(e,artistName,creditCatalog,date):null;
      const targetIsCollaborator=!!appleCredit&&!primaryMatch&&(appleCredit.collaborators||[]).map(creditNorm).includes(creditNorm(artistName));
      if(!primaryMatch&&!targetIsCollaborator)continue;
      const key=itemKey(e),x=map.get(key)||{
        item:typeof visibleChartTitle==='function'?visibleChartTitle(e.name):e.name,
        artist:e.artist,primaryArtist:e.artist,appleCredit,
        peak:999,weeks:0,weeksAt1:0,firstEntry:date,peakDate:date,kind:entryKind
      };
      if(!x.appleCredit&&appleCredit)x.appleCredit=appleCredit;
      const p=Number(e.position)||999;
      x.weeks++;
      if(p<x.peak){x.peak=p;x.peakDate=date}
      if(p===1)x.weeksAt1++;
      map.set(key,x);
    }
    const entries=[...map.values()].sort((a,b)=>a.peak-b.peak||b.weeks-a.weeks);
    return {id,title,entryKind,entries};
  }

  async function ensureGroup(id,{waitForCredits=true}={}){
    if(groups.has(id)&&(!waitForCredits||chartDefById.get(id)?.[2]!=='song'||creditsReady))return groups.get(id);
    const pendingKey=id+'|'+(waitForCredits?'credits':'fast');
    if(pendingGroups.has(pendingKey))return pendingGroups.get(pendingKey);
    const job=(async()=>{
      const def=chartDefById.get(id);
      if(!def)return null;
      const data=await loadWeekly(id).catch(()=>null);
      if(!data)return null;
      let catalog=null;
      if(def[2]==='song'&&waitForCredits){
        if(!creditsReady){
          appleCreditCatalog=await loadAppleArtistCreditCatalog(artistName);
          creditsReady=true;
        }
        catalog=appleCreditCatalog;
      }else if(def[2]==='song'&&creditsReady){
        catalog=appleCreditCatalog;
      }
      const group=buildGroup(data,def,catalog);
      if(group)groups.set(id,group);
      return group;
    })().finally(()=>pendingGroups.delete(pendingKey));
    pendingGroups.set(pendingKey,job);
    return job;
  }

  function totalLoadedEntries(){
    let n=0;
    for(const g of groups.values())n+=g.entries.length;
    return n;
  }

  function draw({loadingChart=false}={}){
    const group=groups.get(selected)||null;
    const entries=group?.entries||[];
    const visible=expanded?entries:entries.slice(0,5);
    const no1s=entries.filter(e=>e.peak===1).length,top10=entries.filter(e=>e.peak<=10).length;
    const table=loadingChart
      ? '<div class="orig-detail-empty"><i class="fas fa-circle-notch fa-spin"></i> Loading chart history…</div>'
      : entries.length?'<div class="orig-artist-table-wrap"><table class="orig-artist-table"><thead><tr><th>'+(group?.entryKind==='album'?'Album':'Song')+'</th><th>Debut Date</th><th>Peak Pos.</th><th>Peak Date</th><th>Wks. on Chart</th></tr></thead><tbody>'+
        visible.map(e=>'<tr><td data-label="'+(group?.entryKind==='album'?'Album':'Song')+'"><strong><a href="'+appHref(entityPath({name:e.item,artist:e.primaryArtist||artistName},group.entryKind))+'">'+esc(e.item)+'</a></strong><small>'+esc(group?.entryKind==='song'?appleCreditText(e.primaryArtist||artistName,e.appleCredit):portalArtist(e.primaryArtist||artistName))+'</small></td><td data-label="Debut">'+fmtShort(e.firstEntry)+'</td><td data-label="Peak"><b>#'+e.peak+'</b>'+(e.weeksAt1?'<em>'+e.weeksAt1+' WKS</em>':'')+'</td><td data-label="Peak date">'+fmtShort(e.peakDate)+'</td><td data-label="Weeks"><b>'+e.weeks+'</b></td></tr>').join('')+
        '</tbody></table>'+(entries.length>5?'<div class="orig-artist-expand"><button data-artist-expand>'+(expanded?'Show less':'Show all '+entries.length+' entries')+'</button></div>':'')+'</div>'
      : '<div class="orig-detail-empty">No entries found for this chart.</div>';

    const def=chartDefById.get(selected)||chartDefs[0];
    const activeTitle=group?.title||def[1];
    const main='<div class="orig-artist-detail-page">'+
      '<a class="orig-detail-back" href="'+appHref('/artists')+'"><i class="fas fa-arrow-left"></i> All artists</a>'+
      '<section class="orig-artist-name-hero"><h1>'+esc(artistName)+'</h1>'+detailActions(artistName,'artist')+'</section>'+
      '<div class="orig-artist-main-stats">'+
        (peak!==null?detailStat('Artist 50 Peak','#'+peak,true):'')+
        (weeks?detailStat('Artist 50 Weeks',weeks):'')+
      '</div>'+
      '<section class="orig-artist-profile">'+
        '<div class="orig-artist-profile-image" data-portal-image data-kind="artist" data-name="'+escAttr(artistName)+'" data-artist="'+escAttr(artistName)+'"><i class="fas fa-user"></i></div>'+
        '<p>'+esc(artistName)+(totalLoadedEntries()?' currently has '+totalLoadedEntries()+' loaded chart entries.':' chart history across Daegon Charts.')+'</p>'+
      '</section>'+
      '<div class="orig-artist-tabs"><button class="active"><i class="fas fa-chart-line"></i> Charts</button><button><i class="fas fa-trophy"></i> Awards</button></div>'+
      '<section class="orig-artist-chart-area">'+
        '<div class="orig-artist-summary">'+
          '<div class="chart-name">'+esc(activeTitle)+'</div>'+
          '<div><strong>'+no1s+'</strong><span>NO. 1 HITS</span></div>'+
          '<div><strong>'+entries.length+'</strong><span>TITLES</span></div>'+
          '<div><strong>'+top10+'</strong><span>TOP 10 HITS</span></div>'+
        '</div>'+
        '<select id="origArtistChartSelect">'+chartDefs.map(([id,title])=>'<option value="'+escAttr(id)+'" '+(id===selected?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select>'+
        table+
      '</section>'+
      '<div class="orig-detail-bottom-back"><a href="'+appHref('/artists')+'"><i class="fas fa-arrow-left"></i> Browse all artists</a></div>'+
    '</div>';

    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta(artistName+' — chart history',artistName+' chart history and entries.',entityPath(found,'artist'));
    bindLinks();hydratePortalImages();bindDetailActions(artistName,'artist',artistName);

    const sel=document.getElementById('origArtistChartSelect');
    if(sel)sel.onchange=async e=>{
      selected=e.target.value;expanded=false;
      if(groups.has(selected)){
        draw();
        if(chartDefById.get(selected)?.[2]==='song'&&!creditsReady){
          ensureGroup(selected,{waitForCredits:true}).then(()=>{if(document.getElementById('origArtistChartSelect')?.value===selected)draw()});
        }
        return;
      }
      draw({loadingChart:true});
      await ensureGroup(selected,{waitForCredits:chartDefById.get(selected)?.[2]==='song'});
      if(document.getElementById('origArtistChartSelect')?.value===selected)draw();
    };
    const ex=portalEl.querySelector('[data-artist-expand]');
    if(ex)ex.onclick=()=>{expanded=!expanded;draw()};
  }

  // Fast first paint: only the artist summary + Hot 100 are required.
  const [artistData,songsData]=await Promise.all([
    loadWeekly('artists').catch(()=>null),
    loadWeekly('songs').catch(()=>null)
  ]);

  if(artistData){
    for(const date of artistData.dates||[]){
      const e=(artistData.entriesByDate?.[date]||[]).find(x=>slugify(x.name)===slugify(artistName));
      if(e)artistRuns.push({...e,date});
    }
    peak=artistRuns.length?Math.min(...artistRuns.map(x=>Number(x.position)||999)):null;
    weeks=artistRuns.length;
  }
  if(songsData){
    const fastSongs=buildGroup(songsData,chartDefById.get('songs'),null);
    if(fastSongs)groups.set('songs',fastSongs);
  }
  draw();

  // Enrich Hot 100 with Apple feat/duet credits after the page is already visible.
  loadAppleArtistCreditCatalog(artistName).then(catalog=>{
    appleCreditCatalog=catalog||[];
    creditsReady=true;
    if(songsData){
      const enriched=buildGroup(songsData,chartDefById.get('songs'),appleCreditCatalog);
      if(enriched)groups.set('songs',enriched);
    }
    if(selected==='songs')draw();
  }).catch(()=>{creditsReady=true});
}

async function renderDetail(kind,slug){
  loading(labelFor(kind));
  const {found}=await findEntity(kind,slug);
  if(!found){renderNotFound();return}
  if(kind==='artist')return renderArtistDetailExact(slug,found);
  return renderItemDetailExact(kind,slug,found);
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
  if(chartId==='yecTop100AlbumsArtists')return computeArtistAggregateExact('albums','Top 100 Albums — Artists','units');
  if(chartId==='yecRadioSongsArtists')return computeArtistAggregateExact('radioSongs','Radio Songs — Artists','audience');
  if(chartId==='yecArtist50Female')return computeGenderYecExact('FEMALE');
  if(chartId==='yecArtist50Male')return computeGenderYecExact('MALE');
  if(chartId==='yecArtist50DuoGroup')return computeGenderYecExact('GROUP');
  if(chartId==='yearEndNewArtists')return computeNewArtistsExact();
  const cfg=officialYearEnd[chartId];if(!cfg)throw new Error('Unknown Year-End chart');
  return computeYearEndExact(cfg.weeklyId);
}
function goatHistoricalPerformance(position,kind){
  const pos=Math.max(1,Number(position)||1);
  if(kind==='song')return Math.max(1,101-pos);
  if(pos>50)return 0;
  return 100*Math.pow(Math.max(0,(51-pos)/50),1.5);
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
          chartPerformance:0,totalUnits:0,totalStreams:0,totalSales:0,totalAudience:0,totalPoints:0,kind:cfg.kind
        };
        const x=aggregated[key];
        const pos=Number(e.position)||999;
        x.weeks++;
        x.peak=Math.min(x.peak||999,e.peak||pos||999);
        if(pos===1)x.weeksAt1++;
        x.chartPerformance+=goatHistoricalPerformance(pos,cfg.kind);
        // Keep raw totals only for backwards-compatible detail data; they no longer drive GOAT ranking.
        x.totalUnits+=metricNumber(e.units);
        x.totalStreams+=metricNumber(e.streams);
        x.totalSales+=metricNumber(e.sales);
        x.totalAudience+=metricNumber(e.audience);
        x.totalPoints+=metricNumber(e.points);
      }
    }
    const entries=Object.values(aggregated)
      .sort((a,b)=>b.chartPerformance-a.chartPerformance||b.weeks-a.weeks||b.weeksAt1-a.weeksAt1||a.peak-b.peak)
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
    '<div class="orig-top5-card '+(i===0?'lead':'')+'"><div class="orig-top5-art">'+refThumb(e,kind)+'<div class="orig-rank">'+(e.position||i+1)+'</div></div><div class="orig-top5-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="orig-top5-artist">'+artistLink(e.artist||'')+'</div>':'')+'</div>'
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
    {id:'yearEndAlbums',title:'Top 100 Albums'},{id:'yearEndTopAlbumSales',title:'Top Album Sales'},{id:'yearEndTopStreamingAlbums',title:'Top Streaming Albums'}
  ];
  const ARTIST_CHARTS=[
    {id:'yecHot100Artists',title:'Daegon 100 — Artists'},{id:'yecArtist50Female',title:'Top Artists — Female'},{id:'yecArtist50Male',title:'Top Artists — Male'},{id:'yecArtist50DuoGroup',title:'Top Artists — Duo/Group'},{id:'yearEndNewArtists',title:'Top New Artists'},{id:'yecTop100AlbumsArtists',title:'Top 100 Albums — Artists'},{id:'yecRadioSongsArtists',title:'Radio Songs — Artists'}
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
      originalTop5('Top 100 Albums',(albums.entriesByYear[selected]||[]).slice(0,5),'album','/year-end/yearEndAlbums')+
      originalTop5('Artist 50',(artists.entriesByYear[selected]||[]).slice(0,5),'artist','/year-end/yearEndArtists')+
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
  const aggregate=(d,id)=>aggregateDecadePeriod(d,id,x=>Number(x.slice(0,4))>=Number(selected)&&Number(x.slice(0,4))<Number(selected)+10).slice(0,5).map((x,i)=>({...x,position:i+1}));
  const draw=()=>{
    const main='<div class="orig-page">'+originalHero('DECADE-END CHARTS','Decade-End Charts','The definitive decade-end rankings across every chart')+
      editorialBlock(
        'How the Decade-End Charts work',
        [
          'Decade-End Charts combine the weekly Daegon archive across the selected ten-year period, so the ranking reflects sustained performance throughout the decade rather than one isolated year or a single peak week.',
          'Songs are ranked by accumulated points, while Albums and Artists are ranked by accumulated units. Weeks charted and best peak are used only as secondary tie-breakers when accumulated performance is equal.'
        ],
        [['/methodology','See the full methodology'],['/stats','Explore chart records']]
      )+
      originalYearControls('Decade',decades.map(x=>x+'s'),selected+'s','decade')+
      originalTop5('Daegon 100',aggregate(data[0],'songs'),'song','/decade-end/songs?decade='+selected)+
      originalTop5('Top 100 Albums',aggregate(data[1],'albums'),'album','/decade-end/albums?decade='+selected)+
      originalTop5('Artist 50',aggregate(data[2],'artists'),'artist','/decade-end/artists?decade='+selected)+
      originalChartGrid('Songs',[{id:'songs',title:'Daegon 100'},{id:'radio',title:'Radio Songs'},{id:'digital-songs-sales',title:'Digital Songs Sales'},{id:'streaming-songs',title:'Streaming Songs'}],'/decade-end/')+
      originalChartGrid('Albums',[{id:'albums',title:'Top 100 Albums'},{id:'top-album-sales',title:'Top Album Sales'},{id:'top-streaming-albums',title:'Top Streaming Albums'}],'/decade-end/')+
      originalChartGrid('Artists',[
        {id:'artists',title:'Artist 50'},
        {id:'hot100Artists',title:'Daegon 100 — Artists'},
        {id:'artistFemale',title:'Top Artists — Female'},
        {id:'artistMale',title:'Top Artists — Male'},
        {id:'artistDuoGroup',title:'Top Artists — Duo/Group'},
        {id:'albumsArtists',title:'Top 100 Albums — Artists'}
      ],'/decade-end/')+
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
  const topSongs=[...songs.entries].sort((a,b)=>b.chartPerformance-a.chartPerformance||b.weeks-a.weeks).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const topAlbums=[...albums.entries].sort((a,b)=>b.chartPerformance-a.chartPerformance||b.weeks-a.weeks).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const topArtists=[...artists.entries].sort((a,b)=>b.chartPerformance-a.chartPerformance||b.weeks-a.weeks).slice(0,5).map((e,i)=>({...e,position:i+1}));
  const allCharts=exactGoatIds.map(id=>({id,title:officialGoat[id].title}));
  const main='<div class="orig-page">'+originalHero('GREATEST OF ALL TIME','Greatest of All Time','Long-term rankings built from the complete weekly archive')+
    editorialBlock(
      'What Greatest of All Time means here',
      [
        'The GOAT pages normalize every weekly chart from 2000 onward to the historical 2000–2009 scale, so later consumption-based eras do not receive an artificial numerical advantage.',
        'Chart Performance uses that common historical scale across every week: Songs run from 100 points at No. 1 to 1 point at No. 100, while Albums and Artists use the original 2000–2009 curved 50-position scale. Weeks on Chart is available as a separate longevity view.'
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
      return '<div class="ref-no1-card"><div class="ref-no1-body">'+refThumb(entry,cfg.kind)+'<div class="ref-no1-copy"><div class="ref-no1-chart">'+esc(cfg.title)+'</div><div class="ref-no1-title">'+entityLink(entry,cfg.kind)+'</div>'+(cfg.kind!=='artist'?'<div class="ref-no1-artist">'+esc(portalArtist(entry.artist))+'</div>':'')+'</div></div><a class="ref-no1-view" href="'+appHref(chartPath(id,selected))+'">View Chart →</a></div>';
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
    const summary=cats.map(c=>{const x=c.records[0];return '<div class="orig-summary-card"><div class="orig-summary-head"><span class="orig-summary-icon"><i class="fas '+c.icon+'"></i></span><span>'+esc(c.title)+'</span></div>'+(x?'<div class="orig-summary-name">'+esc(portalText(x.name))+'</div>'+(kind!=='artist'?'<div class="orig-summary-artist">'+artistLink(x.artist||'')+'</div>':'')+'<div class="orig-summary-value">'+esc(c.value(x))+'</div>':'')+'</div>'}).join('');
    const rows=cat.records.map((x,i)=>'<div class="orig-record-row"><div class="orig-record-rank '+(i<3?'top':'')+'">'+(i+1)+'</div>'+refThumb(x,kind)+'<div class="orig-record-main"><div class="orig-record-name">'+entityLink(x,kind)+'</div>'+(kind!=='artist'?'<div class="orig-record-artist">'+artistLink(x.artist||'')+'</div>':'')+'</div><div class="orig-record-value">'+esc(cat.value(x))+(x.peak?'<small>Peak #'+x.peak+'</small>':'')+'</div></div>').join('');
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
          '<div class="exact-entry"><div class="exact-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="exact-artist">'+artistLink(e.artist||'')+'</div>':'')+'</div>'+
          '<button type="button" class="exact-plus" data-yec-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-mobile-row">'+
          '<div class="exact-mobile-rank">'+pos+'</div>'+
          '<div class="exact-mobile-art '+(kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,kind)+'</div>'+
          '<div class="exact-mobile-copy"><div class="exact-mobile-title">'+entityLink(e,kind)+'</div>'+(kind!=='artist'?'<div class="exact-mobile-artist">'+artistLink(e.artist||'')+'</div>':'')+'</div>'+
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

    portalEl.querySelectorAll('[data-yec-detail]').forEach(b=>b.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      const key=b.dataset.yecDetail;
      const card=b.closest('.exact-chart-card');
      const cardTop=card?.getBoundingClientRect().top;
      const details=card?.querySelector('.exact-details');
      const willOpen=!openDetails.has(key);
      if(willOpen)openDetails.add(key);else openDetails.delete(key);
      if(details)details.classList.toggle('open',willOpen);
      card?.querySelectorAll('[data-yec-detail]').forEach(btn=>{btn.textContent=willOpen?'−':'+'});
      b.blur();
      if(card&&Number.isFinite(cardTop)){
        const restore=()=>{
          const delta=card.getBoundingClientRect().top-cardTop;
          if(Math.abs(delta)>.5)window.scrollBy(0,delta);
        };
        restore();
        requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
      }
    });
  };

  draw();
}


const decadeArtistViews={
  artists:{title:'Artist 50',source:'artists',metric:'units'},
  hot100Artists:{title:'Daegon 100 — Artists',source:'songs',metric:'points'},
  artistFemale:{title:'Top Artists — Female',source:'artists',metric:'units',category:'FEMALE'},
  artistMale:{title:'Top Artists — Male',source:'artists',metric:'units',category:'MALE'},
  artistDuoGroup:{title:'Top Artists — Duo/Group',source:'artists',metric:'units',category:'GROUP'},
  albumsArtists:{title:'Top 100 Albums — Artists',source:'albums',metric:'units'}
};
async function aggregateDecadeArtists(sourceId,metricField,predicate,category){
  const data=await loadWeekly(sourceId);
  const meta=category?await loadExactArtistMetadata():null;
  const m=new Map();
  for(const d of data.dates){
    if(!predicate(d))continue;
    for(const e of data.entriesByDate[d]||[]){
      const artist=sourceId==='artists'?e.name:e.artist;
      if(!artist)continue;
      if(category){
        const md=meta?.[slugify(artist)];
        if(!(md?.categoryConfirmed&&md.category===category))continue;
      }
      const key=String(artist).trim().toLowerCase();
      let x=m.get(key);
      if(!x){
        x={name:artist,artist,score:0,totalMetric:0,weeks:0,peak:Number(e.position)||100,weeksAt1:0,lastEntry:e,kind:'artist'};
        m.set(key,x);
      }
      const value=metricNumber(e[metricField]??0);
      x.score+=value;
      x.totalMetric+=value;
      x.weeks++;
      x.peak=Math.min(x.peak,Number(e.position)||100);
      if(Number(e.position)===1)x.weeksAt1++;
      x.lastEntry=e;
    }
  }
  return [...m.values()].sort((a,b)=>b.totalMetric-a.totalMetric||b.weeks-a.weeks||a.peak-b.peak);
}

async function renderDecadeDetailExact(chartSeg){
  const baseMap={songs:'songs',albums:'albums'};
  const artistView=decadeArtistViews[chartSeg]||null;
  const weeklyId=artistView?.source||baseMap[chartSeg]||'songs';
  const data=await loadWeekly(weeklyId);
  const years=[...new Set(data.dates.map(d=>Number(d.slice(0,4))))].sort((a,b)=>b-a);
  const decades=[...new Set(years.map(y=>Math.floor(y/10)*10))].sort((a,b)=>b-a).map(String);
  let selected=String(new URLSearchParams(location.search).get('decade')||decades[0]||'2000');
  if(!decades.includes(selected))selected=decades[0]||selected;

  const path='/decade-end/'+chartSeg;
  const kind=artistView?'artist':charts[weeklyId].kind;
  const title=artistView?.title||charts[weeklyId].title;
  const navItems=[
    ['songs','Daegon 100'],
    ['albums','Top 100 Albums'],
    ['artists','Artist 50'],
    ['hot100Artists','Daegon 100 — Artists'],
    ['artistFemale','Top Artists — Female'],
    ['artistMale','Top Artists — Male'],
    ['artistDuoGroup','Top Artists — Duo/Group'],
    ['albumsArtists','Top 100 Albums — Artists']
  ];

  const draw=async()=>{
    const pred=d=>Number(d.slice(0,4))>=Number(selected)&&Number(d.slice(0,4))<Number(selected)+10;
    const arr=(artistView
      ? await aggregateDecadeArtists(artistView.source,artistView.metric,pred,artistView.category)
      : aggregateDecadePeriod(data,weeklyId,pred)
    ).slice(0,100);
    const values=decades.map(x=>x+'s');
    const selectedLabel=selected+'s';

    const main='<div class="orig-period-layout">'+
      '<aside class="orig-period-side">'+
        '<div class="orig-period-side-links">'+
          navItems.map(([id,label])=>'<a href="'+appHref('/decade-end/'+id)+'?decade='+encodeURIComponent(selected)+'" class="'+(id===chartSeg?'active':'')+'">'+esc(label)+'</a>').join('')+
        '</div>'+
        '<a class="orig-period-back" href="'+appHref('/decade-end')+'?decade='+encodeURIComponent(selected)+'"><i class="fas fa-arrow-left"></i> All Decade-End</a>'+
      '</aside>'+
      '<main class="orig-period-main">'+
        '<div class="orig-period-heading"><h1>'+esc(title)+'</h1></div>'+
        originalYearControls('Decade',values,selectedLabel,'decadedetail')+
        '<div class="orig-period-list">'+
          arr.map((e,i)=>'<div class="orig-period-card">'+
            '<div class="orig-period-rank">'+(i+1)+'</div>'+
            '<div class="orig-period-art">'+refThumb(e,kind)+'</div>'+
            '<div class="orig-period-entry">'+
              '<div class="orig-period-name">'+entityLink(e,kind)+'</div>'+
              (kind!=='artist'&&e.artist?'<div class="orig-period-artist">'+artistLink(e.artist)+'</div>':'')+
            '</div>'+
          '</div>').join('')+
        '</div>'+
      '</main>'+
    '</div>';

    setMode(true);
    portalEl.innerHTML=shellHtml(main);
    setMeta('Decade-End - '+title,title+' decade-end rankings for the '+selected+'s.',path);
    bindLinks();
    hydratePortalImages();

    const change=v=>{
      selected=String(v).replace(/s$/,'');
      history.replaceState({},'',appHref(path)+'?decade='+encodeURIComponent(selected));
      draw();
    };
    const toggle=portalEl.querySelector('[data-decadedetail-toggle]');
    const menu=portalEl.querySelector('[data-decadedetail-menu]');
    if(toggle&&menu)toggle.onclick=()=>menu.classList.toggle('open');
    portalEl.querySelectorAll('[data-decadedetail-value]').forEach(b=>b.onclick=()=>change(b.dataset.decadedetailValue));

    const idx=values.indexOf(selectedLabel),prev=idx<values.length-1?values[idx+1]:null,next=idx>0?values[idx-1]:null;
    const pb=portalEl.querySelector('[data-decadedetail-prev]'),nb=portalEl.querySelector('[data-decadedetail-next]');
    if(pb)pb.onclick=()=>prev&&change(prev);
    if(nb)nb.onclick=()=>next&&change(next);
  };

  await draw();
}

async function renderGoat(chartSeg){
  const cfg=officialGoat[chartSeg]||officialGoat.goatSongs;
  loading('Greatest of All Time');

  const data=await computeGoatExact(chartSeg);
  const isRadio=chartSeg==='goatRadio';
  let sort='performance';
  let search='';
  let page=1;
  let mobileExpanded=false;
  const openDetails=new Set();
  const PAGE_SIZE=50;

  const sortOptions=[
    ['performance','Chart Performance'],
    ['weeks','Weeks on Chart']
  ];

  const metricValue=e=>{
    if(sort==='performance'){
      const n=Number(e.chartPerformance||0);
      return n.toLocaleString('en-US',{maximumFractionDigits:1})+' performance';
    }
    return (e.weeks||0)+' weeks';
  };

  const draw=()=>{
    let sorted=[...data.entries];
    const sorters={
      performance:(a,b)=>b.chartPerformance-a.chartPerformance||b.weeks-a.weeks||b.weeksAt1-a.weeksAt1||a.peak-b.peak,
      weeks:(a,b)=>b.weeks-a.weeks||b.chartPerformance-a.chartPerformance||b.weeksAt1-a.weeksAt1||a.peak-b.peak
    };
    sorted.sort(sorters[sort]||sorters.performance);
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
          '<div class="exact-entry"><div class="exact-title">'+entityLink(e,data.kind)+'</div>'+(data.kind!=='artist'?'<div class="exact-artist">'+artistLink(e.artist||'')+'</div>':'')+'</div>'+
          '<div class="exact-goat-desktop-metric">'+esc(metricValue(e))+'</div>'+
          '<button type="button" class="exact-plus" data-goat-detail="'+escAttr(key)+'">'+(openDetails.has(key)?'−':'+')+'</button>'+
        '</div>'+
        '<div class="exact-mobile-row">'+
          '<div class="exact-mobile-rank">'+e.position+'</div>'+
          '<div class="exact-mobile-art '+(data.kind==='artist'?'exact-artist-art ':'')+(isFirst?'first':'')+'">'+refThumb(e,data.kind)+'</div>'+
          '<div class="exact-mobile-copy"><div class="exact-mobile-title">'+entityLink(e,data.kind)+'</div>'+(data.kind!=='artist'?'<div class="exact-mobile-artist">'+artistLink(e.artist||'')+'</div>':'')+'</div>'+
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

    portalEl.querySelectorAll('[data-goat-detail]').forEach(b=>b.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      const y=window.scrollY;
      const key=b.dataset.goatDetail;
      if(openDetails.has(key))openDetails.delete(key);else openDetails.add(key);
      draw();
      keepViewportPosition(y);
    });

    const prev=document.getElementById('exactGoatPrev'),next=document.getElementById('exactGoatNext');
    if(prev)prev.onclick=()=>{if(page>1){page--;draw();window.scrollTo({top:0,behavior:'smooth'})}};
    if(next)next.onclick=()=>{if(page<totalPages){page++;draw();window.scrollTo({top:0,behavior:'smooth'})}};
  };

  draw();
}


let CHART_BEAT_ARTICLES=[
  {
    slug:'umbrella-rihanna-2007',
    category:'Chart Rewind',
    headline:'How “Umbrella” turned Rihanna into the defining pop star of summer 2007',
    seoTitle:'Rihanna “Umbrella” in 2007: How the Hit Changed Her Career',
    socialTitle:'The summer “Umbrella” changed Rihanna’s career',
    dek:'Contemporary reporting, Rihanna’s own comments and the scale of the song’s international run show why 2007 became a turning point.',
    byline:'Daegon Charts Editorial',
    published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"song","name":"Umbrella","artist":"Rihanna","caption":"“Umbrella” — Rihanna"},"secondary":{"kind":"album","name":"Good Girl Gone Bad","artist":"Rihanna","caption":"Good Girl Gone Bad — Rihanna"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Rihannalive2007.jpg","alt":"Rihanna performing live in 2007","credit":"Photo: tomasland / Wikimedia Commons","license":"CC BY 2.0","source":"https://commons.wikimedia.org/wiki/File:Rihannalive2007.jpg","note":"Rihanna performing during the Good Girl Gone Bad era, August 2007."},
    body:[
      '<p>By the end of 2007, “Umbrella” was no longer simply another successful Rihanna single. Contemporary coverage was already treating it as the record that changed the scale of her career. The song arrived alongside the visual reinvention of <em>Good Girl Gone Bad</em> and quickly became a reference point for the year’s pop culture.</p>',
      '<h2>A hit that became bigger than its release campaign</h2><p>In August 2007, <em>The Guardian</em> described “Umbrella” as the soundtrack to Britain’s unusually wet summer and noted its ten-week run at No. 1 in the UK. That run made it the longest-lasting UK chart-topper in more than a decade at the time and the longest by a female artist since Whitney Houston’s “I Will Always Love You.”</p>',
      '<p>The coincidence between the title and the weather became part of the song’s public story, but Rihanna herself framed the record more personally. In a December 2007 interview, she said she did not expect to tire of performing it because of what it meant to her and described the response of crowds singing it back as overwhelming.</p>',
      '<h2>Rihanna fought for the song</h2><p>The song had circulated before reaching her. In a 2008 interview looking back on the previous year, Rihanna recalled becoming determined that “Umbrella” should be hers after hearing it. Songwriter The-Dream and producer Tricky Stewart had considered other artists, but Rihanna’s recording ultimately became the definitive version.</p>',
      '<p>That history matters because it complicates the idea that a career-defining record is always designed for one singer from the beginning. “Umbrella” became inseparable from Rihanna because of the finished performance, the visual identity of the era and the scale of the public response.</p>',
      '<h2>Why it belongs in chart history</h2><p>For chart research, “Umbrella” is useful because it combines several different kinds of evidence: sustained weekly success, international reach, a recognizable visual era and contemporary testimony from the artist herself. The chart tells us that the record lasted. Contemporary reporting helps explain why people kept talking about it.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.theguardian.com/music/2007/aug/26/popandrock" target="_blank" rel="noopener">The Guardian, “Singing in the rain” — Aug. 25, 2007</a></li><li><a href="https://www.theguardian.com/music/2007/dec/09/5" target="_blank" rel="noopener">The Guardian, interview with Rihanna — Dec. 9, 2007</a></li><li><a href="https://www.theguardian.com/music/2008/may/23/urban" target="_blank" rel="noopener">The Guardian, “Sweetness and steel” — May 23, 2008</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'britney-spears-blackout-2007',
    category:'Chart Analysis',
    headline:'Britney Spears’ “Blackout” arrived in chaos. The music told a different story.',
    seoTitle:'Britney Spears “Blackout” in 2007: Reviews, Context and Impact',
    socialTitle:'In 2007, Britney’s headlines and her music were telling two different stories',
    dek:'Contemporary reviews reveal how critics separated the turmoil surrounding Britney Spears from the sound of one of 2007’s boldest pop albums.',
    byline:'Daegon Charts Editorial',published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"album","name":"Blackout","artist":"Britney Spears","caption":"Blackout — Britney Spears"},"secondary":{"kind":"song","name":"Gimme More","artist":"Britney Spears","caption":"“Gimme More” — Britney Spears"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Britney_Spears_2007_2.jpg","alt":"Britney Spears in October 2007","credit":"Photo: ciestrada71 / Wikimedia Commons","license":"CC BY 2.0","source":"https://commons.wikimedia.org/wiki/File:Britney_Spears_2007_2.jpg","note":"Britney Spears photographed in October 2007, the month Blackout was released."},
    body:[
      '<p>Few major pop albums have arrived beneath as much non-musical attention as Britney Spears’ <em>Blackout</em>. By October 2007, coverage of Spears’ personal life was constant. Yet the reviews published as the album arrived reveal a striking split: critics were often disturbed by the circumstances around the singer while responding positively to the record itself.</p>',
      '<h2>The release date itself became news</h2><p>In October 2007, the album’s release was moved forward. Sony BMG publicly pointed to demand, while Jive Records cited unauthorized leaks of songs and unfinished material. Even before critics could assess the finished record, the mechanics of getting <em>Blackout</em> into stores had become part of its story.</p>',
      '<h2>Critics heard ambition behind the noise</h2><p>Alexis Petridis’ contemporary review for <em>The Guardian</em> called the album bold and exciting even while questioning whether the public conversation around Spears would overwhelm the music. Another review that same weekend focused on the striking disconnect between the club-focused production and the events dominating tabloid coverage.</p>',
      '<p>That contrast is central to understanding the album historically. <em>Blackout</em> was not received merely as a celebrity document. Its production, electronic textures and tightly constructed dance-pop attracted serious critical attention at the moment of release.</p>',
      '<h2>“Gimme More” changed the comeback conversation</h2><p>Weeks before the album appeared, contemporary coverage had already noticed that “Gimme More” was being received more favorably than many expected. The song provided a musical counterpoint to a year in which coverage of Spears was overwhelmingly personal.</p>',
      '<p>Chart history should therefore avoid reducing the era to either extreme. The turmoil was real and unavoidable in contemporary reporting; so was the fact that the record itself earned praise. Both belong in an accurate reconstruction of 2007 pop culture.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.theguardian.com/music/2007/oct/11/1" target="_blank" rel="noopener">The Guardian, album release moved forward — Oct. 11, 2007</a></li><li><a href="https://www.theguardian.com/music/2007/oct/26/popandrock.shopping" target="_blank" rel="noopener">The Guardian, <em>Blackout</em> review — Oct. 26, 2007</a></li><li><a href="https://www.theguardian.com/music/2007/oct/28/popandrock1" target="_blank" rel="noopener">The Observer, <em>Blackout</em> review — Oct. 28, 2007</a></li><li><a href="https://www.theguardian.com/music/musicblog/2007/oct/03/canbritneybounceback" target="_blank" rel="noopener">The Guardian, “Can Britney bounce back?” — Oct. 3, 2007</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'amy-winehouse-back-to-black-america-2007',
    category:'Chart Rewind',
    headline:'How America discovered Amy Winehouse in 2007',
    seoTitle:'Amy Winehouse “Back to Black” in America: The 2007 Breakthrough',
    socialTitle:'The moment Amy Winehouse crossed from British acclaim to an American breakthrough',
    dek:'Back to Black’s U.S. breakthrough unfolded alongside touring, awards attention and increasingly intense scrutiny of Amy Winehouse.',
    byline:'Daegon Charts Editorial',published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"album","name":"Back to Black","artist":"Amy Winehouse","caption":"Back to Black — Amy Winehouse"},"secondary":{"kind":"song","name":"Rehab","artist":"Amy Winehouse","caption":"“Rehab” — Amy Winehouse"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Winehouse_2007.jpg","alt":"Amy Winehouse performing in Philadelphia in 2007","credit":"Photo: BIA bia 42 / Wikimedia Commons","license":"CC BY 2.0","source":"https://commons.wikimedia.org/wiki/File:Winehouse_2007.jpg","note":"Amy Winehouse performing in Philadelphia in May 2007."},
    body:[
      '<p>Amy Winehouse entered 2007 with critical recognition in Britain and an album that already carried a distinct musical identity. What changed during the year was scale. <em>Back to Black</em> moved from acclaimed British release to a major international success, while American audiences encountered Winehouse through records, live appearances and rapidly expanding press coverage.</p>',
      '<h2>A U.S. debut that immediately attracted attention</h2><p>Contemporary reporting in March 2007 noted that <em>Back to Black</em> entered the U.S. album chart inside the Top 10 after Winehouse performed at South by Southwest. The American breakthrough arrived quickly enough to become news in Britain in its own right.</p>',
      '<p>The album’s songs also carried a narrative unusually easy for audiences to connect with the singer’s interviews. Winehouse spoke openly in early 2007 about the experiences behind “Rehab” and about her relationship to drinking. Those comments are useful historical evidence because they predate much of the later mythology that formed around her.</p>',
      '<h2>Success and concern grew at the same time</h2><p>By August, a planned North American tour had been postponed on medical advice. Contemporary coverage reported both the commercial success of the album and concerns over Winehouse’s health. This is one reason retrospective accounts need care: the career breakthrough and the personal crisis were not separate chronological chapters. They were unfolding together.</p>',
      '<h2>The chart captures only part of the story</h2><p>The rankings show the acceleration of <em>Back to Black</em>. Reporting from 2007 shows what surrounded that acceleration: awards, performances, interviews, cancellations and a growing fascination with Winehouse as both an artist and public figure. A responsible chart history keeps the music at the center without pretending the surrounding context did not affect how the era was experienced.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.theguardian.com/music/2007/mar/22/news.amywinehouse" target="_blank" rel="noopener">The Guardian, U.S. breakthrough — Mar. 22, 2007</a></li><li><a href="https://www.theguardian.com/music/2007/jan/28/popandrock.foodanddrink" target="_blank" rel="noopener">The Observer, Amy Winehouse interview — Jan. 28, 2007</a></li><li><a href="https://www.theguardian.com/music/2007/aug/22/amywinehouse" target="_blank" rel="noopener">The Guardian, North American tour postponement — Aug. 22, 2007</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'beyonce-crazy-in-love-2003',
    category:'Chart Rewind',
    headline:'“Crazy in Love” was the moment Beyoncé’s solo career became undeniable',
    seoTitle:'Beyoncé “Crazy in Love” in 2003: The Solo Breakthrough Explained',
    socialTitle:'Before Beyoncé became Beyoncé, there was “Crazy in Love”',
    dek:'Contemporary reviews and Beyoncé’s own account of making the song show how one single reframed her from Destiny’s Child star to solo force.',
    byline:'Daegon Charts Editorial',published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"song","name":"Crazy in Love","artist":"Beyoncé","caption":"“Crazy in Love” — Beyoncé"},"secondary":{"kind":"album","name":"Dangerously in Love","artist":"Beyoncé","caption":"Dangerously in Love — Beyoncé"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/Beyonce,_2003.jpeg","alt":"Beyoncé performing live in 2003","credit":"Photo: Roger Woolman / Wikimedia Commons","license":"CC BY 3.0","source":"https://commons.wikimedia.org/wiki/File:Beyonce,_2003.jpeg","note":"Beyoncé performing live in November 2003, during her first solo-album era."},
    body:[
      '<p>By 2003, Beyoncé Knowles was already famous. That is different from having an established solo identity. “Crazy in Love” became the record that collapsed the distinction. Contemporary coverage treated the song not as a tentative side project from a group member, but as a major pop event.</p>',
      '<h2>The single arrived before the album had to prove itself</h2><p>A June 2003 review of <em>Dangerously in Love</em> observed that “Crazy in Love” was already surging through the U.S. charts while the album was being positioned as a major release. By the end of the year, British critics were describing Beyoncé as one of the defining figures of 2003 and repeatedly naming the single among the year’s best.</p>',
      '<h2>Beyoncé recognized the track immediately</h2><p>In a December 2003 interview, Beyoncé recalled meeting producers while preparing the album and hearing Rich Harrison’s track months before recording it. Her account suggests that the core of “Crazy in Love” stood out before the full machinery of the solo campaign was in place.</p>',
      '<p>That matters historically because the record did not simply benefit from Beyoncé’s existing fame. It supplied the evidence that the solo project could generate its own musical identity: the horn sample, the physical performance style and the Jay-Z feature all became inseparable from the new era.</p>',
      '<h2>A chart event and a career event</h2><p>Some hits are important because of how high or how long they chart. Others mark a before-and-after point in an artist’s career. “Crazy in Love” did both. Later retrospectives would treat the release as one of the decisive moments in early-2000s R&amp;B and pop, but contemporary 2003 reporting already captured the sense that something had changed.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.theguardian.com/music/2003/jun/27/popandrock.artsfeatures8" target="_blank" rel="noopener">The Guardian, <em>Dangerously in Love</em> review — June 26, 2003</a></li><li><a href="https://www.theguardian.com/music/2003/dec/14/popandrock1" target="_blank" rel="noopener">The Observer, Beyoncé interview — Dec. 14, 2003</a></li><li><a href="https://www.theguardian.com/music/2003/dec/18/popandrock" target="_blank" rel="noopener">The Guardian, 2003 year review — Dec. 18, 2003</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'daddy-yankee-gasolina-2005',
    category:'Chart Analysis',
    headline:'“Gasolina” did more than cross over: it announced reggaetón as global pop',
    seoTitle:'Daddy Yankee “Gasolina” in 2005: How Reggaetón Went Global',
    socialTitle:'In 2005, “Gasolina” made reggaetón impossible for global pop to ignore',
    dek:'Reporting from 2005 shows the speed at which Daddy Yankee and “Gasolina” moved from Puerto Rican phenomenon to international pop story.',
    byline:'Daegon Charts Editorial',published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"song","name":"Gasolina","artist":"Daddy Yankee","caption":"“Gasolina” — Daddy Yankee"},"secondary":{"kind":"album","name":"Barrio Fino","artist":"Daddy Yankee","caption":"Barrio Fino — Daddy Yankee"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/DaddyYankee.jpg","alt":"Daddy Yankee performing in 2006","credit":"Photo: TIP-XL / Wikimedia Commons","license":"Public domain","source":"https://commons.wikimedia.org/wiki/File:DaddyYankee.jpg","note":"Daddy Yankee performing in 2006, shortly after the global breakthrough of Barrio Fino and “Gasolina.”"},
    body:[
      '<p>By the middle of 2005, international journalists were no longer writing about reggaetón as a distant underground scene. They were explaining it to readers whose local clubs and charts were already reacting. At the center of that change was Daddy Yankee’s “Gasolina.”</p>',
      '<h2>The record arrived with a movement behind it</h2><p>A May 2005 Los Angeles Times report described reggaetón as an urgent new force in Latin popular music and identified Daddy Yankee’s <em>Barrio Fino</em> as the movement’s blockbuster. “Gasolina” functioned as the most accessible calling card: a chorus that could travel even where Spanish-language urban music was unfamiliar to mainstream radio audiences.</p>',
      '<p>By July and August, British coverage was documenting the same crossover from another direction. <em>The Guardian</em> called Daddy Yankee the first reggaetón artist breaking internationally at that scale and reported how “Gasolina” could transform a London dancefloor when played.</p>',
      '<h2>Daddy Yankee was already thinking internationally</h2><p>The 2005 reporting also matters because it shows that the crossover was not merely accidental. Daddy Yankee discussed major international collaborators and was being positioned alongside U.S. hip-hop figures while performing to huge audiences across Latin America.</p>',
      '<h2>Why 2005 matters</h2><p>Later Latin-pop breakthroughs make it easy to treat reggaetón’s global presence as inevitable. It was not. “Gasolina” belongs in chart history because it records a moment when audiences in different markets were learning the sound almost simultaneously. The charts capture the spread; contemporary journalism captures the surprise.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.latimes.com/archives/la-xpm-2005-may-02-et-reggaeton2-story.html" target="_blank" rel="noopener">Los Angeles Times, “It’s an urgent reggaeton situation” — May 2, 2005</a></li><li><a href="https://www.theguardian.com/music/2005/jul/03/popandrock.shopping" target="_blank" rel="noopener">The Observer, <em>Barrio Fino</em> review — July 2, 2005</a></li><li><a href="https://www.theguardian.com/music/2005/aug/01/popandrock" target="_blank" rel="noopener">The Guardian, “Party on” — Aug. 1, 2005</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'rbd-us-crossover-2006',
    category:'Chart Rewind',
    headline:'RBD’s 2006 U.S. arrival showed the scale of Spanish-language teen pop',
    seoTitle:'RBD in 2006: How the Mexican Group Broke Into the U.S. Market',
    socialTitle:'Tens of thousands in Los Angeles: the scale of RBD’s U.S. breakthrough',
    dek:'A contemporary Los Angeles Times report captured the group’s first major U.S. tour as both a pop phenomenon and a Latino crossover moment.',
    byline:'Daegon Charts Editorial',published:'2026-10-08',modified:'2026-10-08',image:'https://i.imgur.com/jaBZ19n.png',
    media:{"primary":{"kind":"artist","name":"RBD","artist":"RBD","caption":"RBD"},"secondary":{"kind":"album","name":"Nuestro Amor","artist":"RBD","caption":"Nuestro Amor — RBD"}},
    photo:{"url":"https://commons.wikimedia.org/wiki/Special:Redirect/file/RBD_in_Brazil_in_February_2006_01.jpg","alt":"RBD at a press conference in Brazil in February 2006","credit":"Photo: Sérgio Savarese / Wikimedia Commons","license":"CC BY 2.0","source":"https://commons.wikimedia.org/wiki/File:RBD_in_Brazil_in_February_2006_01.jpg","note":"RBD at a press conference in São Paulo, Brazil, in February 2006."},
    body:[
      '<p>RBD’s expansion into the United States in 2006 challenged a familiar assumption about crossover: that success required switching languages or softening a distinctly Latin identity. When the Mexican group opened its first U.S. tour in Los Angeles, the response was already massive.</p>',
      '<h2>A television phenomenon became a live-music phenomenon</h2><p>RBD originated through the Mexican television series <em>Rebelde</em>, but by March 2006 the scale of the audience exceeded the normal boundaries of a television tie-in. A contemporary Los Angeles Times report from the Los Angeles Memorial Coliseum described tens of thousands of fans chanting the group’s name at the opening of the U.S. tour.</p>',
      '<p>The scene is useful historical evidence because it documents the audience before later nostalgia could reshape the story. The screams, merchandise, choreography and arena-scale presentation were already part of RBD’s identity while the group was still in its original run.</p>',
      '<h2>Crossover without abandoning Spanish</h2><p>The importance of RBD in a multi-market chart history is not simply that the group became popular with Latino listeners in the United States. It is that a Spanish-language pop act could generate a mass youth phenomenon visible inside the world’s largest music market while remaining culturally tied to Mexico and Latin America.</p>',
      '<h2>Why this belongs beside U.S. and European pop stories</h2><p>Global pop history can become distorted when English-language success is treated as the only measure of international relevance. RBD’s 2006 U.S. tour offers a different kind of evidence: physical crowds, a cross-border fan culture and commercial momentum that were unmistakable even when mainstream English-language coverage treated the phenomenon as something new.</p>',
      '<div class="cb-sources"><h2>Sources</h2><ul><li><a href="https://www.latimes.com/archives/la-xpm-2006-mar-20-et-rbd20-story.html" target="_blank" rel="noopener">Los Angeles Times, “¡Viva la revolucion! — of RBD, that is” — Mar. 20, 2006</a></li></ul></div>'
    ].join('')
  },
  {
    slug:'editorial-standards',
    category:'Behind the Charts',
    headline:'How Daegon Charts investigates chart history',
    seoTitle:'How Daegon Charts Researches Music Chart History',
    socialTitle:'What does it take to investigate a chart record?',
    dek:'A look at the research rules behind historical claims, artist credits, chart continuity and source verification at Daegon Charts.',
    byline:'Daegon Charts Editorial',
    published:'2026-10-08',
    modified:'2026-10-08',
    image:'https://i.imgur.com/jaBZ19n.png',
    body:[
      '<p>A chart fact can look simple on the surface. A song is No. 1, an artist enters the Top 10 or an album returns to the ranking. Historical reporting starts after that observation: the archive has to be checked for earlier appearances, alternate credits, duplicate versions and continuity errors before a claim can be described as a record.</p>',
      '<h2>Start with a question, not a superlative</h2><p>Daegon Charts treats phrases such as “first,” “most,” “longest” and “biggest” as claims that require a complete comparison set. If the underlying period has not been checked, the wording should remain narrower: “the highest position in the current run,” for example, rather than “the biggest ever.”</p>',
      '<h2>Identity matters</h2><p>Historical chart research can be distorted by spelling variants, featured credits, remixes and duplicated recordings. Before counting entries or No. 1s, artist and title identities are normalized according to the project’s credit rules. The goal is to avoid manufacturing a record through inconsistent metadata.</p>',
      '<h2>Continuity comes before storytelling</h2><p>NEW, RE, LW, Peak and Weeks on Chart depend on the previous history of an entry. A broken weekly run can turn a continuation into a false re-entry or reset a peak. For that reason, continuity problems are treated as data-quality issues before they become editorial material.</p>',
      '<h2>Contemporary sources add context</h2><p>When an article discusses a release era, interview, performance or public statement, the preferred approach is to cite a real source from that period or clearly identify a later retrospective source. Quotation and paraphrase must remain attributable. Daegon Charts does not invent statements, anonymous insiders or reconstructed dialogue.</p>',
      '<h2>Correlation is not automatically causation</h2><p>A chart rise after an awards performance, video release or viral moment can be reported as a sequence of events. Claiming that one event caused the movement requires stronger evidence. Articles should distinguish what the ranking shows from what external reporting or direct statements establish.</p>',
      '<h2>Corrections remain part of the archive</h2><p>Historical reconstruction is subject to revision when better evidence appears. Material changes to published findings should be reflected in the article’s updated date and, where appropriate, a correction note.</p>',
      '<p class="cb-source-note">Readers can review the <a href="/methodology">methodology</a> or submit a documented correction through the <a href="/contact">contact page</a>.</p>'
    ].join('')
  }
]




let chartBeatCmsLoaded=false;
async function loadPublishedChartBeatArticles(){
  if(chartBeatCmsLoaded)return;
  chartBeatCmsLoaded=true;
  try{
    if(typeof SUPABASE_URL==='undefined'||typeof SUPABASE_KEY==='undefined')return;
    const articleUrl=SUPABASE_URL+'/rest/v1/chart_beat_articles?select=*&status=eq.published&order=published_at.desc';
    const ar=await fetch(articleUrl,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'}});
    if(!ar.ok)return;
    const rows=await ar.json();if(!Array.isArray(rows)||!rows.length)return;
    const ids=rows.map(x=>x.id).filter(Boolean);
    let sourceRows=[];
    if(ids.length){
      const sourceUrl=SUPABASE_URL+'/rest/v1/chart_beat_sources?select=*&article_id=in.('+ids.join(',')+')&order=source_date.asc';
      const sr=await fetch(sourceUrl,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'}});
      if(sr.ok)sourceRows=await sr.json();
    }
    const byArticle=new Map();
    for(const s of sourceRows||[]){const a=byArticle.get(s.article_id)||[];a.push(s);byArticle.set(s.article_id,a)}
    const cms=rows.map(x=>{
      const sources=byArticle.get(x.id)||[];
      const sourcesHtml=sources.length?'<div class="cb-sources"><h2>Sources</h2><ul>'+sources.map(s=>'<li><a href="'+escAttr(s.url)+'" target="_blank" rel="noopener">'+esc(s.publisher? s.publisher+', '+s.title : s.title)+(s.source_date?' — '+esc(s.source_date):'')+'</a></li>').join('')+'</ul></div>':'';
      return {
        cmsId:x.id,slug:x.slug,category:x.category,headline:x.headline,seoTitle:x.seo_title||x.headline,
        socialTitle:x.social_title||x.headline,dek:x.dek||'',byline:x.byline||'Daegon Charts Editorial',
        published:String(x.published_at||'').slice(0,10),modified:String(x.updated_at||x.published_at||'').slice(0,10),
        image:x.hero_image||'https://i.imgur.com/jaBZ19n.png',
        photo:x.hero_image?{url:x.hero_image,alt:x.hero_alt||x.headline,credit:x.hero_credit||'',license:x.hero_license||'',source:x.hero_source||'',note:''}:null,
        media:x.media_name?{primary:{kind:x.media_kind||'artist',name:x.media_name,artist:x.media_artist||x.media_name,caption:x.media_name}}:null,
        body:(x.body_html||'')+sourcesHtml
      };
    });
    const cmsSlugs=new Set(cms.map(x=>x.slug));
    CHART_BEAT_ARTICLES=[...cms,...CHART_BEAT_ARTICLES.filter(x=>!cmsSlugs.has(x.slug))];
  }catch(e){console.warn('Chart Beat CMS fallback',e)}
}
function cbPhotoFigure(a){
  const p=a?.photo;if(!p)return cbMediaFigure(a?.media?.primary,'cb-article-visual cb-hero-visual');
  return '<figure class="cb-article-visual cb-hero-visual cb-photo-figure">'+
    '<div class="cb-media-box"><img src="'+escAttr(p.url)+'" alt="'+escAttr(p.alt||a.headline)+'" loading="eager" referrerpolicy="no-referrer"></div>'+
    '<figcaption><span>'+esc(p.note||'')+'</span><span class="cb-photo-credit">'+esc(p.credit||'')+' · '+esc(p.license||'')+' · <a href="'+escAttr(p.source)+'" target="_blank" rel="noopener">source</a></span></figcaption>'+
  '</figure>';
}
function cbMediaFigure(m,cls='cb-article-visual'){
  if(!m)return '';
  return '<figure class="'+cls+'"><div class="cb-media-box" data-portal-image data-kind="'+escAttr(m.kind)+'" data-name="'+escAttr(m.name)+'" data-artist="'+escAttr(m.artist||m.name)+'"></div>'+(m.caption?'<figcaption>'+esc(m.caption)+'</figcaption>':'')+'</figure>';
}
async function hydrateChartBeatMetaImage(a){
  const p=a?.photo;if(p?.url){a.image=p.url;const og=document.querySelector('meta[property="og:image"]');if(og)og.content=p.url;const tw=document.querySelector('meta[name="twitter:image"]');if(tw)tw.content=p.url;const ld=document.getElementById('chartBeatArticleSchema');if(ld){try{const data=JSON.parse(ld.textContent||'{}');data.image=[p.url];ld.textContent=JSON.stringify(data)}catch{}}return}
  const m=a?.media?.primary;if(!m)return;
  try{
    const url=await resolveImage({name:m.name,artist:m.artist||m.name},{kind:m.kind});
    if(!url)return;
    a.image=url;
    const og=document.querySelector('meta[property="og:image"]');if(og)og.content=url;
    const tw=document.querySelector('meta[name="twitter:image"]');if(tw)tw.content=url;
    const ld=document.getElementById('chartBeatArticleSchema');
    if(ld){try{const data=JSON.parse(ld.textContent||'{}');data.image=[url];ld.textContent=JSON.stringify(data)}catch{}}
  }catch{}
}
function setChartBeatArticleMeta(a){
  setMeta(a.seoTitle,a.dek,'/chart-beat/'+a.slug,true);
  document.title=a.seoTitle+' | Daegon Charts';
  const ensure=(sel,tag,attrs)=>{
    let el=document.querySelector(sel);
    if(!el){el=document.createElement(tag);Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,v));document.head.appendChild(el)}
    return el;
  };
  const ogType=ensure('meta[property="og:type"]','meta',{'property':'og:type'});ogType.content='article';
  const ogImage=ensure('meta[property="og:image"]','meta',{'property':'og:image'});ogImage.content=a.image;
  const twCard=ensure('meta[name="twitter:card"]','meta',{'name':'twitter:card'});twCard.content='summary_large_image';
  const twTitle=ensure('meta[name="twitter:title"]','meta',{'name':'twitter:title'});twTitle.content=a.socialTitle||a.headline;
  const twDesc=ensure('meta[name="twitter:description"]','meta',{'name':'twitter:description'});twDesc.content=a.dek;
  const twImage=ensure('meta[name="twitter:image"]','meta',{'name':'twitter:image'});twImage.content=a.image;
  document.querySelector('meta[property="og:title"]').content=a.socialTitle||a.headline;
  document.querySelector('meta[property="og:description"]').content=a.dek;
  let ld=document.getElementById('chartBeatArticleSchema');
  if(!ld){ld=document.createElement('script');ld.type='application/ld+json';ld.id='chartBeatArticleSchema';document.head.appendChild(ld)}
  ld.textContent=JSON.stringify({
    '@context':'https://schema.org','@type':'Article',
    headline:a.headline,description:a.dek,image:[a.image],
    datePublished:a.published,dateModified:a.modified,
    author:{'@type':'Organization',name:a.byline,url:'https://daegoncharts.com.br/about'},
    publisher:{'@type':'Organization',name:'Daegon Charts',url:'https://daegoncharts.com.br/'},
    mainEntityOfPage:'https://daegoncharts.com.br/chart-beat/'+a.slug
  });
}
function clearChartBeatArticleMeta(){
  const ld=document.getElementById('chartBeatArticleSchema');if(ld)ld.remove();
  const ogType=document.querySelector('meta[property="og:type"]');if(ogType)ogType.content='website';
}
function chartBeatCard(a,lead=false){
  return '<article class="cb-card '+(lead?'cb-lead':'')+'">'+
    '<a class="cb-card-link" href="'+appHref('/chart-beat/'+a.slug)+'" data-portal-link="/chart-beat/'+a.slug+'">'+
      '<div class="cb-card-art cb-media-box" data-portal-image data-kind="'+escAttr(a?.media?.primary?.kind||'artist')+'" data-name="'+escAttr(a?.media?.primary?.name||a.headline)+'" data-artist="'+escAttr(a?.media?.primary?.artist||a?.media?.primary?.name||'')+'"></div>'+
      '<div class="cb-card-copy"><div class="cb-kicker">'+esc(a.category)+'</div><h2>'+esc(a.headline)+'</h2><p>'+esc(a.dek)+'</p>'+
      '<div class="cb-meta">By '+esc(a.byline)+' · '+fmtDate(a.published)+'</div></div>'+
    '</a></article>';
}
async function renderChartBeatHome(){
  await loadPublishedChartBeatArticles();
  clearChartBeatArticleMeta();
  const lead=CHART_BEAT_ARTICLES[0],rest=CHART_BEAT_ARTICLES.slice(1);
  const main='<main class="cb-home">'+
    '<header class="cb-mast"><div><div class="cb-eyebrow">Journalism from the archive</div><h1>Chart Beat</h1><p>Records, historical context and the stories behind the rankings.</p></div>'+
      '<div class="cb-mast-actions"><a class="cb-desk-link" href="'+appHref('/chart-beat/weekly')+'" data-portal-link="/chart-beat/weekly">Weekly Coverage →</a><a class="cb-desk-link" href="'+appHref('/chart-beat/data-desk')+'" data-portal-link="/chart-beat/data-desk">Data Desk →</a></div></header>'+
    (lead?chartBeatCard(lead,true):'')+
    (rest.length?'<section class="cb-grid">'+rest.map(a=>chartBeatCard(a)).join('')+'</section>':'')+
    '<section class="cb-sections"><h2>Coverage</h2><div class="cb-section-grid">'+
      '<div><strong>Chart Beat Weekly</strong><span>The most important chart story of the week.</span></div>'+
      '<div><strong>Chart Rewind</strong><span>Historical weeks revisited with contemporary sources.</span></div>'+
      '<div><strong>Chart Records</strong><span>Verified milestones, streaks and career achievements.</span></div>'+
      '<div><strong>Chart Analysis</strong><span>Long-form investigations across eras and markets.</span></div>'+
      '<div><strong>Ask Daegon</strong><span>Reader questions answered with archive research.</span></div>'+
      '<div><strong>Behind the Charts</strong><span>Methodology, corrections and research standards.</span></div>'+
    '</div></section>'+
  '</main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Chart Beat','Chart journalism, historical research, records and analysis from the Daegon Charts archive.','/chart-beat');bindLinks();hydratePortalImages();
}
async function renderChartBeatArticle(slug){
  await loadPublishedChartBeatArticles();
  clearChartBeatArticleMeta();
  const a=CHART_BEAT_ARTICLES.find(x=>x.slug===slug);if(!a){renderNotFound();return}
  const main='<main class="cb-article">'+
    '<a class="cb-back" href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">← Chart Beat</a>'+
    '<header><div class="cb-kicker">'+esc(a.category)+'</div><h1>'+esc(a.headline)+'</h1><p class="cb-dek">'+esc(a.dek)+'</p>'+
      '<div class="cb-byline">By <strong>'+esc(a.byline)+'</strong><br><span>Published '+fmtDate(a.published)+(a.modified!==a.published?' · Updated '+fmtDate(a.modified):'')+'</span></div>'+
    '</header>'+
    '<div class="cb-share" aria-label="Share article"><button data-copy-article><i class="fas fa-link"></i> Copy link</button><button data-save-article><i class="far fa-bookmark"></i> Save</button></div>'+
    cbPhotoFigure(a)+
    '<div class="cb-article-body">'+(a?.media?.secondary?a.body.replace('<h2>',cbMediaFigure(a.media.secondary,'cb-inline-visual')+'<h2>'):a.body)+'</div>'+
    '<footer class="cb-article-footer"><strong>Corrections & sourcing</strong><p>Source-backed corrections are welcome. Include the chart date and a reliable reference when possible.</p><a href="/contact">Contact the editorial desk →</a></footer>'+
    '<div id="dcCommentsMount" data-article-id="'+(a.cmsId||'')+'"></div>'+
  '</main>';
  setMode(true);portalEl.innerHTML=shellHtml(main);setChartBeatArticleMeta(a);bindLinks();hydratePortalImages();hydrateChartBeatMetaImage(a);
  const copy=portalEl.querySelector('[data-copy-article]');if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);copy.innerHTML='<i class="fas fa-check"></i> Link copied'}catch{}};
  const save=portalEl.querySelector('[data-save-article]');if(save&&a.cmsId){dcSyncSavedArticle(save,a.cmsId);save.onclick=()=>dcToggleSavedArticle(save,a.cmsId)}
  if(a.cmsId)dcRenderComments(a.cmsId);
}

const CHART_BEAT_DATA_ERA='2017-06-24';
function cbMetricNum(v){
  if(v===null||v===undefined)return null;
  const raw=String(v).trim();if(!raw)return null;
  const n=Number(raw.replace(/,/g,'').replace(/[^0-9.+-]/g,''));
  return Number.isFinite(n)?n:null;
}
function cbMetricDisplay(v){
  const n=cbMetricNum(v);if(n===null)return '—';
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:n>=1000?0:1}).format(n);
}
function cbEntryMap(list){const m=new Map();for(const e of list||[])m.set(itemKey(e),e);return m}
function cbHistoricalPeak(data,key,date){
  let peak=Infinity;
  for(const d of data.dates||[]){if(d>=date)break;for(const e of data.entriesByDate[d]||[])if(itemKey(e)===key)peak=Math.min(peak,Number(e.position)||999)}
  return peak;
}
function cbDistinctNo1sForArtist(data,artist,date){
  const seen=new Set(),target=creditNorm(artist);
  for(const d of data.dates||[]){if(d>date)break;for(const e of data.entriesByDate[d]||[])if(e.position===1&&creditNorm(e.artist)===target)seen.add(itemKey(e))}
  return seen.size;
}
function cbTop10sForArtist(data,artist,date){
  const seen=new Set(),target=creditNorm(artist);
  for(const d of data.dates||[]){if(d>date)break;for(const e of data.entriesByDate[d]||[])if(e.position<=10&&creditNorm(e.artist)===target)seen.add(itemKey(e))}
  return seen.size;
}
function cbLargestMetricGain(current,previous,field){
  const pm=cbEntryMap(previous),rows=[];
  for(const e of current||[]){
    const p=pm.get(itemKey(e));if(!p)continue;
    const now=cbMetricNum(e[field]),before=cbMetricNum(p[field]);
    if(now===null||before===null)continue;
    const delta=now-before;if(delta>0)rows.push({entry:e,now,before,delta,field});
  }
  return rows.sort((a,b)=>b.delta-a.delta)[0]||null;
}
function cbComponentLeader(component,date){
  if(!component)return null;
  const list=component.entriesByDate?.[date]||[];
  return list[0]||null;
}
function buildWeeklyStoryEngine(songs,date,components={}){
  const dates=songs?.dates||[],ix=dates.indexOf(date),prevDate=ix>0?dates[ix-1]:null;
  const current=songs?.entriesByDate?.[date]||[],previous=prevDate?songs.entriesByDate?.[prevDate]||[]:[];
  const prevMap=cbEntryMap(previous),leader=current[0]||null,prevLeader=previous[0]||null;
  const isDataEra=date>=CHART_BEAT_DATA_ERA;
  const debuts=current.filter(e=>e.diff==='NEW').sort((a,b)=>a.position-b.position);
  const reentries=current.filter(e=>e.diff==='RE').sort((a,b)=>a.position-b.position);
  const gainers=current.filter(e=>String(e.diff).startsWith('▲')).map(e=>({...e,move:toInt(String(e.diff).slice(1))})).sort((a,b)=>b.move-a.move||a.position-b.position);
  const newPeaks=current.filter(e=>{
    if(e.diff==='NEW')return false;
    const old=cbHistoricalPeak(songs,itemKey(e),date);
    return Number.isFinite(old)&&e.position<old;
  }).sort((a,b)=>a.position-b.position);
  const artistCounts=new Map(),albumCounts=new Map();
  for(const e of current){
    const a=String(e.artist||'').trim();if(a)artistCounts.set(a,(artistCounts.get(a)||0)+1);
    const al=String(e.album||'').trim();if(al){const k=al+'||'+a;const x=albumCounts.get(k)||{album:al,artist:a,count:0,entries:[]};x.count++;x.entries.push(e);albumCounts.set(k,x)}
  }
  const mostEntries=[...artistCounts.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
  const albumBomb=[...albumCounts.values()].filter(x=>x.count>=3).sort((a,b)=>b.count-a.count)[0]||null;
  const salesGain=isDataEra?cbLargestMetricGain(current,previous,'sales'):null;
  const streamsGain=isDataEra?cbLargestMetricGain(current,previous,'streams'):null;
  const airplayGain=isDataEra?(cbLargestMetricGain(current,previous,'airplay')||cbLargestMetricGain(current,previous,'audience')):null;
  const componentLeaders=isDataEra?{
    sales:cbComponentLeader(components.digitalSongsSales,date),
    streams:cbComponentLeader(components.streamingSongs,date),
    radio:cbComponentLeader(components.radioSongs,date)
  }:{};
  const leaderNo1s=leader?cbDistinctNo1sForArtist(songs,leader.artist,date):0;
  const leaderTop10s=leader?cbTop10sForArtist(songs,leader.artist,date):0;
  const leaderChanged=!!leader&&!!prevLeader&&itemKey(leader)!==itemKey(prevLeader);
  const headline=leader
    ? (leaderChanged
      ? esc(portalText(leader.name))+' takes No. 1 as '+esc(portalArtist(leader.artist))+' leads a changing Daegon 100'
      : esc(portalText(leader.name))+' holds No. 1 on the Daegon 100')
    :'Daegon 100 weekly briefing';
  return {date,prevDate,current,previous,leader,prevLeader,isDataEra,debuts,reentries,gainers,newPeaks,mostEntries,albumBomb,salesGain,streamsGain,airplayGain,componentLeaders,leaderNo1s,leaderTop10s,leaderChanged,headline};
}
function cbStoryMetricCard(label,x){
  if(!x)return '';
  return '<div class="cb-number-card"><span>'+esc(label)+'</span><strong>'+esc(portalText(x.entry.name))+'</strong><small>'+esc(portalArtist(x.entry.artist))+' · +'+cbMetricDisplay(x.delta)+'</small></div>';
}
function cbWeeklyStoryHtml(story){
  const L=story.leader;
  let html='<section class="cb-weekly-story">'+
    '<div class="cb-weekly-label">Weekly Story Engine · '+(story.isDataEra?'Data Era':'Archive Era')+'</div>'+
    '<h2>'+story.headline+'</h2>'+
    (L?'<p class="cb-weekly-lead"><strong>'+esc(portalText(L.name))+'</strong> by '+esc(portalArtist(L.artist))+' is No. 1 for the chart dated '+fmtDate(story.date)+'. It has spent '+(L.weeksAt1||1)+' week'+((L.weeksAt1||1)===1?'':'s')+' at No. 1 and '+(L.weeks||1)+' week'+((L.weeks||1)===1?'':'s')+' on the chart.</p>':'')+
    '<div class="cb-story-grid">'+
      '<article><div class="cb-kicker">The Big Story</div><h3>'+(story.leaderChanged?'A new leader takes over':'The No. 1 story')+'</h3><p>'+
      (L?(story.leaderChanged&&story.prevLeader
        ? '<strong>'+esc(portalText(L.name))+'</strong> replaces <strong>'+esc(portalText(story.prevLeader.name))+'</strong> at No. 1. '+esc(portalArtist(L.artist))+' now has '+story.leaderNo1s+' distinct No. 1 '+(story.leaderNo1s===1?'song':'songs')+' and '+story.leaderTop10s+' Top 10 '+(story.leaderTop10s===1?'entry':'entries')+' in the tracked Daegon 100 history through this week.'
        : '<strong>'+esc(portalText(L.name))+'</strong> remains the week’s central chart story. '+esc(portalArtist(L.artist))+' has '+story.leaderNo1s+' distinct No. 1 '+(story.leaderNo1s===1?'song':'songs')+' in the archive through this date.'):'No leader available.')+
      '</p></article>'+
      '<article><div class="cb-kicker">History Watch</div><h3>'+story.newPeaks.length+' new peak'+(story.newPeaks.length===1?'':'s')+'</h3><p>'+
      (story.newPeaks.length?story.newPeaks.slice(0,5).map(e=>'<strong>'+esc(portalText(e.name))+'</strong> (#'+e.position+')').join(' · '):'No returning entry sets a new career peak this week.')+
      '</p></article>'+
      '<article><div class="cb-kicker">New & Notable</div><h3>'+story.debuts.length+' debut'+(story.debuts.length===1?'':'s')+'</h3><p>'+
      (story.debuts.length?story.debuts.slice(0,6).map(e=>'<strong>'+esc(portalText(e.name))+'</strong> (#'+e.position+')').join(' · '):'No first-time entries this week.')+
      '</p></article>'+
      '<article><div class="cb-kicker">Rising</div><h3>'+(story.gainers[0]?'Largest climb: +'+story.gainers[0].move:'No major climb')+'</h3><p>'+
      (story.gainers[0]?'<strong>'+esc(portalText(story.gainers[0].name))+'</strong> by '+esc(portalArtist(story.gainers[0].artist))+' rises to No. '+story.gainers[0].position+'.':'No upward movement is available for this week.')+
      '</p></article>'+
    '</div>';
  if(story.isDataEra){
    html+='<section class="cb-by-numbers"><div class="cb-kicker">By the Numbers</div><h3>Sales, streaming and airplay</h3>'+
      '<div class="cb-number-grid">'+
        cbStoryMetricCard('Biggest sales gain',story.salesGain)+
        cbStoryMetricCard('Biggest streaming gain',story.streamsGain)+
        cbStoryMetricCard('Biggest airplay gain',story.airplayGain)+
        (story.componentLeaders.sales?'<div class="cb-number-card"><span>Digital Songs Sales No. 1</span><strong>'+esc(portalText(story.componentLeaders.sales.name))+'</strong><small>'+esc(portalArtist(story.componentLeaders.sales.artist))+'</small></div>':'')+
        (story.componentLeaders.streams?'<div class="cb-number-card"><span>Streaming Songs No. 1</span><strong>'+esc(portalText(story.componentLeaders.streams.name))+'</strong><small>'+esc(portalArtist(story.componentLeaders.streams.artist))+'</small></div>':'')+
        (story.componentLeaders.radio?'<div class="cb-number-card"><span>Radio Songs No. 1</span><strong>'+esc(portalText(story.componentLeaders.radio.name))+'</strong><small>'+esc(portalArtist(story.componentLeaders.radio.artist))+'</small></div>':'')+
      '</div>'+
      '<p class="cb-data-note">Component changes are calculated only when comparable numeric values are present in consecutive Daegon chart weeks. They describe the project’s stored chart data and should not be presented as third-party certified industry totals.</p></section>';
  }else{
    html+='<div class="cb-archive-note"><strong>Archive Era:</strong> sales, streaming and airplay breakdowns are intentionally omitted before '+fmtDate(CHART_BEAT_DATA_ERA)+'. Coverage is based on ranking trajectory, historical records and documented context.</div>';
  }
  if(story.albumBomb||story.mostEntries){
    html+='<section class="cb-weekly-extra"><div class="cb-kicker">Chart Density</div><h3>Multiple entries</h3><p>'+
      (story.albumBomb?'<strong>'+esc(story.albumBomb.album)+'</strong> by '+esc(portalArtist(story.albumBomb.artist))+' places '+story.albumBomb.count+' tracks on the chart. ':'')+
      (story.mostEntries?'<strong>'+esc(portalArtist(story.mostEntries[0]))+'</strong> has the most simultaneous entries this week ('+story.mostEntries[1]+').':'')+
      '</p></section>';
  }
  if(story.reentries.length)html+='<section class="cb-weekly-extra"><div class="cb-kicker">Returns</div><h3>Back on the chart</h3><p>'+story.reentries.slice(0,6).map(e=>'<strong>'+esc(portalText(e.name))+'</strong> (#'+e.position+')').join(' · ')+'</p></section>';
  return html+'</section>';
}
async function renderChartBeatWeekly(dateArg){
  clearChartBeatArticleMeta();
  loading('Chart Beat Weekly');
  const [songs,digital,streaming,radio]=await Promise.all([
    loadWeekly('songs'),
    loadWeekly('digitalSongsSales').catch(()=>null),
    loadWeekly('streamingSongs').catch(()=>null),
    loadWeekly('radioSongs').catch(()=>null)
  ]);
  const dates=songs?.dates||[];let date=dateArg&&dates.includes(dateArg)?dateArg:dates[dates.length-1];
  const draw=()=>{
    const story=buildWeeklyStoryEngine(songs,date,{digitalSongsSales:digital,streamingSongs:streaming,radioSongs:radio});
    const main='<main class="cb-weekly-page"><header class="cb-weekly-head"><a class="cb-back" href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">← Chart Beat</a><div class="cb-kicker">Weekly Coverage</div><h1>Chart Beat Weekly</h1><p>'+fmtDate(date)+'</p></header>'+
      '<div class="cb-week-picker"><label>Chart week</label><select id="cbWeeklyDate">'+[...dates].reverse().slice(0,180).map(d=>'<option value="'+escAttr(d)+'" '+(d===date?'selected':'')+'>'+fmtDate(d)+'</option>').join('')+'</select></div>'+
      cbWeeklyStoryHtml(story)+
      '<div class="cb-editorial-warning"><strong>Editorial workflow:</strong> this engine identifies potential stories and verified calculations from the Daegon archive. Historical superlatives, outside causes and quotations still require editorial research before publication as a reported article.</div>'+
    '</main>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Chart Beat Weekly — '+fmtDate(date),'Weekly Daegon 100 story briefing with chart movement, records and, from June 2017, sales, streaming and airplay analysis.','/chart-beat/weekly/'+date);bindLinks();
    const sel=document.getElementById('cbWeeklyDate');if(sel)sel.onchange=()=>{date=sel.value;history.replaceState({},'',appHref('/chart-beat/weekly/'+date));draw()};
  };draw();
}
async function renderChartBeatDataDesk(){
  clearChartBeatArticleMeta();
  loading('Weekly Data Desk');
  const ids=['songs','albums','artists','radioSongs','streamingSongs','digitalSongsSales','topStreamingAlbums','topAlbumSales'];
  const data=await Promise.all(ids.map(async id=>{try{return await loadWeekly(id)}catch{return null}}));
  let active='songs',date=(data[0]?.dates||[]).slice(-1)[0]||'';
  const draw=()=>{
    const d=data[ids.indexOf(active)],dates=[...(d?.dates||[])].reverse(),entries=d?.entriesByDate?.[date]||[],no1=entries[0],debuts=entries.filter(x=>x.diff==='NEW').slice(0,5);
    const mover=[...entries].filter(x=>String(x.diff).startsWith('▲')).sort((a,b)=>toInt(String(b.diff).slice(1))-toInt(String(a.diff).slice(1)))[0];
    const top10=entries.slice(0,10),returners=entries.filter(x=>x.diff==='RE').slice(0,5);
    const article='<article class="orig-beat-article"><div class="editorial-kicker">Automated data summary</div>'+
      '<h2>Weekly signals</h2><p>This page surfaces movements for research. It is not a reported Chart Beat article and does not make historical-record claims.</p>'+
      (no1?'<h3>No. 1</h3><p><strong>'+esc(no1.name)+'</strong> — '+esc(no1.artist||'')+'.</p>':'')+
      (top10.length?'<h3>Top 10</h3><p>'+top10.slice(0,5).map((x,i)=>(i+1)+'. <strong>'+esc(portalText(x.name))+'</strong>').join(' · ')+'</p>':'')+
      (debuts.length?'<h3>Debuts to investigate</h3><p>'+debuts.map(x=>'<strong>'+esc(portalText(x.name))+'</strong>').join(', ')+'</p>':'')+
      (returners.length?'<h3>Re-entries to investigate</h3><p>'+returners.map(x=>'<strong>'+esc(portalText(x.name))+'</strong>').join(', ')+'</p>':'')+
      (mover?'<h3>Largest upward movement</h3><p><strong>'+esc(portalText(mover.name))+'</strong> ('+esc(mover.diff)+').</p>':'')+
      '<div class="beat-method-note"><strong>Research tool:</strong> movements shown here require editorial verification before they become record or causal claims.</div></article>';
    const main='<div class="orig-beat-layout"><aside class="orig-beat-side"><a class="cb-back" href="'+appHref('/chart-beat')+'" data-portal-link="/chart-beat">← Chart Beat</a><h2>Data Desk</h2><div class="orig-beat-charts">'+ids.map(id=>'<button data-beat-chart="'+id+'" class="'+(id===active?'active':'')+'">'+esc(charts[id].title)+'</button>').join('')+'</div><h3>Weeks</h3><div class="orig-beat-weeks">'+dates.slice(0,80).map(x=>'<button data-beat-date="'+x+'" class="'+(x===date?'active':'')+'">'+fmtDate(x)+'</button>').join('')+'</div></aside><main class="orig-beat-main"><div class="orig-beat-title"><h1>Weekly Data Desk</h1><p>'+esc(charts[active].title)+' · '+fmtDate(date)+'</p></div>'+article+'</main></div>';
    setMode(true);portalEl.innerHTML=shellHtml(main);setMeta('Weekly Data Desk','Automated weekly chart movements used as a research aid by Chart Beat.','/chart-beat/data-desk');bindLinks();
    portalEl.querySelectorAll('[data-beat-chart]').forEach(b=>b.onclick=()=>{active=b.dataset.beatChart;const dd=data[ids.indexOf(active)];date=(dd?.dates||[]).slice(-1)[0]||'';draw()});
    portalEl.querySelectorAll('[data-beat-date]').forEach(b=>b.onclick=()=>{date=b.dataset.beatDate;draw()});
  };draw();
}
async function renderChartBeat(){
  const p=routeParts();
  if(p[1]==='data-desk')return renderChartBeatDataDesk();
  if(p[1]==='weekly')return renderChartBeatWeekly(p[2]||'');
  if(p[1])return renderChartBeatArticle(p[1]);
  return renderChartBeatHome();
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
  const main='<div class="orig-awards"><div class="orig-awards-bar"><a href="'+appHref('/awards')+'" class="orig-awards-logo"><i class="fas fa-trophy"></i><span>DAEGON AWARDS</span></a></div><div class="orig-awards-body"><div class="orig-awards-intro"><h2>Daegon Music Awards '+esc(year)+'</h2></div><div class="orig-award-winners">'+winners.map(w=>'<section><h3>'+esc(charts[w.id].title)+'</h3>'+w.list.map((x,i)=>'<div class="orig-record-row"><div class="orig-record-rank '+(i===0?'top':'')+'">'+(i+1)+'</div><div class="orig-record-main"><div class="orig-record-name">'+entityLink(x,w.kind)+'</div>'+(w.kind!=='artist'?'<div class="orig-record-artist">'+artistLink(x.artist||'')+'</div>':'')+'</div></div>').join('')+'</section>').join('')+'</div></div></div>';
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
    rows.innerHTML=hits.map(x=>'<div class="portal-row"><div class="portal-row-rank"><i class="fas '+iconFor(x.kind)+'"></i></div><div class="portal-row-main"><div class="portal-row-title">'+entityLink(x,x.kind)+'</div><div class="portal-row-sub">'+labelFor(x.kind)+(x.kind!=='artist'?' · '+esc(portalArtist(x.artist)):'')+'</div></div><div class="portal-row-meta">Peak #'+x.peak+' · '+x.weeks+' weeks</div></div>').join('')||'<div class="portal-empty">No results.</div>';
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
  closePortalMenu();
  ensureShell();
  const p=routeParts();
  const skeleton=routeSkeletonMeta(p);
  loading(skeleton.title,skeleton.kind);
  try{
    if(!p.length){await renderHome()}
    else if(p[0]==='news')await renderEditorialIndex('news');
    else if(p[0]==='trending')await renderTrending();
    else if(p[0]==='features')await renderEditorialIndex('features');
    else if(p[0]==='reviews')renderReviews();
    else if(p[0]==='community')renderCommunity();
    else if(p[0]==='forum'&&p[1])await renderForumTopic(p[1]);
    else if(p[0]==='forum')await renderForum();
    else if(p[0]==='plans')renderPlans();
    else if(p[0]==='my-daegon')await renderMyDaegon();
    else if(p[0]==='my-charts')await renderMyCharts();
    else if(p[0]==='ai')renderDaegonAIPage();
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
function closeMenuOnNavigationIntent(e){
  const a=e.target.closest('a[href]');
  if(!a)return;
  const href=a.getAttribute('href')||'';
  if(!href||href.startsWith('#')||href.startsWith('javascript:'))return;
  closePortalMenu();
}
function onDocumentClick(e){
  const a=e.target.closest('a');
  if(!a)return;
  const href=a.getAttribute('href')||'';
  if(!href.startsWith('/')&&!href.startsWith(basePrefix()+'/'))return;
  const raw=basePrefix()&&href.startsWith(basePrefix())?href.slice(basePrefix().length):href;
  closePortalMenu();
  if(raw.startsWith('/about')||raw.startsWith('/methodology')||raw.startsWith('/privacy')||raw.startsWith('/contact')||raw.startsWith('/terms'))return;
  if(raw.startsWith('/chart/')){
    e.preventDefault();
    history.pushState({},'',appHref(raw));
    scrollPageTop();
    activateWeeklyIfNeeded();
    setTimeout(scrollPageTop,80);
    return;
  }
  const first=raw.split('/').filter(Boolean)[0]||'';
  if(PORTAL_ROUTES.has(first)){e.preventDefault();go(raw)}
}

window.DaegonPortal={handles:isHandled,route:renderRoute,go,activateWeeklyIfNeeded};
ensureShell();
dcInitAuth();
try{
  const savedRoute=sessionStorage.getItem('dc_route');
  if(savedRoute){
    sessionStorage.removeItem('dc_route');
    const prefix=basePrefix();
    const normalized=prefix&&savedRoute.startsWith(prefix)?savedRoute.slice(prefix.length):savedRoute;
    history.replaceState({},'',appHref(normalized||'/'));
  }
}catch{}
document.addEventListener('click',closeMenuOnNavigationIntent,true);
document.addEventListener('click',onDocumentClick);
window.addEventListener('popstate',()=>{closePortalMenu();if(!activateWeeklyIfNeeded())renderRoute()});
window.addEventListener('pageshow',closePortalMenu);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)closePortalMenu()});
if(!activateWeeklyIfNeeded())renderRoute();
})();
