// Photo viewer: a full-screen layer above the app (#lightbox). The browser never zooms the page here
// (touch-action: none), so the page scale always stays 1. The photo itself zooms with a CSS transform:
// two fingers, double tap, mouse wheel or Ctrl+wheel, double click, and drags when zoomed. Up to 5x, never
// dragged fully off screen (it settles back to the edge), back to 1x on closing and on the next photo.
// The x and the arrows sit outside the photo with a fixed size, so they stay visible at any zoom.
// Closing: the x, Esc, a click on the dark background, the back gesture (one history entry, see sheet.js).
const PhotoViewer=(()=>{
  const lb=document.getElementById('lightbox'); if(!lb) return {open(){},close(){},isOpen:()=>false,state:()=>({s:1,x:0,y:0})};
  const img=lb.querySelector('img'), cnt=lb.querySelector('.lbcnt'), hint=lb.querySelector('.lbhint');
  const MAX=5, SLACK=80, HINTKEY='photo-hint';
  let list=[], idx=0, isOpen=false, layer=null, back=null, hintTimer=0;
  let s=1, x=0, y=0;
  const ptrs=new Map(); let start=null, moved=false, suppressClick=false, lastTap=0, lastTapX=0, lastTapY=0, lastType='mouse';

  // the photo's laid-out box inside the layer (without the transform) and the size of the layer
  const box=()=>({L:img.offsetLeft,T:img.offsetTop,w:img.offsetWidth,h:img.offsetHeight,VW:lb.clientWidth,VH:lb.clientHeight});
  // where the photo may sit: centred while smaller than the screen, otherwise its edges no further in than the screen's
  function limits(b,sc){
    const W=b.w*sc, H=b.h*sc;
    const cx=W<=b.VW?[b.VW/2-b.L-W/2,b.VW/2-b.L-W/2]:[b.VW-b.L-W,-b.L];
    const cy=H<=b.VH?[b.VH/2-b.T-H/2,b.VH/2-b.T-H/2]:[b.VH-b.T-H,-b.T];
    return {cx,cy};
  }
  const clampTo=(v,[lo,hi],slack=0)=>Math.min(hi+slack,Math.max(lo-slack,v));
  function apply(anim){
    img.style.transition=anim?'transform .2s ease-out':'none';
    img.style.transform=(s===1&&!x&&!y)?'':`translate(${x}px,${y}px) scale(${s})`;
    lb.classList.toggle('zoomed',s>1.01);
  }
  function settle(anim){ if(s<1.02){ s=1; x=0; y=0; } else { const {cx,cy}=limits(box(),s); x=clampTo(x,cx); y=clampTo(y,cy); } apply(anim); }
  // zoom to ns keeping the point (px, py) of the screen still
  function zoomAt(ns,px,py,anim){
    const b=box(); ns=Math.max(1,Math.min(MAX,ns));
    const ox=px-b.L, oy=py-b.T;
    x=ox-(ox-x)*ns/s; y=oy-(oy-y)*ns/s; s=ns; settle(anim);
  }
  const toggleZoom=(px,py)=>zoomAt(s>1.01?1:2.5,px,py,true);
  function reset(){ s=1; x=0; y=0; ptrs.clear(); start=null; apply(false); }

  function show(){ reset(); img.src=list[idx]; cnt.textContent=list.length>1?`${idx+1} / ${list.length}`:''; lb.classList.toggle('multi',list.length>1); }
  function step(n){ if(list.length<2) return; idx=(idx+n+list.length)%list.length; show(); }
  function showHint(){
    if(!hint||!window.matchMedia('(pointer: coarse)').matches) return;
    let seen=false; try{ seen=localStorage.getItem(HINTKEY)==='1'; localStorage.setItem(HINTKEY,'1'); }catch(e){}
    if(seen) return;
    hint.hidden=false; clearTimeout(hintTimer); hintTimer=setTimeout(()=>{ hint.hidden=true; },3500);
  }
  function open(l,i=0){
    list=(Array.isArray(l)?l:[l]).filter(Boolean); if(!list.length) return;
    idx=Math.min(Math.max(0,i|0),list.length-1);
    back=document.activeElement&&document.activeElement!==document.body?document.activeElement:null;
    lb.classList.add('on'); isOpen=true; show();
    layer=Sheets.layer(()=>close(true));
    lb.querySelector('.lbclose').focus({preventScroll:true});
    showHint();
  }
  function close(fromHistory){
    if(!isOpen) return;
    isOpen=false; lb.classList.remove('on'); reset();
    if(hint){ hint.hidden=true; clearTimeout(hintTimer); }
    if(layer&&!fromHistory) layer.close(); layer=null;
    const b=back; back=null; if(b&&document.contains(b)) try{ b.focus({preventScroll:true}); }catch(e){}
  }

  const pts=()=>[...ptrs.values()];
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y), mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function begin(){
    const p=pts();
    if(p.length===1) start={kind:'pan',px:p[0].x,py:p[0].y,x,y};
    else if(p.length>=2){ const m=mid(p[0],p[1]); start={kind:'pinch',d:Math.max(1,dist(p[0],p[1])),s,mx:m.x,my:m.y,x,y}; }
    img.style.transition='none';
  }
  lb.addEventListener('pointerdown',e=>{
    if(!isOpen||e.target.closest('button')) return;
    lastType=e.pointerType; moved=false;
    try{ lb.setPointerCapture(e.pointerId); }catch(_){}
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY}); begin();
  });
  lb.addEventListener('pointermove',e=>{
    if(!ptrs.has(e.pointerId)||!start) return;
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const p=pts();
    if(start.kind==='pinch'&&p.length>=2){
      moved=true;
      const b=box(), m=mid(p[0],p[1]), ns=Math.max(1,Math.min(MAX,start.s*dist(p[0],p[1])/start.d));
      // the content under the first midpoint follows the fingers
      x=(m.x-b.L)-(start.mx-b.L-start.x)*ns/start.s; y=(m.y-b.T)-(start.my-b.T-start.y)*ns/start.s; s=ns;
      const {cx,cy}=limits(b,s); x=clampTo(x,cx,SLACK); y=clampTo(y,cy,SLACK); apply(false);
    } else if(start.kind==='pan'&&p.length===1){
      const dx=p[0].x-start.px, dy=p[0].y-start.py;
      if(Math.abs(dx)+Math.abs(dy)>6) moved=true;
      if(s>1.01){ const {cx,cy}=limits(box(),s); x=clampTo(start.x+dx,cx,SLACK); y=clampTo(start.y+dy,cy,SLACK); apply(false); }
    }
  });
  function end(e){
    if(!ptrs.has(e.pointerId)) return;
    const was=start; ptrs.delete(e.pointerId);
    if(ptrs.size){ begin(); return; } // a finger left after a pinch: go on as a pan
    start=null; settle(true);
    if(!was||was.kind!=='pan') return;
    // not zoomed: a swipe goes to the next or previous photo
    const dx=e.clientX-was.px, dy=e.clientY-was.py;
    if(s===1&&list.length>1&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){ suppressClick=true; step(dx<0?1:-1); return; }
    // a double tap with a finger zooms in at the tap or back to 1x
    if(e.pointerType!=='mouse'&&!moved){
      if(e.timeStamp-lastTap<300&&Math.hypot(e.clientX-lastTapX,e.clientY-lastTapY)<30){ lastTap=0; suppressClick=true; toggleZoom(e.clientX,e.clientY); }
      else { lastTap=e.timeStamp; lastTapX=e.clientX; lastTapY=e.clientY; }
    }
  }
  lb.addEventListener('pointerup',end);
  lb.addEventListener('pointercancel',end);
  lb.addEventListener('click',e=>{
    if(suppressClick||moved){ suppressClick=false; return; }
    if(e.target===lb) close(); // the dark background; a click on the photo keeps it open
  });
  lb.addEventListener('dblclick',e=>{ if(lastType==='mouse'&&e.target===img) toggleZoom(e.clientX,e.clientY); });
  lb.addEventListener('wheel',e=>{
    if(!isOpen) return; e.preventDefault();
    zoomAt(s*Math.exp(-e.deltaY*(e.ctrlKey?0.01:0.0015)),e.clientX,e.clientY,false);
  },{passive:false});
  lb.querySelector('.lbclose').addEventListener('click',e=>{ e.stopPropagation(); close(); });
  lb.querySelector('.lbprev').addEventListener('click',e=>{ e.stopPropagation(); step(-1); });
  lb.querySelector('.lbnext').addEventListener('click',e=>{ e.stopPropagation(); step(1); });
  document.addEventListener('keydown',e=>{
    if(!isOpen) return;
    if(e.key==='Escape'){ e.preventDefault(); close(); }
    else if(e.key==='ArrowRight') step(1);
    else if(e.key==='ArrowLeft') step(-1);
    else if(e.key==='+'||e.key==='='){ const b=box(); zoomAt(s*1.5,b.VW/2,b.VH/2,true); }
    else if(e.key==='-'){ const b=box(); zoomAt(s/1.5,b.VW/2,b.VH/2,true); }
  });
  window.addEventListener('resize',()=>{ if(isOpen) settle(false); });
  return {open,close:()=>close(false),isOpen:()=>isOpen,state:()=>({s,x,y}),zoomAt};
})();
