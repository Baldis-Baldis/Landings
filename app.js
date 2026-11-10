const T={
 cs:{title:'Kde jsem přistál',of:'z',all:'Vše',icaoOnly:'Jen ICAO letiště',slzOnly:'Jen SLZ plochy',customOnly:'Jen vlastní plochy',doneOnly:'Přistál jsem',todoOnly:'Ještě ne',icao:'ICAO letiště',slz:'SLZ / UL plocha',custom:'Vlastní / neveřejná',landed:'Přistál jsem',export:'Export zálohy',import:'Import',search:'Hledat název nebo kód (LKPR, Kunovice…)',here:'Přistál jsem tady',note:'Poznámka',saved:'Uloženo',imported:'Import hotov',importedAccount:a=>`Převedeno: přistání ${a.landings}, příznaky ${a.flags}, fotky ${a.photos}, plochy ${a.strips}`,bad:'Neplatný soubor',addTitle:'Přidat vlastní plochu',addHint:'Klepnutím na mapu umísti novou plochu, pak ji doplň.',addName:'Název plochy:',addNoName:'Přidání zrušeno – chybí název.',del:'Smazat plochu',delConfirm:'Opravdu smazat tuto vlastní plochu?',newStripDefault:'Nová plocha',shortPh:'Zkratka (např. VLAS)',descPh:'Poznámky k ploše (povrch, délka dráhy, kontakt, PPR…)',photoAdd:'+ Přidat fotku',more:'Další možnosti',aiTitle:'Dráhy a frekvence',runways:'Dráhy',freqs:'Frekvence',lit:'osvětlená',aiNote:'Jen pro informaci – zdroj OurAirports, může být neúplné nebo zastaralé. Vždy ověř v AIP / VFR příručce.',surf:{asp:'asfalt',con:'beton',grs:'tráva',grv:'štěrk',paved:'zpevněná'},mapOnly:'Jen mapa – schovat seznam',showList:'Zobrazit seznam',countries:'Země',ccTitle:'Zobrazené země',ccSearch:'Hledat zemi…',ccMine:'Moje a vybrané',ccNone:'Žádná země neodpovídá',ccClear:'Zrušit vše',ccDone:'Hotovo',ccClose:'Zavřít',ccNear:c=>`Sousedé (${c})`,ccRegionAll:'Vybrat vše',ccRegionNone:'Zrušit',ccBig:(n,mb)=>`Vybrané země mají ${n} letišť a stáhne se ${mb} MB dat. Pokračovat?`,ccNbOf:'Sousedé',ccAddAll:'Přidat vše',homeHint:'Vyberte svou domovskou zemi',homePick:'Vybrat',homeSet:'Nastavit jako domovskou zemi',homeIs:'Domovská země',homePanelHint:'Domovskou zemi nastavíte domečkem ⌂ u země.',ccRegions:{central:'Střední Evropa',west:'Západní Evropa',south:'Jižní Evropa',north:'Severní Evropa',east:'Balkán a východ'},ccHint:'Výchozí výběr je domovská země. Česká letiště jsou podle VFR příručky ŘLP ČR, ostatní z databáze OurAirports – u malých ploch můžou být neúplná.',loading:'Načítám letiště…',loadFail:'Zahraniční letiště se nepodařilo načíst',termsMenu:'Podmínky použití',termsShort:'Podmínky',aboutShort:'O aplikaci',aboutMenu:'O aplikaci',privacyShort:'Soukromí',privacyMenu:'Ochrana osobních údajů',feedback:'Napsat nám',admin:'Správa',fbHint:'Návrh, chyba nebo pochvala. Odpověď z aplikace nepřijde, pokud ji chcete, napište na support@mylandings.net.',fbSend:'Odeslat',fbClose:'Zavřít',fbThanks:'Díky, vzkaz je odeslaný.',fbLimit:'Dnes už bylo vzkazů dost, zkuste to zítra.',commReport:'Nahlásit',commReportSend:'Odeslat hlášení',commReportDetails:'Podrobnosti (nepovinné)',commReported:'Nahlášeno, děkujeme.',commAlready:'Už jste to nahlásili.',reason_spam:'Spam',reason_offensive:'Urážlivé',reason_illegal:'Nezákonné',reason_privacy:'Soukromí',reason_copyright:'Autorská práva',reason_other:'Jiné',community:'Od pilotů',commLoading:'Načítám…',commFail:'Nepodařilo se. Zkuste to znovu.',commLimit:'Limit je vyčerpaný, nebo chybí přezdívka.',commEmpty:'Zatím tu nic není.',commSignIn:'Přidávat může jen přihlášený pilot.',commUnknown:'Pilot',commYou:'Vy',commPublic:'veřejné',commPrivate:'soukromé',commHidden:'skryté správcem',commMakePublic:'Zveřejnit',commMakePrivate:'Skrýt',commDelete:'Smazat',commDeleteConfirm:'Smazat komentář?',commPlaceholder:'Komentář',commShare:'Veřejné, uvidí všichni',commSend:'Přidat',publishConfirm:'Zveřejnit? Uvidí to všichni včetně nepřihlášených, spolu s vaší přezdívkou.',photoLimit:'Dosažen limit fotek pro toto letiště',fav:'Oblíbené',want:'Chci navštívit',favOnly:'★ Oblíbené',wantOnly:'◎ Chci navštívit',removePhoto:'Odebrat fotku',storageFull:'Úložiště je plné – zkus menší fotku nebo smaž starší záznamy',syncing:'Synchronizuji…',synced:'Synchronizováno',syncErr:'Sync selhal – zkus ⟳',enet:'Nelze se spojit se serverem (offline?)',ephoto:'Fotku se nepodařilo nahrát, zkusím to znovu',readOnly:'Uloženo jen v tomto zařízení',leaveUnsent:'Některé změny se ještě neodeslaly a odhlášením se z tohoto zařízení smažou. Přesto se odhlásit?',leavePhotos:'Některé fotky se ještě nenahrály a odhlášením se z tohoto zařízení smažou. Přesto se odhlásit?',syncTitle:'Synchronizovat teď',dateFmt:d=>{const[y,m,x]=d.split('-');return`${+x}. ${+m}. ${y}`},src:'Seznam českých letišť a ploch podle VFR příručky ŘLP ČR (stav k {date}). Souřadnice, dráhy, frekvence a zahraniční letiště: OurAirports. Pouze informativní údaje – nepoužívat k navigaci ani plánování letu. Vlastní plochy si přidáváš sám.'},
 en:{title:"Where I've landed",of:'of',all:'All',icaoOnly:'ICAO airports only',slzOnly:'Ultralight airstrips only',customOnly:'Custom airstrips only',doneOnly:'Landed',todoOnly:'Not yet',icao:'ICAO airport',slz:'Ultralight airstrip',custom:'Custom / private',landed:'Landed',export:'Export backup',import:'Import',search:'Search name or code (LKPR, Kunovice…)',here:'I landed here',note:'Note',saved:'Saved',imported:'Import done',importedAccount:a=>`Added: landings ${a.landings}, flags ${a.flags}, photos ${a.photos}, airstrips ${a.strips}`,bad:'Invalid file',addTitle:'Add a custom airstrip',addHint:'Tap the map to place the new airstrip, then fill it in.',addName:'Airstrip name:',addNoName:'Cancelled – no name given.',del:'Delete airstrip',delConfirm:'Delete this custom airstrip?',newStripDefault:'New airstrip',shortPh:'Short code (e.g. VLAS)',descPh:'Notes on the airstrip (surface, runway length, contact, PPR…)',photoAdd:'+ Add photo',more:'More options',aiTitle:'Runways & frequencies',runways:'Runways',freqs:'Frequencies',lit:'lighted',aiNote:'For information only – source OurAirports, may be incomplete or outdated. Always check the AIP / VFR manual.',surf:{asp:'asphalt',con:'concrete',grs:'grass',grv:'gravel',paved:'paved'},mapOnly:'Map only – hide the list',showList:'Show the list',countries:'Countries',ccTitle:'Countries',ccSearch:'Search country…',ccMine:'Mine and selected',ccNone:'No country matches',ccClear:'Clear all',ccDone:'Done',ccClose:'Close',ccNear:c=>`Neighbours (${c})`,ccRegionAll:'Select all',ccRegionNone:'Clear',ccBig:(n,mb)=>`The selected countries have ${n} airfields and ${mb} MB of data to download. Continue?`,ccNbOf:'Neighbours',ccAddAll:'Add all',homeHint:'Choose your home country',homePick:'Choose',homeSet:'Set as home country',homeIs:'Home country',homePanelHint:'Set your home country with the house ⌂ next to it.',ccRegions:{central:'Central Europe',west:'Western Europe',south:'Southern Europe',north:'Northern Europe',east:'Balkans and east'},ccHint:'Your home country is the default selection. Czech airfields follow the ANS CR VFR Manual, others come from the OurAirports database – small airfields may be incomplete.',loading:'Loading airfields…',loadFail:'Could not load foreign airfields',termsMenu:'Terms of use',termsShort:'Terms',aboutShort:'About',aboutMenu:'About MyLandings',privacyShort:'Privacy',privacyMenu:'Privacy',feedback:'Write to us',admin:'Admin',fbHint:'An idea, a bug or praise. The app cannot reply, write to support@mylandings.net if you want an answer.',fbSend:'Send',fbClose:'Close',fbThanks:'Thanks, the message is sent.',fbLimit:'Enough messages for today, please try tomorrow.',commReport:'Report',commReportSend:'Send report',commReportDetails:'Details (optional)',commReported:'Reported, thank you.',commAlready:'You already reported this.',reason_spam:'Spam',reason_offensive:'Offensive',reason_illegal:'Illegal',reason_privacy:'Privacy',reason_copyright:'Copyright',reason_other:'Other',community:'From pilots',commLoading:'Loading…',commFail:'That failed. Please try again.',commLimit:'Limit reached, or the nickname is missing.',commEmpty:'Nothing here yet.',commSignIn:'Only signed-in pilots can add here.',commUnknown:'Pilot',commYou:'You',commPublic:'public',commPrivate:'private',commHidden:'hidden by the admin',commMakePublic:'Publish',commMakePrivate:'Hide',commDelete:'Delete',commDeleteConfirm:'Delete this comment?',commPlaceholder:'Comment',commShare:'Public, visible to everyone',commSend:'Add',publishConfirm:'Publish? Everyone will see it, including guests, together with your nickname.',photoLimit:'Photo limit reached for this airfield',fav:'Favourite',want:'Want to visit',favOnly:'★ Favourites',wantOnly:'◎ Want to visit',removePhoto:'Remove photo',storageFull:'Storage full – try a smaller photo or delete older entries',syncing:'Syncing…',synced:'Synced',syncErr:'Sync failed – tap ⟳',enet:'Cannot reach the server (offline?)',ephoto:'Could not upload a photo, will retry',readOnly:'Saved on this device only',leaveUnsent:'Some changes were not sent yet and signing out removes them from this device. Sign out anyway?',leavePhotos:'Some photos were not uploaded yet and signing out removes them from this device. Sign out anyway?',syncTitle:'Sync now',dateFmt:d=>{const[y,m,x]=d.split('-');return`${y}-${m}-${x}`},src:'List of Czech aerodromes and ultralight airstrips based on the ŘLP ČR VFR Manual (as of {date}). Coordinates, runways, frequencies and foreign aerodromes: OurAirports. For information only – not for navigation or flight planning. Custom airstrips are added by you.'}
};
let lang=localStorage.getItem('lang')||(navigator.language.startsWith('cs')?'cs':'en');
// effective date of the VFR manual the Czech list follows; shown in the menu and the map credit
const VFR_DATE='2026-09-03';
function vfrDate(style){
  const [y,m,d]=VFR_DATE.split('-').map(Number), mon=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m-1];
  return style==='cs'?d+'. '+m+'. '+y:style==='en'?d+' '+mon[0]+mon.slice(1).toLowerCase()+' '+y:String(d).padStart(2,'0')+' '+mon+' '+String(y).slice(2);
}
const t=k=>{ const v=T[lang][k]; return typeof v==='string'?v.replace('{date}',vfrDate(lang)):v; };
function applyLang(){
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-i]').forEach(e=>e.textContent=t(e.dataset.t));
  document.getElementById('q').placeholder=t('search');
  document.querySelector('#ccsheet .ccq').placeholder=t('ccSearch'); document.querySelector('#ccsheet .ccx').setAttribute('aria-label',t('ccClose')); document.querySelector('#cardsheet .csx').setAttribute('aria-label',t('ccClose'));
  document.getElementById('addbtn').title=t('addTitle');
  const mb2=document.getElementById('morebtn'); if(mb2) mb2.title=mb2.ariaLabel=t('more');
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('on',b.dataset.l===lang));
  const sb=document.getElementById('syncbtn'); sb.title=t('syncTitle'); if(lastSyncOk||!account) document.getElementById('syncst').textContent=syncLabel();
  render(); if(typeof renderCC==='function') renderCC(); if(typeof renderAuth==='function') renderAuth();
  const mb=document.getElementById('maponlybtn'); if(mb){ const on=document.getElementById('app').classList.contains('maponly'); mb.title=mb.ariaLabel=t(on?'showList':'mapOnly'); }
}
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>{lang=b.dataset.l;localStorage.setItem('lang',lang);applyLang();if(map)map.closePopup();if(cardSheet.isOpen()&&sheetA)fillSheet(sheetA);});

