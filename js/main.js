/** Portfolio interactions. Preserves original repo's js/splatmap.js if available.
 *  Includes a lightweight fallback for standalone previews.
 */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mapScene = null;

  const toast = $('#toast');
  let toastTimer;
  const flash = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  function startMap() {
    const canvas = $('#map-canvas');
    if (!canvas) return null;
    const hud = {splats: $('#hud-splats'), obs: $('#hud-obs'), pose: $('#hud-pose'), time: $('#hud-time')};
    // Uses the existing richer interactive Gaussian-splat visualization in the GitHub repository.
    if (typeof window.createSplatScene === 'function') {
      try { return window.createSplatScene(canvas, null, hud, reducedMotion); }
      catch (err) { console.warn('Using preview canvas fallback:', err); }
    }
    // Standalone fallback: an original procedural, interactive point-cloud sketch.
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const points = [];
    const scatter = (v, amount) => v + (Math.random() - .5) * amount;
    for (let i = 0; i < 1150; i++) {
      const x = scatter(Math.random() * 12 - 6, .07);
      const z = scatter(Math.random() * 8 - 4, .07);
      points.push({x,y:Math.random()*.055,z,type:0,r:Math.random()*1.3+.55});
    }
    for(let i=0;i<760;i++){
      const x=(Math.random()-.5)*12;
      const z=(Math.random()-.5)*8;
      if(i%2)points.push({x,y:Math.random()*4,z:-4,type:1,r:Math.random()*1.5+.4});
      else points.push({x:6,y:Math.random()*4,z,type:1,r:Math.random()*1.5+.4});
    }
    for(let i=0;i<340;i++) {
      const x=(Math.random()-.5)*2+1.7;
      const z=(Math.random()-.5)*1.4+.3;
      const y=Math.random()*2.1;
      points.push({x,y,z,type:2,r:Math.random()*2+.8});
    }
    let angle=.48, tilt=.53, drag=false, last=0, frame=0, size={w:0,h:0};
    let lastX=0,lastY=0; let visible=true;
    function colors() {const s=getComputedStyle(root);return {ink:s.getPropertyValue('--ink').trim(),accent:s.getPropertyValue('--accent').trim(), muted:s.getPropertyValue('--ink-3').trim()};}
    let palette=colors();
    function resize(){const b=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,2);size={w:b.width,h:b.height};canvas.width=Math.max(1,Math.floor(b.width*dpr));canvas.height=Math.max(1,Math.floor(b.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);}
    const ro = new ResizeObserver(resize);ro.observe(canvas);resize();
    const io = new IntersectionObserver(([e])=>{visible=e.isIntersecting; if(visible&&!reducedMotion)requestAnimationFrame(render);});io.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;angle+=(e.clientX-lastX)*.008;tilt=Math.min(1.3,Math.max(.08,tilt+(e.clientY-lastY)*.006));lastX=e.clientX;lastY=e.clientY;if(reducedMotion)render();});
    canvas.addEventListener('pointerup',()=>{drag=false;});canvas.addEventListener('pointercancel',()=>{drag=false;});
    function render(now=0){
      if (!visible && !reducedMotion) return;
      if (now-last < 28 && !reducedMotion){requestAnimationFrame(render);return;}
      last=now;frame++;
      const w=size.w,h=size.h;
      ctx.clearRect(0,0,w,h);
      const ca=Math.cos(angle),sa=Math.sin(angle),ct=Math.cos(tilt),st=Math.sin(tilt);
      const scale=Math.min(w/17,h/11);
      function project(p){const x=p.x*ca-p.z*sa;const z=p.x*sa+p.z*ca;const y=p.y*ct-z*st;const depth=p.y*st+z*ct;const perspective=1/(1+depth*.012);return{x:w*.5+x*scale*perspective,y:h*.63-y*scale*perspective,z:depth,perspective};}
      if(!drag&&!reducedMotion)angle+=.00095;
      // points sorted occasionally for natural cloud overlap
      const col0=palette.muted,col1=palette.ink,col2=palette.accent;
      for(const p of points){const q=project(p);ctx.globalAlpha=p.type===0?.26:p.type===1?.25:.78;ctx.fillStyle=p.type===2?col2:p.type===1?col1:col0;ctx.beginPath();ctx.ellipse(q.x,q.y,p.r*q.perspective,p.r*.64*q.perspective,0,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=.9;
      const t=now/2600;const pos={x:Math.sin(t)*3.6,y:.08,z:Math.sin(t*.65)*2.1};const rp=project(pos);ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(rp.x,rp.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle=palette.accent;ctx.lineWidth=1;ctx.beginPath();ctx.arc(rp.x,rp.y,14,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      if(hud.splats)hud.splats.textContent=points.length.toLocaleString('en-IN');
      if(hud.obs)hud.obs.textContent='03';
      if(hud.pose)hud.pose.textContent=`${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
      if(hud.time)hud.time.textContent=`t ${(now/1000).toFixed(1)}s`;
      if(!reducedMotion&&visible)requestAnimationFrame(render);
    }
    if (reducedMotion) { requestAnimationFrame(render); } else requestAnimationFrame(render);
    return {refreshColors:()=>{palette=colors();if(reducedMotion)render();},destroy:()=>{io.disconnect();ro.disconnect();}};
  }

  mapScene = startMap();
  const themeButton=$('#theme-toggle');const themeMeta=$('meta[name="theme-color"]');
  const applyTheme=(v)=>{
    root.dataset.theme=v;
    if(themeButton)themeButton.setAttribute('aria-label',v==='dark'?'Switch to light theme':'Switch to dark theme');
    if(themeMeta)themeMeta.setAttribute('content',getComputedStyle(root).getPropertyValue('--bg').trim());
    if(mapScene && typeof mapScene.refreshColors==='function')mapScene.refreshColors();
  };
  applyTheme(root.dataset.theme==='dark'?'dark':'light');
  themeButton?.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';applyTheme(next);try{localStorage.setItem('theme',next);}catch(e){}});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{try{if(localStorage.getItem('theme'))return;}catch(_){}applyTheme(e.matches?'dark':'light');});

  const clock=$('#clock');
  if(clock){const fmt=new Intl.DateTimeFormat('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'});const tick=()=>clock.textContent=`${fmt.format(new Date())} IST`;tick();setInterval(tick,45000);}
  const header=$('.site-header'), progress=$('#progress');
  const onScroll=()=>{header?.classList.toggle('scrolled',scrollY>8);if(progress){const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max?scrollY/max:0})`;}};
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();

  const nav=$('#nav'),menuBtn=$('#menu-btn');
  const setMenu=(open)=>{
    nav?.classList.toggle('open',open);
    menuBtn?.setAttribute('aria-expanded',String(open));
    menuBtn?.setAttribute('aria-label',open?'Close menu':'Open menu');
    document.body.style.overflow=open?'hidden':'';
  };
  menuBtn?.addEventListener('click',()=>setMenu(!nav?.classList.contains('open')));
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
  matchMedia('(min-width: 1051px)').addEventListener('change',e=>{if(e.matches)setMenu(false);});
  const links=$$('.nav-link[href^="#"]');
  if ('IntersectionObserver' in window) {
    const sectionObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){if(!entry.isIntersecting)continue;links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+entry.target.id));}
    },{rootMargin:'-28% 0px -60% 0px'});
    $$('#main section[id]').forEach(s=>sectionObserver.observe(s));
    if(!reducedMotion){const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');observer.unobserve(e.target);}});},{threshold:.06,rootMargin:'0px 0px 40px 0px'});$$('.reveal').forEach(n=>observer.observe(n));}
    else $$('.reveal').forEach(n=>n.classList.add('in'));
  } else $$('.reveal').forEach(n=>n.classList.add('in'));
  const copy=$('#copy-email');
  copy?.addEventListener('click',async()=>{
    const email=copy.dataset.email;
    try{await navigator.clipboard.writeText(email);copy.textContent='Copied ✓';flash('Email copied');setTimeout(()=>copy.textContent='Copy email',2000);}
    catch(e){location.href='mailto:'+email;}
  });
  if($('#year'))$('#year').textContent=new Date().getFullYear();
})();
