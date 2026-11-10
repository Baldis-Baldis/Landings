// Bottom sheet shared by the airfield card and the country picker on narrow screens (up to 899 px, the same
// breakpoint as the stacked layout). Markup: .sheet > .csgrip, .cshead (title with tabindex="-1", .csx), .csbody.
// Heights 55 % and full, drag on the grip or the header, close by dragging down, the x, Esc or the back gesture.
// One sheet at a time: opening one closes the other and takes over its single history entry.
// With the iPhone keyboard open the sheet follows window.visualViewport, so the list stays above the keyboard.
// On wide screens a sheet made with {window:true} opens as a plain floating window (no drag, no history).
const sheetMQ=window.matchMedia('(max-width: 899px)');
const Sheets=(()=>{
  let current=null, pushed=false, popOwn=0, top=null;
  const lightboxOpen=()=>{ const lb=document.getElementById('lightbox'); return !!(lb&&lb.classList.contains('on')); };
  // back gesture or button closes the open sheet instead of leaving the app. A history.back() of our own lands
  // later (slowly in Safari), so its popstate must not close a sheet opened meanwhile.
  window.addEventListener('popstate',()=>{ if(popOwn>0){ popOwn--; return; } if(top){ const l=top; top=null; l.onBack(); return; } if(current){ pushed=false; current.close(true); } });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&current&&!lightboxOpen()) current.close(); });
  window.addEventListener('resize',()=>{ if(current) current.fit(); });
  if(window.visualViewport){ window.visualViewport.addEventListener('resize',()=>{ if(current) current.fit(); }); window.visualViewport.addEventListener('scroll',()=>{ if(current) current.fit(); }); }

  function make(root,opts={}){
    const title=root.querySelector('.cshead [tabindex="-1"]'), s={root,state:'half',open:false,mode:'sheet',back:null};
    // room above the keyboard: the visual viewport shrinks when the iPhone keyboard opens, dvh does not
    function room(){ const vv=window.visualViewport, ih=window.innerHeight; if(!vv) return {h:ih,bottom:0}; return {h:Math.min(ih,vv.height),bottom:Math.max(0,Math.round(ih-vv.height-vv.offsetTop))}; }
    function heights(){ const {h}=room(), gap=Math.max(8,parseFloat(getComputedStyle(root).getPropertyValue('--cstop'))||8); return {half:Math.round(h*0.55),full:Math.max(Math.round(h*0.55),Math.round(h-gap))}; }
    function setH(px){ root.style.height=px+'px'; }
    s.fit=()=>{ if(!s.open||s.mode!=='sheet') return; root.style.bottom=room().bottom+'px'; setH(heights()[s.state]); };
    s.isOpen=()=>s.open;
    s.expand=()=>{ if(!s.open||s.mode!=='sheet'||s.state==='full') return; s.state='full'; s.fit(); };
    s.show=(opener)=>{
      const fresh=!s.open;
      s.mode=opts.window&&!sheetMQ.matches?'window':'sheet';
      if(current&&current!==s) current.close(false,true); // hand the history entry over, no back()
      if(fresh){
        s.back=opener&&opener!==document.body?opener:null;
        root.hidden=false; s.open=true; s.state='half'; current=s;
        document.body.classList.add('sheetopen'); if(opts.bodyClass) document.body.classList.add(opts.bodyClass);
        root.classList.toggle('win',s.mode==='window');
        if(s.mode==='sheet'){
          root.style.bottom=room().bottom+'px'; setH(0); root.getBoundingClientRect();
          if(!pushed){ try{ history.pushState({sheet:1},''); pushed=true; }catch(e){ pushed=false; } }
        } else { root.style.height=''; root.style.bottom=''; }
      }
      if(s.mode==='sheet') setH(heights()[s.state]);
      if(title) title.focus({preventScroll:true});
      if(opts.onOpen) opts.onOpen(fresh);
    };
    s.close=(fromHistory,handover)=>{
      if(!s.open) return;
      s.open=false; if(current===s) current=null;
      if(opts.bodyClass) document.body.classList.remove(opts.bodyClass);
      if(!current) document.body.classList.remove('sheetopen');
      if(s.mode==='sheet'){ setH(0); setTimeout(()=>{ if(!s.open){ root.hidden=true; if(opts.onHidden) opts.onHidden(); } },230); }
      else { root.hidden=true; if(opts.onHidden) opts.onHidden(); }
      if(!handover&&!current){
        if(pushed&&!fromHistory){ pushed=false; popOwn++; history.back(); } else if(fromHistory) pushed=false;
      }
      if(opts.onClose) opts.onClose();
      if(!handover){
        const back=s.back&&document.contains(s.back)?s.back:(opts.focusBack?opts.focusBack():null);
        s.back=null; if(back) try{ back.focus({preventScroll:true}); }catch(e){}
      }
    };
    const x=root.querySelector('.csx'); if(x) x.addEventListener('click',()=>s.close());
    // drag the grip or the header: up to full height, down to half or closed
    let y0=0,h0=0,drag=false,lastY=0,lastT=0,v=0;
    const down=e=>{ if(s.mode!=='sheet'||e.target.closest('.csx')) return; drag=true; y0=lastY=e.clientY; lastT=e.timeStamp; v=0; h0=root.getBoundingClientRect().height; root.classList.add('drag'); e.currentTarget.setPointerCapture(e.pointerId); };
    const move=e=>{ if(!drag) return; setH(Math.max(0,Math.min(heights().full,h0-(e.clientY-y0)))); const dt=e.timeStamp-lastT; if(dt>0) v=(e.clientY-lastY)/dt; lastY=e.clientY; lastT=e.timeStamp; };
    const up=()=>{
      if(!drag) return; drag=false; root.classList.remove('drag');
      const h=root.getBoundingClientRect().height, {half,full}=heights();
      if(v>0.8||h<half*0.6){ s.close(); return; }
      s.state=(v<-0.8||h>(half+full)/2)?'full':'half'; s.fit();
      if(opts.onSettle) opts.onSettle(s.state);
    };
    root.querySelectorAll('.csgrip,.cshead').forEach(g=>{ g.addEventListener('pointerdown',down); g.addEventListener('pointermove',move); g.addEventListener('pointerup',up); g.addEventListener('pointercancel',up); });
    return s;
  }
  // A layer above the sheets (the photo viewer) gets its own history entry: the back gesture closes it first,
  // the sheet under it stays open. Closing it by hand takes the entry back, with the same guard.
  function layer(onBack){
    const l={onBack,pushed:false};
    try{ history.pushState({layer:1},''); l.pushed=true; }catch(e){}
    top=l;
    return {close(){ if(top!==l) return; top=null; if(l.pushed){ popOwn++; history.back(); } }};
  }
  return {make,layer,current:()=>current};
})();