// Keys of the guest mode. A signed-in account gets its own copies, see useAccount.
const STATE_KEYS={KEY:'visited-cz-airfields',CKEY:'custom-airfields',PKEY:'airfield-photos',FKEY:'airfield-flags',TKEY:'sync-tombstones'};
let {KEY,CKEY,PKEY,FKEY,TKEY}=STATE_KEYS;
let visited={};
try{visited=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
let custom={};
try{custom=JSON.parse(localStorage.getItem(CKEY)||'{}')}catch(e){}
// tombstones: 'v:CODE' / 'c:CODE' -> time of deletion, kept from the old GitHub sync and harmless
let photos={};
try{photos=JSON.parse(localStorage.getItem(PKEY)||'{}')}catch(e){}
let flags={};
try{flags=JSON.parse(localStorage.getItem(FKEY)||'{}')}catch(e){}
let tomb={};
try{tomb=JSON.parse(localStorage.getItem(TKEY)||'{}')}catch(e){}
function kind(a){ return a.custom?'custom':(a.slz?'slz':'icao'); }
// --- countries: one file per country (data/countries/XX.json, list in countries.js), loaded when picked ---
// CCS is the whitelist: only its codes ever reach a URL or the page
const CCS=Object.keys(COUNTRIES).filter(c=>COUNTRIES[c].live), CCKEY='countries', HOMEKEY='home-country', HINTKEY='home-hint', ASSUMEDKEY='home-assumed';
// country with most own landings, told by the codes alone (custom strips are left out)
function topLandedCountry(){
  const n={}; let best='';
  for(const code of Object.keys(visited)){ if(!visited[code]||custom[code]) continue; const c=countryOfCode(code); if(CCS.includes(c)) n[c]=(n[c]||0)+1; }
  for(const c of CCS) if(n[c]&&(!best||n[c]>n[best])) best=c;
  return best;
}
// home country: the user's own choice, else what the stored selection, own landings or the browser language tell.
// If nothing tells, Czechia is shown for now and a hint asks; only a real choice is stored. A selection saved
// while the home country was only assumed is marked, so it never passes for a choice (selections saved by older
// versions are not marked: Czechia, their first entry, was the home country then).
let home='', homeKnown=true, storedSel=null, assumed=false;
try{ const h=localStorage.getItem(HOMEKEY); if(CCS.includes(h)) home=h; assumed=localStorage.getItem(ASSUMEDKEY)==='1'; }catch(e){}
try{ const x=JSON.parse(localStorage.getItem(CCKEY)||'null'); if(Array.isArray(x)){ storedSel=CCS.filter(c=>x.includes(c)); if(!home&&!assumed&&CCS.includes(x[0])) home=x[0]; } }catch(e){}
if(!home) home=topLandedCountry();
if(!home) home=guessHome(navigator.languages&&navigator.languages.length?[...navigator.languages]:[navigator.language||''],CCS);
if(!home){ home=CCS.includes('CZ')?'CZ':CCS[0]; homeKnown=false; }
let selCC=storedSel&&storedSel.length?storedSel:[home];
const ccData={}, ccLoading={};
function shownForeign(){ return selCC.filter(c=>ccData[c]).flatMap(c=>ccData[c]); }
function allData(){ return shownForeign().concat(Object.values(custom)); }
function refreshTotal(){ document.getElementById('tot').textContent=allData().length; }
refreshTotal();
function saveTomb(){ localStorage.setItem(TKEY,JSON.stringify(tomb)); }
function savePhotos(code){
  if(code){ if(photos[code]){ photos[code].ts=Date.now(); delete tomb['p:'+code]; } else tomb['p:'+code]=Date.now(); saveTomb(); }
  try{ localStorage.setItem(PKEY,JSON.stringify(photos)); }catch(e){ status(t('storageFull')); }
  schedulePush();
}
function saveFlags(code){
  if(code){ if(flags[code]){ flags[code].ts=Date.now(); delete tomb['f:'+code]; } else tomb['f:'+code]=Date.now(); saveTomb(); }
  localStorage.setItem(FKEY,JSON.stringify(flags)); schedulePush();
}
function toggleFlag(a,k){
  const f={...(flags[a.code]||{})}; if(f[k]) delete f[k]; else f[k]=true; delete f.ts;
  if(f.fav||f.want) flags[a.code]=f; else delete flags[a.code];
  saveFlags(a.code);
  if(k==='fav'&&f.fav&&!visited[a.code]){ set(a,{date:today(),note:''}); return; } // favourite = I have been there
  style(a); if(clustered(a)) refreshClusters(); render();
}
const MAXPH=3;
// photos: list of {url,path}; custom strips keep it on the strip (a.pics), airfields in photos[code].pics
function legacyPics(o){ return o?(o.pics||(o.photo?[{url:o.photo,...(o.photoPath?{path:o.photoPath}:{})}]:[])):[]; }
function getPics(a){ return legacyPics(a.custom?a:photos[a.code]); }
function setPics(a,list){
  if(a.custom){ a.pics=list; delete a.photo; delete a.photoPath; saveCustom(a); }
  else { if(list.length) photos[a.code]={pics:list}; else delete photos[a.code]; savePhotos(a.code); }
}
function normalizePics(){
  let ch=false;
  Object.values(custom).forEach(a=>{ if(a.photo!==undefined||a.photoPath!==undefined){ a.pics=legacyPics(a); delete a.photo; delete a.photoPath; ch=true; } });
  Object.keys(photos).forEach(c=>{ const o=photos[c]; if(!o.pics){ const l=legacyPics(o); if(l.length) photos[c]={pics:l,ts:o.ts||Date.now()}; else delete photos[c]; ch=true; } });
  return ch;
}
normalizePics();
function save(){ localStorage.setItem(KEY,JSON.stringify(visited)); saveTomb(); status(t('saved')); schedulePush(); }
function saveCustom(a){
  if(a){ a.ts=Date.now(); delete tomb['c:'+a.code]; saveTomb(); }
  try{ localStorage.setItem(CKEY,JSON.stringify(custom)); }catch(e){ status(t('storageFull')); }
  schedulePush();
}
function status(x){const s=document.getElementById('st');s.textContent=x;setTimeout(()=>{if(s.textContent===x)s.textContent=''},2500)}
function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Drawing onto a canvas and encoding again leaves all EXIF behind, including the location.
const PHOTO_SIDE=1600, THUMB_SIDE=400, PHOTO_BYTES=250*1024, THUMB_BYTES=30*1024;
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.crossOrigin='anonymous'; // keeps the canvas readable should a photo ever come from another host
    img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('img'));
    img.src=src;
  });
}
async function encodeJpeg(img,side,maxBytes){
  const scale=Math.min(1,side/Math.max(img.width,img.height));
  const c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  let blob=null;
  for(const q of [0.82,0.72,0.62,0.5,0.4]){
    blob=await new Promise(done=>c.toBlob(done,'image/jpeg',q));
    if(!blob) throw new Error('img');
    if(blob.size<=maxBytes) break;
  }
  return blob;
}
async function photoFiles(src){
  const img=await loadImage(src);
  return {full:await encodeJpeg(img,PHOTO_SIDE,PHOTO_BYTES),thumb:await encodeJpeg(img,THUMB_SIDE,THUMB_BYTES)};
}
function compressImage(file,maxW=900,quality=0.72){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('img'));
      img.onload=()=>{
        const scale=Math.min(1,maxW/img.width);
        const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
        const c=document.createElement('canvas'); c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
// keep the card as a builder function, so it is always rebuilt in the current language.
// Rebuild only after the current tap has finished: replacing the tapped button mid-click
// makes Leaflet treat it as a click on the map and close the card.
function refreshCard(a){ setTimeout(()=>{ if(cardSheet.isOpen()&&sheetA&&sheetA.code===a.code) fillSheet(a); else { const m=markers[a.code]; if(m){ m.setPopupContent(()=>popup(a)); fitPopup(m.getPopup()); } } },0); }

// The GitHub sync is gone. A token left by an old version is removed, it must not stay in the browser.
try{ localStorage.removeItem('gh-token'); }catch(e){}

// --- Sync: a signed-in account syncs with the server, a guest keeps data on this device only ---
let syncBusy=false, syncAgain=false, pushTimer=null, lastSyncOk=0;
let account=null, accountEpoch=0, accountBase=null, accountPhotos={}, photoLinks={}, stateGen=0;
function canon(o){ if(Array.isArray(o)) return '['+o.map(canon).join(',')+']'; if(o&&typeof o==='object') return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}'; return JSON.stringify(o); }
function applyState(s){
  visited=s.visited; tomb=s.tomb; photos=s.photos||{}; flags=s.flags||{};
  // update custom strips in place so open popups keep working
  Object.keys(custom).forEach(code=>{ if(!s.custom[code]){ if(cardSheet.isOpen()&&sheetA&&sheetA.code===code) cardSheet.close(); delete custom[code]; if(map&&markers[code]){ map.removeLayer(markers[code]); delete markers[code]; } } });
  Object.entries(s.custom).forEach(([code,a])=>{
    if(custom[code]){
      if(canon(custom[code])!==canon(a)){
        const o=custom[code]; Object.keys(o).forEach(k=>delete o[k]); Object.assign(o,a);
        if(markers[code]){ markers[code].setLatLng([o.lat,o.lon]); if(!isCardOpen(o)) refreshCard(o); }
      }
    } else { custom[code]=a; if(map) addMarker(a); }
  });
  localStorage.setItem(KEY,JSON.stringify(visited)); saveTomb();
  normalizePics();
  localStorage.setItem(FKEY,JSON.stringify(flags));
  try{ localStorage.setItem(PKEY,JSON.stringify(photos)); }catch(e){}
  try{ localStorage.setItem(CKEY,JSON.stringify(custom)); }catch(e){}
  allData().forEach(style),refreshClusters(); refreshTotal(); render();
}
function setSync(state,txt){
  const b=document.getElementById('syncbtn'); if(!b) return;
  b.className='sync '+state; document.getElementById('syncst').textContent=txt||''; b.title=txt||'';
}
function syncLabel(){
  if(!account) return t('readOnly');
  const d=new Date(lastSyncOk); return t('synced')+' '+d.toLocaleTimeString(lang==='cs'?'cs-CZ':'en-GB',{hour:'2-digit',minute:'2-digit'});
}
function schedulePush(){ stateGen++; if(!account) return; clearTimeout(pushTimer); pushTimer=setTimeout(syncNow,1500); }
async function syncNow(){
  if(!/^https?:/.test(location.protocol)) return;
  if(!account){ setSync('',syncLabel()); return; } // a guest has local data only and downloads nothing
  if(syncBusy){ syncAgain=true; return; }
  syncBusy=true; clearTimeout(pushTimer); setSync('busy',t('syncing'));
  const epoch=accountEpoch;
  try{
    await syncAccount(epoch);
    if(epoch===accountEpoch){ lastSyncOk=Date.now(); setSync('ok',syncLabel()); }
  }catch(e){
    console.warn('sync',e);
    const m=String(e&&e.message||e), code=(m.match(/\d{3}/)||[''])[0];
    let msg=m.startsWith('photo')?t('ephoto'):(e instanceof TypeError)?t('enet'):t('syncErr');
    setSync('err',msg+' ['+m+']');
  }
  syncBusy=false;
  if(syncAgain){ syncAgain=false; syncNow(); }
}

// --- Account sync: send what differs from the last confirmed state, then take the server's state ---
const newId=()=>crypto.randomUUID();
const accountKey=name=>'u:'+account.id+':'+name;
function saveBase(){ try{ localStorage.setItem(accountKey('sync-base'),JSON.stringify(accountBase)); localStorage.setItem(accountKey('sync-photos'),JSON.stringify(accountPhotos)); }catch(e){} }
const LINK_MS=3600000, LINK_MARGIN=600000;
async function freshPhotoLinks(rows){
  const now=Date.now(), need=rows.map(r=>r.id).filter(id=>!(photoLinks[id]&&photoLinks[id].until>now+LINK_MARGIN));
  if(need.length){
    const got=await window.backend.photoLinks(need);
    for(const id of need) photoLinks[id]={...got[id],until:now+LINK_MS};
  }
  return Object.fromEntries(rows.map(r=>[r.id,{url:photoLinks[r.id].url,thumb:photoLinks[r.id].thumb}]));
}
// The same source gives the same id, and it differs per account because photo ids are global.
async function stableId(text){
  const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(account.id+':'+text))).slice(0,16);
  b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
async function importToAccount(data){
  const {state,added}=await window.syncCore.mergeImport(data,{visited,custom,flags,photos},stableId);
  applyState({...state,tomb});
  schedulePush();
  return added;
}
// Removed here since the last sync. Runs before the rows go: a strip cannot leave while its files exist.
async function removeGonePhotos(){
  const here=window.syncCore.photoIds({custom,photos});
  for(const id of Object.keys(accountPhotos)){
    if(here[id]) continue;
    await window.backend.removePhoto(id);
    delete accountPhotos[id]; saveBase();
  }
}
// One failed photo must not stop the rest of the sync, so failures are only counted.
async function uploadWaitingPhotos(epoch){
  let failed=0;
  for(const {pic,airfield_code,custom_airfield_id} of window.syncCore.pendingPhotos({custom,photos})){
    try{
      pic.pid=pic.pid||newId(); // kept across attempts, so a retry finds its row and files
      const files=await photoFiles(pic.url);
      await window.backend.uploadPhoto({id:pic.pid,airfield_code,custom_airfield_id,...files});
      if(epoch!==accountEpoch) return failed;
      pic.id=pic.pid; accountPhotos[pic.id]=true; saveBase();
    }catch(e){ console.warn('photo',e); failed++; }
  }
  return failed;
}
async function syncAccount(epoch){
  const core=window.syncCore;
  for(let round=0;round<3;round++){
    const gen=stateGen;
    const next=core.toRows({visited,custom,flags},accountBase,newId);
    try{ localStorage.setItem(CKEY,JSON.stringify(custom)); }catch(e){} // new strips got their id
    await removeGonePhotos();
    if(epoch!==accountEpoch) return;
    const changes=core.diff(accountBase,next);
    if(!core.isEmpty(changes)){
      await window.backend.pushAccount(changes);
      if(epoch!==accountEpoch) return;
      accountBase=next; saveBase();
    }
    const failedPhotos=await uploadWaitingPhotos(epoch);
    if(epoch!==accountEpoch) return;
    const server=await window.backend.pullAccount();
    const links=await freshPhotoLinks(server.photos);
    if(epoch!==accountEpoch) return;
    if(gen!==stateGen) continue; // edited during the sync: send that first
    const s=core.fromRows(server,{visited,custom,flags,photos},newId,links);
    const cur={visited,custom:JSON.parse(JSON.stringify(custom)),flags,photos};
    if(canon({visited:s.visited,custom:s.custom,flags:s.flags,photos:s.photos})!==canon(cur)) applyState({visited:s.visited,custom:s.custom,photos:s.photos,flags:s.flags,tomb});
    accountBase=s.base; accountPhotos=s.photoIds; saveBase();
    if(failedPhotos) throw new Error('photo upload');
    return;
  }
  syncAgain=true;
}
function readState(){
  const read=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'{}'); }catch(e){ return {}; } };
  return {visited:read(KEY),custom:read(CKEY),photos:read(PKEY),flags:read(FKEY),tomb:read(TKEY)};
}
// Called by auth.js. An account starts from its own copy, the guest data stays untouched.
window.useAccount=user=>{
  if((user&&user.id)===(account&&account.id)) return;
  account=user; accountEpoch++; lastSyncOk=0; clearTimeout(pushTimer);
  ({KEY,CKEY,PKEY,FKEY,TKEY}=STATE_KEYS);
  accountBase=null; accountPhotos={}; photoLinks={};
  if(user){
    KEY=accountKey(KEY); CKEY=accountKey(CKEY); PKEY=accountKey(PKEY); FKEY=accountKey(FKEY); TKEY=accountKey(TKEY);
    try{ accountBase=JSON.parse(localStorage.getItem(accountKey('sync-base'))||'null'); accountPhotos=JSON.parse(localStorage.getItem(accountKey('sync-photos'))||'{}'); }catch(e){}
  }
  applyState(readState());
  showAccountMenu();
  syncNow();
};
// Signing out removes the account's copy from this device, so ask if that would lose anything.
window.leaveAccount=async signOut=>{
  await syncNow();
  const core=window.syncCore;
  const unsent=!core.isEmpty(core.diff(accountBase,core.toRows({visited,custom,flags},accountBase,newId)));
  const waiting=core.pendingPhotos({custom,photos}).length>0;
  if((unsent||waiting)&&!confirm(t(unsent?'leaveUnsent':'leavePhotos'))) return false;
  const prefix='u:'+account.id+':';
  await signOut();
  Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k));
  return true;
};

let map=null; const markers={};
const MAP_CREDIT='© OpenStreetMap · seznam letišť: VFR příručka ŘLP ČR (WEF '+vfrDate('wef')+') · údaje: OurAirports';
// target inside the want pin (white 9, blue 6.6, white 4.4, blue 2.2 in a 30x40 box, scaled to 24x34)
const WANT_TARGET='<circle cx="12" cy="11" r="7.2" fill="#fff"/><circle cx="12" cy="11" r="5.28" fill="#213F8F"/><circle cx="12" cy="11" r="3.52" fill="#fff"/><circle cx="12" cy="11" r="1.76" fill="#213F8F"/>';
// small want pin for the card button and the list
const WANT_ICON=`<svg class="wantic" viewBox="0 0 24 34" aria-hidden="true"><path transform="translate(1,0)" d="M11 1C5.5 1 1 5.4 1 10.9 1 18.2 11 29 11 29s10-10.8 10-18.1C21 5.4 16.5 1 11 1z" fill="url(#pinWant)" stroke="#fff" stroke-width="1.4"/>${WANT_TARGET}</svg>`;
try{
  map=L.map('map').setView([49.8,15.5],7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:MAP_CREDIT}).addTo(map);
  allData().forEach(addMarker);
  map.on('click',e=>{ if(addMode) placeCustom(e.latlng.lat,e.latlng.lng); else if(cardSheet.isOpen()) cardSheet.close(); });
  // button in the map: hide the list panel to browse the map full screen
  const MapOnly=L.Control.extend({options:{position:'topright'},onAdd(){
    const d=L.DomUtil.create('div','leaflet-bar'); const b=L.DomUtil.create('button','mapbtn',d); b.type='button'; b.id='maponlybtn';
    L.DomEvent.disableClickPropagation(d); b.onclick=()=>setMapOnly(!document.getElementById('app').classList.contains('maponly'));
    return d; }});
  new MapOnly().addTo(map);
  // the country button lives inside the map container: clicks and wheel must not reach the map
  for(const id of ['ccbar','homehint']){ const e=document.getElementById(id); L.DomEvent.disableClickPropagation(e); L.DomEvent.disableScrollPropagation(e); }
  map.on('popupopen',()=>map.getContainer().classList.add('popopen'));
  map.on('popupclose',()=>map.getContainer().classList.remove('popopen'));
  // fit again once the card has its final size (photos, buttons)
  map.on('popupopen',e=>setTimeout(()=>fitPopup(e.popup),80));
}catch(e){ document.getElementById('map').innerHTML='<p style="padding:16px;color:#5B657A">Mapu se nepodařilo načíst / Map failed to load.</p>'; }
let cluster=null;
function clusterLayer(){
  if(cluster) return cluster;
  cluster=(L.markerClusterGroup?L.markerClusterGroup({disableClusteringAtZoom:10,maxClusterRadius:45,showCoverageOnHover:false,chunkedLoading:true,
    iconCreateFunction:c=>{
      // the bubble takes the colour of the most important own airfield inside: favourite, landed, want to visit;
      // the badge counts own airfields
      const n=c.getChildCount(), ks=c.getAllChildMarkers().map(m=>pinKind({code:m._code})).filter(Boolean);
      const k=ks.includes('gold')?' fav':ks.includes('green')?' has':ks.includes('want')?' want':'';
      const sz=n<10?30:n<100?36:44;
      return L.divIcon({html:`<div class="clu${k}" style="width:${sz}px;height:${sz}px">${n}${ks.length?`<span class="clb">${ks.length}</span>`:''}</div>`,className:'',iconSize:[sz,sz]}); }})
    :L.layerGroup()).addTo(map);
  return cluster;
}
const ICON_EXPAND='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_LIST='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>';
// keep the wide (tablet/PC) layout exact: the panels fill the height under the header
function measureHeader(){ document.documentElement.style.setProperty('--hh',document.querySelector('header').offsetHeight+'px'); if(map) map.invalidateSize(); }
window.addEventListener('resize',measureHeader); window.addEventListener('orientationchange',()=>setTimeout(measureHeader,300));
function setMapOnly(on,quiet){
  const app=document.getElementById('app'); app.classList.toggle('maponly',on);
  const b=document.getElementById('maponlybtn');
  if(b){ b.innerHTML=on?ICON_LIST:ICON_EXPAND; b.title=b.ariaLabel=t(on?'showList':'mapOnly'); }
  if(!quiet) try{ localStorage.setItem('maponly',on?'1':''); }catch(e){}
  if(map) setTimeout(()=>map.invalidateSize(),50);
}
// --- runways & frequencies (in data/countries/XX.json, refreshed monthly by a GitHub Action) ---
const airInfo=Object.create(null); let aiOpen=false;
try{ aiOpen=localStorage.getItem('ai-open')==='1'; }catch(e){}
function infoHtml(a){
  const x=airInfo[a.code]; if(!x) return '';
  const fmt=n=>n==null?'?':n.toLocaleString(lang==='cs'?'cs-CZ':'en-GB');
  const rw=(x.r||[]), fq=(x.f||[]);
  const sum=[rw.map(r=>r[0]).filter(Boolean).join(', '), fq.length?fq[0][2]:''].filter(Boolean).join(' · ');
  let h=`<details class="ai"${aiOpen?' open':''}><summary>${t('aiTitle')} <small>${esc(sum)}</small></summary><div class="aib">`;
  if(rw.length) h+=`<h4>${t('runways')}</h4>`+rw.map(r=>`<div><b>${esc(r[0]||'—')}</b><span>${r[1]?fmt(r[1])+(r[2]?' × '+fmt(r[2]):'')+' m':''}${r[3]?(r[1]?', ':'')+esc(t('surf')[r[3]]||r[3]):''}${r[4]?', '+t('lit'):''}</span></div>`).join('');
  if(fq.length) h+=`<h4>${t('freqs')}</h4>`+fq.map(f=>`<div><span class="mhz">${esc(f[2])}</span><span>${esc(f[0])}${f[1]&&f[1].toUpperCase()!==f[0]?` <span class="d">${esc(f[1])}</span>`:''}</span></div>`).join('');
  return h+`<p>${t('aiNote')}</p></div></details>`;
}
// landed airfields get a small green pin, the others a ring
// pins: gold = favourite (been there), green = landed, dark blue with a target = want to visit
function pinIcon(kindPin){
  const fill=kindPin==='gold'?'pinGold':kindPin==='want'?'pinWant':'pinG';
  const inner=kindPin==='want'?WANT_TARGET:'<path transform="translate(12 11) rotate(-45) scale(.42)" d="M0-12c1.3 0 2 1.2 2 2.6V-4l9 5.4v2.4L2 1.2V6l2.8 2.2V10L0 8.6-4.8 10V8.2L-2 6V1.2l-9 2.6V1.4l9-5.4v-5.4C-2-10.8-1.3-12 0-12z" fill="#fff"/>';
  return L.divIcon({className:'pin',iconSize:[22,30],iconAnchor:[11,26],popupAnchor:[0,-24],
    html:`<svg width="22" height="30" viewBox="0 0 24 34"><ellipse cx="12" cy="31.5" rx="5" ry="1.9" fill="rgba(0,0,0,.28)"/><path transform="translate(1,0)" d="M11 1C5.5 1 1 5.4 1 10.9 1 18.2 11 29 11 29s10-10.8 10-18.1C21 5.4 16.5 1 11 1z" fill="url(#${fill})" stroke="#fff" stroke-width="1.4"/>${inner}</svg>`});
}
// a favourite means "I have been there" – it always gets the (gold) pin
function pinKind(a){ const fl=flags[a.code]||{}; return fl.fav?'gold':visited[a.code]?'green':fl.want?'want':''; }
function wantsPin(a){ return !!pinKind(a); }
function newMarker(a){
  const landed=wantsPin(a);
  const m=landed?L.marker([a.lat,a.lon],{icon:pinIcon(pinKind(a)),keyboard:false,riseOnHover:true})
                :L.circleMarker([a.lat,a.lon],{radius:kind(a)==='icao'?7:5,weight:2,bubblingMouseEvents:false});
  m._code=a.code; m._hidden=false; m._pin=landed; m._pk=pinKind(a);
  m.on('click',()=>openCard(a));
  return m;
}
// Room the desktop card must leave free at the top of the map: the country button with its chips (+ 8 px).
function popupTopRoom(){
  if(!map) return 10;
  const mr=map.getContainer().getBoundingClientRect(), bar=document.getElementById('ccbar').getBoundingClientRect();
  return bar.height?Math.max(10,Math.round(bar.bottom-mr.top)+8):10;
}
// Keep the whole desktop card in view and below the controls. Called after every change of its content
// (opening, runways and frequencies, photos, From pilots); a card taller than the map scrolls inside.
function fitPopup(pp){
  if(!map||!pp||!pp.isOpen||!pp.isOpen()) return;
  try{ pp.update(); }catch(e){}
  const c=pp.getElement(); if(!c) return;
  const mr=map.getContainer().getBoundingClientRect(), pr=c.getBoundingClientRect();
  const top=mr.top+popupTopRoom(), left=mr.left+10, right=mr.right-10, bottom=mr.bottom-10;
  let dx=0, dy=0;
  if(pr.top<top) dy=pr.top-top; else if(pr.bottom>bottom) dy=Math.min(pr.bottom-bottom,pr.top-top);
  if(pr.left<left) dx=pr.left-left; else if(pr.right>right) dx=pr.right-right;
  if(dx||dy) map.panBy([Math.round(dx),Math.round(dy)],{animate:false});
}
// The popup is bound on first use. Its own click toggle is taken off: every opening goes through openCard.
function popupOn(m,a){
  if(!m.getPopup()){
    const room=popupTopRoom();
    m.bindPopup(()=>popup(a),{maxHeight:Math.max(200,document.getElementById('map').clientHeight-room-60),autoPanPaddingTopLeft:[10,room],autoPanPaddingBottomRight:[10,10]});
    m.off('click',m._openPopup,m);
  }
  m.openPopup();
}
// every country, the home country included, goes into clusters that split up at the same zoom;
// custom strips have no country and stay single
function clustered(a){ return !!a.cc; }
function addMarker(a,batch){
  const m=newMarker(a);
  if(clustered(a)){ if(batch) batch.push(m); else clusterLayer().addLayer(m); } else m.addTo(map);
  markers[a.code]=m; style(a);
}
function swapMarker(a){
  const old=markers[a.code]; if(!old) return;
  const wasOpen=!!(old.isPopupOpen&&old.isPopupOpen()), hidden=old._hidden;
  const m=newMarker(a); m._hidden=hidden; markers[a.code]=m;
  if(clustered(a)){ const c=clusterLayer(); if(c.hasLayer(old)) c.removeLayer(old); if(!hidden) c.addLayer(m); }
  else { if(old._map) map.removeLayer(old); if(!hidden) m.addTo(map); }
  if(wasOpen&&!hidden) setTimeout(()=>{ if(m._map) popupOn(m,a); },0);
}
function showOnMap(a){
  const m=markers[a.code]; if(!map||!m) return;
  const opener=document.activeElement;
  if(cluster&&cluster.hasLayer&&cluster.hasLayer(m)){
    // above zoom 10 clusters split up; wait until the marker is really on the map, then open it
    map.setView([a.lat,a.lon],12,{animate:false});
    let n=0; const tryOpen=()=>{ if(m._map) openCard(a,opener); else if(n++<40) setTimeout(tryOpen,50); }; tryOpen();
  }
  else { map.setView([a.lat,a.lon],12,{animate:!useSheet()}); openCard(a,opener); }
}
// --- the airfield card: a popup on the map on wide screens, a sheet sliding up from below on phones ---
// Every opening goes through openCard. The sheet itself (heights, drag, history, Esc, focus) is in sheet.js.
const sheet=document.getElementById('cardsheet'), sheetBody=sheet.querySelector('.csbody');
let sheetA=null;
const cardSheet=Sheets.make(sheet,{bodyClass:'cardopen',
  focusBack:()=>map?map.getContainer():null,
  onHidden:()=>{ if(!cardSheet.isOpen()){ sheetBody.textContent=''; sheetA=null; } },
  onSettle:st=>{ if(st==='half'&&sheetA) setTimeout(()=>panAboveSheet(sheetA),230); }});
function useSheet(){ return sheetMQ.matches; }
function isCardOpen(a){ if(cardSheet.isOpen()&&sheetA&&sheetA.code===a.code) return true; const m=markers[a.code]; return !!(m&&m.isPopupOpen&&m.isPopupOpen()); }
function openCard(a,opener){
  const m=markers[a.code];
  if(!useSheet()){ if(m&&m._map) popupOn(m,a); return; }
  if(map) map.closePopup();
  openSheet(a,opener);
}
function cardMeta(a){
  if(a.custom) return a.short||'';
  return [a.code,a.town,a.elev?a.elev+' ft':'',a.cc&&a.cc!==home&&COUNTRIES[a.cc]?ccName(a.cc):''].filter(Boolean).join(' · ');
}
function fillSheet(a){
  const top=sheetBody.scrollTop;
  sheet.querySelector('#cstitle').textContent=a.name;
  sheet.querySelector('.csmeta').textContent=cardMeta(a);
  sheetBody.textContent=''; sheetBody.appendChild(popup(a));
  sheetBody.scrollTop=top;
}
// keep the airfield visible in the strip of map above the sheet
function panAboveSheet(a){
  if(!map) return;
  const mr=map.getContainer().getBoundingClientRect(), top=window.innerHeight-sheet.getBoundingClientRect().height;
  const visBottom=Math.min(mr.bottom,top); if(visBottom-mr.top<60) return;
  const p=map.latLngToContainerPoint([a.lat,a.lon]);
  map.panBy([p.x-mr.width/2,p.y-(visBottom-mr.top)/2],{animate:true});
}
function openSheet(a,opener){
  const again=cardSheet.isOpen();
  sheetA=a; fillSheet(a); if(again) sheetBody.scrollTop=0;
  cardSheet.show(opener);
  setTimeout(()=>panAboveSheet(a),230);
}
// crossing the breakpoint (rotating the phone) moves an open card between the sheet and the popup
sheetMQ.addEventListener('change',()=>{
  if(useSheet()){ if(!map) return; const m=Object.values(markers).find(x=>x.isPopupOpen&&x.isPopupOpen()); if(!m) return; const a=allData().find(x=>x.code===m._code); map.closePopup(); if(a) openSheet(a,null); }
  else if(cardSheet.isOpen()&&sheetA){ const a=sheetA; cardSheet.close(); const m=markers[a.code]; if(m&&m._map) popupOn(m,a); }
});
sheet.querySelector('.csattr').textContent=(typeof MAP_CREDIT==='string'?'Leaflet | '+MAP_CREDIT:'');
function dropMarker(code){
  const m=markers[code]; if(!m) return;
  if(cluster&&cluster.hasLayer&&cluster.hasLayer(m)) cluster.removeLayer(m); else if(m._map) map.removeLayer(m);
  delete markers[code];
}
// after the home country changes, markers move between the map and the clusters
function dropCountryMarkers(){ for(const c of Object.keys(ccData)) ccData[c].forEach(a=>dropMarker(a.code)); }
function syncForeignMarkers(){
  if(!map) return;
  const add=[];
  for(const c of Object.keys(ccData)){
    const want=selCC.includes(c);
    ccData[c].forEach(a=>{
      const has=!!markers[a.code];
      if(want&&!has) addMarker(a,add);
      if(!want&&has) dropMarker(a.code);
    });
  }
  if(add.length){ const c=clusterLayer(); c.addLayers?c.addLayers(add):add.forEach(m=>c.addLayer(m)); }
}
// one file per country: its airfields and their runways and frequencies
function loadCountry(c){
  if(!CCS.includes(c)) return Promise.reject(new Error('unknown country'));
  if(!ccLoading[c]) ccLoading[c]=fetch('data/countries/'+c+'.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(j=>{
      ccData[c]=(Array.isArray(j.airports)?j.airports:[]).filter(a=>a&&a.cc===c&&typeof a.code==='string');
      if(j.info&&typeof j.info==='object') Object.assign(airInfo,j.info);
    }).catch(e=>{ delete ccLoading[c]; throw e; });
  return ccLoading[c];
}
let ccIndex=null, ccIndexLoading=null;
function loadCCIndex(){
  if(!ccIndexLoading) ccIndexLoading=fetch('data/countries/index.json').then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(j=>{ ccIndex={countries:j.countries||{},exceptions:j.exceptions||{}}; }).catch(e=>{ ccIndexLoading=null; throw e; });
  return ccIndexLoading;
}
async function applyCountries(){
  try{ localStorage.setItem(CCKEY,JSON.stringify(selCC)); if(!homeKnown) localStorage.setItem(ASSUMEDKEY,'1'); }catch(e){}
  const need=selCC.filter(c=>!ccData[c]);
  if(need.length){
    status(t('loading'));
    const res=await Promise.allSettled(need.map(loadCountry));
    status(res.some(r=>r.status==='rejected')?t('loadFail'):'');
  }
  syncForeignMarkers(); allData().forEach(style); refreshClusters(); refreshTotal(); render(); renderCC(); renderHomeHint();
}
// --- country picker: button with chips on the map, panel (bottom sheet on phones, floating window on desktop) ---
const ccBtn=document.getElementById('ccbtn'), ccChips=document.getElementById('ccchips'), ccSheet=document.getElementById('ccsheet'), ccBack=document.getElementById('ccback');
// the same sheet as the card on phones, a floating window on wide screens; a tap outside closes it
const ccPanel=Sheets.make(ccSheet,{window:true,bodyClass:'ccopen',focusBack:()=>ccBtn,onOpen:()=>{ ccBack.hidden=false; },onClose:()=>{ ccBack.hidden=true; }});
const ccList=ccSheet.querySelector('.cclist'), ccQ=ccSheet.querySelector('.ccq'), ccPicks=ccSheet.querySelector('.ccpicks');
let ccTop=[], ccOffer='';
const ccOpen=new Set(); // regions left open while the panel redraws
const ccName=c=>COUNTRIES[c][lang==='cs'?'cs':'en'];
const fold=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
// landings per country; codes tell their country (or are listed in the index), custom strips are left out
function landingsByCountry(){
  const out={};
  for(const code of Object.keys(visited)){
    if(!visited[code]||custom[code]) continue;
    const c=countryOfCode(code,ccIndex&&ccIndex.exceptions);
    if(c) out[c]=(out[c]||0)+1;
  }
  return out;
}
function el(tag,cls,text){ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function addCountries(list){ selCC=CCS.filter(x=>selCC.includes(x)||list.includes(x)); applyCountries(); }
// a region can mean a lot of data: above 1 MB not downloaded yet, ask first (sizes come from index.json)
const BIG_DOWNLOAD=1024*1024;
function downloadSize(list){
  let n=0, bytes=0;
  for(const c of list){ if(ccData[c]||!ccIndex||!ccIndex.countries[c]) continue; n+=ccIndex.countries[c].n||0; bytes+=ccIndex.countries[c].bytes||0; }
  return {n,bytes};
}
async function selectRegion(list){
  if(!ccIndex){ try{ await loadCCIndex(); }catch(e){} }
  const {n,bytes}=downloadSize(list);
  if(bytes>BIG_DOWNLOAD&&!confirm(t('ccBig')(n.toLocaleString(lang==='cs'?'cs-CZ':'en-GB'),(bytes/1048576).toFixed(1)))) return;
  addCountries(list);
}
// clearing a region keeps at least one country: the home country when nothing else is left
function clearRegion(list){ selCC=CCS.filter(x=>selCC.includes(x)&&!list.includes(x)); if(!selCC.length) selCC=[home]; ccOffer=''; applyCountries(); }
function setHome(c){
  if(!CCS.includes(c)) return;
  home=c; homeKnown=true; try{ localStorage.setItem(HOMEKEY,c); localStorage.removeItem(ASSUMEDKEY); }catch(e){}
  dropCountryMarkers();
  if(!selCC.includes(c)) selCC=CCS.filter(x=>selCC.includes(x)||x===c);
  applyCountries();
}
// row: checkbox, code, name, own landings, airfield count, house to make it the home country.
// The last selected country cannot be switched off.
function ccRow(c,mine){
  const f=document.createDocumentFragment(), row=el('div','ccrow'+(c===home&&homeKnown?' home':'')), lab=el('label','cclab');
  const i=el('input'); i.type='checkbox'; i.name='cc'; i.value=c; i.checked=selCC.includes(c); i.disabled=i.checked&&selCC.length===1;
  i.onchange=()=>{ const on=i.checked; selCC=CCS.filter(x=>x===c?on:selCC.includes(x)); if(!selCC.length) selCC=[c]; ccOffer=on?c:''; applyCountries(); };
  lab.append(i,el('span','cccode',c),el('span','ccname',ccName(c)));
  if(mine[c]) lab.append(el('span','ccmine','✓ '+mine[c]));
  const n=ccIndex&&ccIndex.countries[c]?ccIndex.countries[c].n:'';
  lab.append(el('span','ccn',n===''?'':String(n)));
  const h=el('button','cchome','⌂'); h.type='button';
  h.title=t(c===home&&homeKnown?'homeIs':'homeSet'); h.setAttribute('aria-label',h.title+': '+ccName(c)); h.setAttribute('aria-pressed',String(c===home&&homeKnown));
  h.onclick=()=>setHome(c);
  row.append(lab,h); f.append(row);
  // just switched on: offer its neighbours that are not shown yet
  if(ccOffer===c){
    const nb=(COUNTRY_NEIGHBOURS[c]||[]).filter(x=>CCS.includes(x)&&!selCC.includes(x));
    if(nb.length){
      const d=el('div','ccoffer'); d.append(el('span',null,t('ccNbOf')+' ('+ccName(c)+'):'));
      nb.forEach(x=>{ const b=el('button','ccadd','+ '+x); b.type='button'; b.title=ccName(x); b.onclick=()=>addCountries([x]); d.append(b); });
      if(nb.length>1){ const all=el('button','ccadd all',t('ccAddAll')); all.type='button'; all.onclick=()=>addCountries(nb); d.append(all); }
      f.append(d);
    }
  }
  return f;
}
function renderCCList(){
  const mine=landingsByCountry(), q=fold(ccQ.value.trim());
  ccList.textContent='';
  if(q){
    const hits=CCS.filter(c=>fold(c+' '+COUNTRIES[c].cs+' '+COUNTRIES[c].en).includes(q));
    if(!hits.length) ccList.append(el('p','ccnone',t('ccNone')));
    hits.forEach(c=>ccList.append(ccRow(c,mine)));
    return;
  }
  if(ccTop.length){ ccList.append(el('h4','ccsec',t('ccMine'))); ccTop.forEach(c=>ccList.append(ccRow(c,mine))); }
  // neighbours of the home country first, all of them (also the ones already shown above); a country may then
  // appear twice, every row reads the same selection, so the checkboxes always agree
  const near=nearCountries();
  if(near.length) ccList.append(ccGroup('near',t('ccNear')(ccName(home)),near,near,mine));
  for(const r of COUNTRY_REGIONS){
    const cs=CCS.filter(c=>COUNTRIES[c].r===r&&!ccTop.includes(c)); if(!cs.length) continue;
    ccList.append(ccGroup(r,t('ccRegions')[r],cs,CCS.filter(c=>COUNTRIES[c].r===r),mine));
  }
}
// land neighbours of the home country that have data
function nearCountries(){ return (COUNTRY_NEIGHBOURS[home]||[]).filter(c=>CCS.includes(c)); }
// a group with select all / clear for every country in it (all), showing the rows in shown
function ccGroup(key,title,shown,all,mine){
  const d=el('details','ccgrp'+(key==='near'?' near':'')), s=el('summary',null,title+' ');
  d.dataset.group=key;
  d.open=ccOpen.has(key); d.addEventListener('toggle',()=>{ if(d.open) ccOpen.add(key); else ccOpen.delete(key); });
  s.append(el('small',null,String(shown.length)));
  // the buttons live in the summary, so they must not open or close the group
  const acts=el('span','ccracts'), ra=el('button','ccract',t('ccRegionAll')), rn=el('button','ccract',t('ccRegionNone')); ra.type=rn.type='button';
  ra.onclick=e=>{ e.preventDefault(); e.stopPropagation(); selectRegion(all); };
  rn.onclick=e=>{ e.preventDefault(); e.stopPropagation(); clearRegion(all); };
  acts.append(ra,rn); s.append(acts);
  d.append(s); shown.forEach(c=>d.append(ccRow(c,mine)));
  return d;
}
function renderCCPicks(){
  ccPicks.textContent='';
  const none=el('button','ccpick clear',t('ccClear')); none.type='button';
  none.onclick=()=>{ selCC=[home]; ccOffer=''; applyCountries(); };
  ccPicks.append(none);
}
function renderCC(){
  ccBtn.textContent='🌍 '+t('countries')+' ▾'; ccBtn.title=t('countries')+': '+selCC.join(', ');
  ccChips.textContent='';
  selCC.slice(0,4).forEach(c=>ccChips.append(el('span','ccchip'+(c===home&&homeKnown?' home':''),c)));
  if(selCC.length>4) ccChips.append(el('span','ccchip more','+'+(selCC.length-4)));
  if(ccPanel.isOpen()){ ccSheet.querySelector('.cchomehint').hidden=homeKnown; renderCCPicks(); renderCCList(); }
}
// a quiet hint on the map while the home country is only assumed; closing it is remembered
const homeHint=document.getElementById('homehint');
function renderHomeHint(){
  let closed=false; try{ closed=localStorage.getItem(HINTKEY)==='closed'; }catch(e){}
  homeHint.hidden=homeKnown||closed;
}
homeHint.querySelector('.hhpick').onclick=()=>openCC();
homeHint.querySelector('.hhx').onclick=()=>{ try{ localStorage.setItem(HINTKEY,'closed'); }catch(e){} homeHint.hidden=true; };
function openCC(){
  const mine=landingsByCountry();
  ccTop=CCS.filter(c=>c===home||selCC.includes(c)||mine[c]); ccOffer=''; ccOpen.clear(); ccOpen.add('near');
  ccQ.value=''; ccPanel.show(document.activeElement);
  renderCC();
  if(!ccIndex) loadCCIndex().then(()=>{ if(ccPanel.isOpen()){ ccTop=CCS.filter(c=>c===home||selCC.includes(c)||landingsByCountry()[c]); renderCCList(); } }).catch(()=>{});
}
function closeCC(){ ccPanel.close(); }
ccBtn.onclick=openCC; ccChips.onclick=openCC;
ccQ.oninput=renderCCList;
// typing a country: the sheet takes the full height, so the keyboard cannot hide the list
ccQ.addEventListener('focus',()=>ccPanel.expand());
ccBack.onclick=closeCC;
ccSheet.querySelector('.ccdone').onclick=closeCC;
function style(a){
  let m=markers[a.code]; if(!m) return;
  const v=visited[a.code], colors={icao:'#C4177C',slz:'#2C64B5',custom:'#8A5A2B'};
  const fl=flags[a.code]||{};
  if(m._pin!==wantsPin(a)){ swapMarker(a); m=markers[a.code]; }
  if(m._pin){ const k=pinKind(a); if(m._pk!==k){ m._pk=k; m.setIcon(pinIcon(k)); } return; }
  m.setStyle({color:colors[kind(a)],fillColor:'#fff',fillOpacity:.9,weight:2});
}
// cluster bubbles turn green when they contain a landed airfield – recompute after changes
function refreshClusters(){ if(cluster&&cluster.refreshClusters) cluster.refreshClusters(); }
const today=()=>new Date().toISOString().slice(0,10);
function popup(a){
  const v=visited[a.code]||{}, isCustom=!!a.custom;
  const d=document.createElement('div');d.className='pop'+(isCustom?' custom':'');
  let html='';
  html+= isCustom ? `<input type="text" name="cname" class="cname" value="${esc(a.name)}" placeholder="${esc(t('addName'))}">` : `<b>${esc(a.name)}</b>`;
  html+= isCustom ? `<input type="text" name="cshort" class="cshort" maxlength="8" value="${esc(a.short||'')}" placeholder="${esc(t('shortPh'))}">`
                  : `<div class="m">${esc(a.code)}${a.town?' · '+esc(a.town):''}${a.elev?' · '+esc(String(a.elev))+' ft':''}${a.cc&&a.cc!==home&&COUNTRIES[a.cc]?' · '+ccName(a.cc):''}</div>`;
  const fl=flags[a.code]||{};
  html+=`<div class="flags"><button type="button" class="flag fav${fl.fav?' on':''}">${fl.fav?'★':'☆'} ${t('fav')}</button><button type="button" class="flag want${fl.want?' on':''}">${WANT_ICON} ${t('want')}</button></div>`;
  if(!isCustom) html+=infoHtml(a);
  if(isCustom) html+=`<textarea name="cdesc" class="cdesc" placeholder="${esc(t('descPh'))}">${esc(a.desc||'')}</textarea>`;
  const pics=getPics(a);
  const canShare=p=>account&&!isCustom&&p.id; // a strip stays private, the database refuses it too
  if(pics.length) html+=`<div class="gal">${pics.map((p,i)=>`<div><img src="${esc(p.thumb||p.url)}" data-i="${i}" alt="">${canShare(p)?`<button type="button" class="pubpic${p.pub?' on':''}" data-i="${i}" title="${esc(t(p.pub?'commPublic':'commPrivate'))}">${p.pub?'🌐':'🔒'}</button>`:''}<button type="button" class="rmpic" data-i="${i}" title="${esc(t('removePhoto'))}">×</button></div>`).join('')}</div>`;
  // a button in the app's style; the file input stays inside it, invisible but focusable, for keyboard and screen readers.
  // The limit shows only once it is reached.
  html+= pics.length<MAXPH ? `<label class="addphoto">${t('photoAdd')}<input type="file" name="cphoto" accept="image/*" multiple class="cphoto"></label>`
                           : `<div class="photolimit">${t('photoLimit')}</div>`;
  html+=`<label><input type="checkbox" name="landed" class="landed-cb" ${v.date!==undefined?'checked':''}> ${t('here')}</label>
  <input type="date" name="landed-date" class="landed-date" value="${esc(v.date||'')}"><input type="text" name="landed-note" class="landed-note" placeholder="${esc(t('note'))}" value="${esc(v.note||'')}">`;
  d.innerHTML=html;
  const fit=()=>fitPopup(markers[a.code]&&markers[a.code].getPopup());
  if(!isCustom){
    const sec=window.community.section(a.code,{t,signedIn:()=>!!account,onResize:fit,openPhoto:openLightbox});
    // The section swaps elements while handling a click. Leaflet then finds no card above the removed
    // element, takes it for a click on the map and closes the card, so the click must stop here.
    sec.addEventListener('click',e=>e.stopPropagation());
    d.appendChild(sec);
  }
  if(!isCustom&&!airInfo[a.code]&&CCS.includes(a.cc)&&!ccLoading[a.cc]) loadCountry(a.cc).then(()=>{ if(airInfo[a.code]&&isCardOpen(a)) refreshCard(a); }).catch(()=>{});
  const det=d.querySelector('details.ai');
  if(det) det.addEventListener('toggle',()=>{
    if(det.open===aiOpen) return; // the browser also fires 'toggle' when a card is built already open
    aiOpen=det.open; try{ localStorage.setItem('ai-open',aiOpen?'1':''); }catch(e){}
    fit();
  });
  const cb=d.querySelector('.landed-cb'), dt=d.querySelector('.landed-date'), nt=d.querySelector('.landed-note');
  cb.onchange=()=>{ if(cb.checked){ if(!dt.value) dt.value=today(); set(a,{date:dt.value,note:nt.value}); } else set(a,null); };
  dt.onchange=nt.onchange=()=>{ if(cb.checked) set(a,{date:dt.value,note:nt.value}); };
  if(isCustom){
    const nameInp=d.querySelector('.cname');
    nameInp.onchange=()=>{ a.name=nameInp.value.trim()||t('newStripDefault'); saveCustom(a); render(); };
    const shortInp=d.querySelector('.cshort');
    shortInp.onchange=()=>{ a.short=shortInp.value.trim().toUpperCase(); saveCustom(a); render(); };
    const descInp=d.querySelector('.cdesc');
    descInp.onchange=()=>{ a.desc=descInp.value; saveCustom(a); };
    const del=document.createElement('button'); del.type='button'; del.className='del'; del.textContent=t('del');
    del.onclick=()=>{ if(confirm(t('delConfirm'))) deleteCustom(a); };
    d.appendChild(del);
  }
  d.querySelector('.flag.fav').onclick=()=>{ toggleFlag(a,'fav'); refreshCard(a); };
  d.querySelector('.flag.want').onclick=()=>{ toggleFlag(a,'want'); refreshCard(a); };
  const fileInp=d.querySelector('.cphoto');
  if(fileInp) fileInp.onchange=async()=>{
    const files=[...fileInp.files].slice(0,MAXPH-getPics(a).length); if(!files.length) return;
    for(const f of files){
      try{
        const durl=await compressImage(f,account?1600:undefined,account?0.8:undefined);
        const pic={url:durl};
        const cur=getPics(a); if(cur.length>=MAXPH) break;
        setPics(a,[...cur,pic]);
      }catch(err){ status(t('bad')); }
    }
    refreshCard(a); render();
  };
  d.querySelectorAll('.gal img').forEach(img=>{ img.onclick=()=>openLightbox(getPics(a).map(p=>p.url),+img.dataset.i); img.addEventListener('load',fit); });
  d.querySelectorAll('.pubpic').forEach(b=>b.onclick=async()=>{
    const cur=getPics(a), p=cur[+b.dataset.i]; if(!p) return;
    if(!p.pub&&!confirm(t('publishConfirm'))) return;
    try{
      await window.backend.setPhotoPublic(p.id,!p.pub);
      const {pub,...rest}=p;
      setPics(a,cur.map(x=>x===p?(pub?rest:{...rest,pub:true}):x));
      refreshCard(a);
    }catch(e){ console.warn('share',e); status(t(e&&e.code==='P0001'?'commLimit':'commFail')); }
  });
  d.querySelectorAll('.rmpic').forEach(b=>b.onclick=()=>{
    const cur=getPics(a), i=+b.dataset.i, gone=cur[i]; if(!gone) return;
    setPics(a,cur.filter((_,j)=>j!==i));
    refreshCard(a); render();
  });
  return d;
}
const lb=document.getElementById('lightbox');
let lbList=[], lbIdx=0;
function lbShow(){ lb.querySelector('img').src=lbList[lbIdx]; lb.querySelector('.lbcnt').textContent=lbList.length>1?`${lbIdx+1} / ${lbList.length}`:''; lb.classList.toggle('multi',lbList.length>1); }
function openLightbox(list,i=0){ lbList=Array.isArray(list)?list:[list]; lbIdx=i; lbShow(); lb.classList.add('on'); }
function lbStep(n){ if(lbList.length<2) return; lbIdx=(lbIdx+n+lbList.length)%lbList.length; lbShow(); }
function closeLightbox(){ lb.classList.remove('on'); }
lb.onclick=closeLightbox;
lb.querySelector('.lbprev').onclick=e=>{ e.stopPropagation(); lbStep(-1); };
lb.querySelector('.lbnext').onclick=e=>{ e.stopPropagation(); lbStep(1); };
let lbX=null;
lb.addEventListener('touchstart',e=>{ lbX=e.touches[0].clientX; },{passive:true});
lb.addEventListener('touchend',e=>{ if(lbX===null) return; const dx=e.changedTouches[0].clientX-lbX; lbX=null; if(Math.abs(dx)>40){ e.preventDefault(); lbStep(dx<0?1:-1); } });
document.addEventListener('keydown',e=>{ if(!lb.classList.contains('on')) return; if(e.key==='Escape') closeLightbox(); if(e.key==='ArrowRight') lbStep(1); if(e.key==='ArrowLeft') lbStep(-1); });
function set(a,val){
  if(val){ val.ts=Date.now(); visited[a.code]=val; delete tomb['v:'+a.code]; }
  else {
    delete visited[a.code]; tomb['v:'+a.code]=Date.now();
    const fl=flags[a.code]; if(fl&&fl.fav){ const f={...fl}; delete f.fav; delete f.ts; if(f.want) flags[a.code]=f; else delete flags[a.code]; saveFlags(a.code); }
  }
  style(a); if(clustered(a)) refreshClusters(); render(); save();
}

let addMode=false;
const addBtn=document.getElementById('addbtn'), addHint=document.getElementById('addhint');
addBtn.onclick=()=>{
  addMode=!addMode;
  addBtn.classList.toggle('on',addMode);
  addHint.style.display=addMode?'block':'none';
  document.getElementById('map').classList.toggle('addmode',addMode);
};
function placeCustom(lat,lon){
  const code='C'+Date.now().toString(36).toUpperCase();
  const a={code,name:t('newStripDefault'),lat:Math.round(lat*100000)/100000,lon:Math.round(lon*100000)/100000,elev:'',town:'',custom:true,desc:'',pics:[]};
  custom[code]=a; saveCustom(a); refreshTotal();
  if(!['all','custom','todo'].includes(f.value)) f.value='all'; // a new strip must stay visible on the map
  if(map){ addMarker(a); map.setView([lat,lon],13); openCard(a); }
  addMode=false; addBtn.classList.remove('on'); addHint.style.display='none';
  document.getElementById('map').classList.remove('addmode');
  render();
}
function deleteCustom(a){
  const now=Date.now();
  delete custom[a.code]; tomb['c:'+a.code]=now;
  if(visited[a.code]){ delete visited[a.code]; tomb['v:'+a.code]=now; }
  if(flags[a.code]){ delete flags[a.code]; tomb['f:'+a.code]=now; localStorage.setItem(FKEY,JSON.stringify(flags)); }
  saveCustom(); save();
  if(cardSheet.isOpen()&&sheetA&&sheetA.code===a.code) cardSheet.close();
  if(map&&markers[a.code]){ map.removeLayer(markers[a.code]); delete markers[a.code]; }
  refreshTotal(); render();
}

const list=document.getElementById('list'), q=document.getElementById('q'), f=document.getElementById('f');
q.oninput=render;
f.onchange=()=>{
  render();
  // zoom the map to what the filter shows
  if(!map||f.value==='all') return;
  const pts=allData().filter(a=>matchesFilter(a,f.value)).map(a=>[a.lat,a.lon]);
  if(pts.length) map.fitBounds(pts,{padding:[30,30],maxZoom:10});
};
function matchesFilter(a,mode){
  const k=kind(a);
  if(mode==='icao')return k==='icao'; if(mode==='slz')return k==='slz'; if(mode==='custom')return k==='custom';
  if(mode==='done')return !!visited[a.code]; if(mode==='todo')return !visited[a.code];
  if(mode==='fav')return !!(flags[a.code]||{}).fav; if(mode==='want')return !!(flags[a.code]||{}).want; return true;
}
// the map shows only what the filter selects (search text filters just the list)
function applyMapFilter(data,mode){
  if(!map) return;
  const addC=[], remC=[];
  data.forEach(a=>{
    const m=markers[a.code]; if(!m) return;
    const show=matchesFilter(a,mode); if(m._hidden===!show) return;
    m._hidden=!show;
    if(clustered(a)){ (show?addC:remC).push(m); }
    else if(show) m.addTo(map); else map.removeLayer(m);
  });
  if(cluster){
    if(remC.length) cluster.removeLayers?cluster.removeLayers(remC):remC.forEach(m=>cluster.removeLayer(m));
    if(addC.length) cluster.addLayers?cluster.addLayers(addC):addC.forEach(m=>cluster.addLayer(m));
  }
}
// The list draws in chunks: thousands of rows at once (Germany, France and Britain together are over 3000)
// make every change slow on a phone. More rows come as the list scrolls; search, filter and count use all data.
const LIST_CHUNK=200;
let listRows=[], listShown=0, listKey='';
// near the end of the list (600 px) the next chunk is drawn
list.addEventListener('scroll',()=>{ if(listShown<listRows.length&&list.scrollTop+list.clientHeight>list.scrollHeight-600) moreRows(LIST_CHUNK); },{passive:true});
function listRow(a){
    const v=visited[a.code], k=kind(a);
    const r=document.createElement('div');r.className='row'+(v?' done':'');
    r.innerHTML=`<input type="checkbox" name="visited" ${v?'checked':''}><div><div class="name">${esc(a.name)}${(flags[a.code]||{}).fav?'<span class="ic fav">★</span>':''}${(flags[a.code]||{}).want?'<span class="ic want">'+WANT_ICON+'</span>':''}</div><div class="meta">${a.cc&&a.cc!==home?`<span class="cc">${esc(a.cc)}</span>`:''}<span class="code ${k}">${k==='custom'?esc(a.short||'—'):esc(a.code)}</span> ${esc(a.town||'')}${getPics(a).length?' 📷'+(getPics(a).length>1?getPics(a).length:''):''}</div></div><div class="date">${v&&v.date?esc(t('dateFmt')(String(v.date))):''}</div>`;
    const cb=r.querySelector('input');
    cb.onclick=e=>{e.stopPropagation(); cb.checked?set(a,{date:today(),note:''}):set(a,null);};
    r.onclick=()=>showOnMap(a);
    return r;
}
function moreRows(n){
  const end=Math.min(listRows.length,listShown+n), frag=document.createDocumentFragment();
  for(let i=listShown;i<end;i++) frag.appendChild(listRow(listRows[i]));
  listShown=end;
  list.appendChild(frag);
}
function render(){
  const data=allData();
  document.getElementById('cnt').textContent=data.filter(a=>visited[a.code]).length;
  const s=q.value.trim().toLowerCase(), mode=f.value;
  applyMapFilter(data,mode);
  listRows=data.filter(a=>{
    if(s&&!(a.name.toLowerCase().includes(s)||(a.custom?(a.short||''):a.code).toLowerCase().includes(s)||(a.town||'').toLowerCase().includes(s))) return false;
    return matchesFilter(a,mode);
  });
  // a redraw after a change keeps as many rows as were shown, so the list does not jump back
  const key=s+'|'+mode, keep=key===listKey?Math.max(LIST_CHUNK,listShown):LIST_CHUNK;
  listKey=key; listShown=0; list.innerHTML='';
  moreRows(keep);
}
document.getElementById('exp').onclick=()=>{
  const b=new Blob([JSON.stringify({visited,custom,photos,flags},null,1)],{type:'application/json'});
  const x=document.createElement('a');x.href=URL.createObjectURL(b);x.download='landings-cz.json';x.click();
};
document.getElementById('imp').onclick=()=>document.getElementById('file').click();
document.getElementById('file').onchange=async e=>{
  try{
    const data=JSON.parse(await e.target.files[0].text());
    if(account){ const a=await importToAccount(data); e.target.value=''; status(t('importedAccount')(a)); return; }
    const now=Date.now(), iv=(data.visited||data.custom)?(data.visited||{}):data, ic=data.custom||{};
    Object.entries(iv).forEach(([c,v])=>{ visited[c]={...v,ts:now}; delete tomb['v:'+c]; });
    Object.entries(data.photos||{}).forEach(([c,p])=>{ photos[c]={...p,ts:now}; delete tomb['p:'+c]; });
    Object.entries(data.flags||{}).forEach(([c,x])=>{ flags[c]={...x,ts:now}; delete tomb['f:'+c]; });
    normalizePics(); savePhotos(); saveFlags();
    Object.entries(ic).forEach(([c,a])=>{ if(custom[c]) Object.assign(custom[c],a,{ts:now}); else custom[c]={...a,ts:now}; delete tomb['c:'+c]; });
    saveCustom(); refreshTotal();
    if(map){ Object.values(custom).forEach(a=>{ if(!markers[a.code]) addMarker(a); }); allData().forEach(style),refreshClusters(); }
    render(); save(); status(t('imported'));
  }catch(err){ status(t('bad')); }
};
// footer "⋯" menu: account, export, import, data source
const menu=document.getElementById('menu'), moreBtn=document.getElementById('morebtn');
function setMenu(on){ menu.classList.toggle('on',on); moreBtn.classList.toggle('on',on); }
moreBtn.onclick=e=>{ e.stopPropagation(); setMenu(!menu.classList.contains('on')); };
menu.addEventListener('click',e=>{ if(e.target.closest('button')) setMenu(false); });
document.addEventListener('click',e=>{ if(menu.classList.contains('on')&&!menu.contains(e.target)&&e.target!==moreBtn) setMenu(false); });
// Account items of the menu. The admin item only leads to the page, the database decides what it shows.
const APP_VERSION='landings-v45'; // matches the cache name in sw.js
function showAccountMenu(){
  document.getElementById('fb').hidden=!account;
  const adminBtn=document.getElementById('adminbtn'); adminBtn.hidden=true;
  const me=account&&account.id;
  if(me) window.backend.isAdmin().then(yes=>{ if((account&&account.id)===me) adminBtn.hidden=!yes; }).catch(()=>{});
}
document.getElementById('adminbtn').onclick=()=>{ location.href='admin.html'; };
const fbDlg=document.getElementById('fbdlg'), fbText=document.getElementById('fbtext'), fbMsg=document.getElementById('fbmsg'), fbSend=document.getElementById('fbsend');
document.getElementById('fb').onclick=()=>{ fbMsg.textContent=''; fbSend.disabled=false; fbDlg.showModal(); fbText.focus(); };
document.getElementById('fbclose').onclick=()=>fbDlg.close();
fbSend.onclick=async()=>{
  if(!fbText.value.trim()) return;
  fbSend.disabled=true;
  try{ await window.backend.sendFeedback(fbText.value,APP_VERSION); fbText.value=''; fbMsg.textContent=t('fbThanks'); setTimeout(()=>fbDlg.close(),2500); }
  catch(e){ console.warn('feedback',e); fbMsg.textContent=t(e&&e.code==='P0001'?'fbLimit':'commFail'); fbSend.disabled=false; }
};
applyLang();
measureHeader();
setMapOnly((()=>{ try{ return localStorage.getItem('maponly')==='1'; }catch(e){ return false; } })(),true);
applyCountries();
document.getElementById('syncbtn').title=t('syncTitle');
document.getElementById('syncbtn').onclick=syncNow;
syncNow();
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&Date.now()-lastSyncOk>15000) syncNow(); });
window.addEventListener('online',syncNow);
// updateViaCache 'none': the browser checks sw.js itself on every load, not after its HTTP cache expires.
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});
// The running version, so a test can tell an old copy from a new one.
document.getElementById('appver').textContent=APP_VERSION;
