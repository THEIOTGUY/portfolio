/* Real Habitat scan samples + ray-traced 360° captures. Canvas-only playback. */
export async function createDatasetScene(canvas, panorama, hud, reduceMotion) {
  const ctx=canvas.getContext('2d'),pc=panorama.getContext('2d');
  if(!ctx||!pc)throw Error('Canvas is unavailable');
  const base=new URL('../assets/dataset/',import.meta.url);
  const load=async path=>{const r=await fetch(new URL(path,base));if(!r.ok)throw Error(`Cannot load ${path}`);return r.json();};
  const [points,data]=await Promise.all([load('scan-points.json'),load('route.json')]);
  const route=data.route,captures=data.captures,seen=new Uint8Array(points.length);
  const distances=[0];for(let i=1;i<route.length;i++)distances.push(distances.at(-1)+Math.hypot(route[i][0]-route[i-1][0],route[i][2]-route[i-1][2]));
  const length=distances.at(-1),images=new Map(),failedImages=new Set(),pending=new Set();
  const imageAt=index=>{
    index=Math.max(0,Math.min(captures.length-1,index));
    if(!images.has(index)&&!pending.has(index)&&!failedImages.has(index)){
      pending.add(index);const image=new Image();
      image.onload=()=>{pending.delete(index);images.set(index,image);};
      image.onerror=()=>{pending.delete(index);failedImages.add(index);};
      image.src=new URL(`panorama/${String(index).padStart(3,'0')}.jpg`,base).href;
    }
    // Bound decoded image memory while retaining neighboring captures.
    for(const key of images.keys())if(Math.abs(key-index)>7)images.delete(key);
    return images.get(index);
  };
  await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images.set(0,image);resolve();};image.onerror=reject;image.src=new URL('panorama/000.jpg',base).href;});
  let elapsed=0,paused=Boolean(reduceMotion),view='orbit',yaw=.45,pitch=.86,last=0,lastDraw=0,visible=true,dead=false,raf=0,dragging=false,lx=0,ly=0;
  let W=1,H=1,CW=1,CH=1,dpr=1,palette={};
  const listeners=[];function on(el,event,fn){el?.addEventListener(event,fn);listeners.push(()=>el?.removeEventListener(event,fn));}
  const bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  points.forEach(p=>{bounds.minX=Math.min(bounds.minX,p[0]);bounds.maxX=Math.max(bounds.maxX,p[0]);bounds.minZ=Math.min(bounds.minZ,p[2]);bounds.maxZ=Math.max(bounds.maxZ,p[2]);});
  const center=[(bounds.minX+bounds.maxX)/2,.5,(bounds.minZ+bounds.maxZ)/2],span=Math.max(bounds.maxX-bounds.minX,bounds.maxZ-bounds.minZ);
  const colors=points.map(p=>`rgb(${p[3]},${p[4]},${p[5]})`);
  function refreshColors(){const css=getComputedStyle(document.documentElement);palette={bg:css.getPropertyValue('--bg-elev').trim(),ink:css.getPropertyValue('--ink').trim(),muted:css.getPropertyValue('--ink-2').trim(),accent:css.getPropertyValue('--accent').trim()};}
  function resize(){dpr=Math.min(devicePixelRatio||1,1.5);const a=canvas.getBoundingClientRect(),b=panorama.getBoundingClientRect();W=a.width;H=a.height;CW=b.width;CH=b.height;canvas.width=Math.max(1,W*dpr);canvas.height=Math.max(1,H*dpr);panorama.width=Math.max(1,CW*dpr);panorama.height=Math.max(1,CH*dpr);}
  function poseAt(d){let i=1;while(i<distances.length-1&&distances[i]<d)i++;const t=(d-distances[i-1])/(distances[i]-distances[i-1]);return route[i].map((v,k)=>route[i-1][k]+(v-route[i-1][k])*t);}
  function controls(){const b=document.getElementById('map-toggle');b.setAttribute('aria-pressed',String(paused));b.setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');b.querySelector('[data-map-label]').textContent=paused?'Resume':'Pause';}
  function draw(now){
    if(dead)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    if(visible&&!document.hidden&&!paused)elapsed+=dt;
    if(visible&&!document.hidden&&now-lastDraw>40){
      lastDraw=now;
      const leg=length/.7,phase=elapsed%(2*leg+6),out=phase<=leg+3;
      const distance=out?Math.min(length,phase*.7):Math.max(0,length-(phase-leg-3)*.7);
      const pos=poseAt(distance),ahead=poseAt(Math.max(0,Math.min(length,distance+(out?.5:-.5))));
      const heading=Math.atan2(ahead[2]-pos[2],ahead[0]-pos[0]);
      const target=view==='follow'?pos:center,angle=view==='follow'?Math.PI/2-heading:yaw,tilt=view==='top'?1.56:pitch;
      const dist=view==='follow'?8:span*1.5,cp=Math.cos(tilt),sp=Math.sin(tilt),sy=Math.sin(angle),cy=Math.cos(angle);
      const eye=[target[0]+dist*cp*sy,target[1]+dist*sp,target[2]+dist*cp*cy];
      const f=[-cp*sy,-sp,-cp*cy],r=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],F=Math.min(W*.95,H*1.6);
      function project(p){const dx=p[0]-eye[0],dy=p[1]-eye[1],dz=p[2]-eye[2];const z=dx*f[0]+dy*f[1]+dz*f[2];if(z<.1)return null;return[W/2+(dx*r[0]+dz*r[2])*F/z,H*.53-(dx*up[0]+dy*up[1]+dz*up[2])*F/z,z];}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.fillStyle=palette.bg;ctx.fillRect(0,0,W,H);
      function line(pts,color,alpha=1,dash=[]){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.beginPath();let started=false;for(const p of pts){const s=project(p);if(!s)continue;ctx[started?'lineTo':'moveTo'](s[0],s[1]);started=true;}ctx.stroke();ctx.setLineDash([]);}
      // Geometry comes from the scanned surface, never generated boxes.
      let mapped=0;const visiblePoints=[];
      for(let i=0;i<points.length;i++){
        const p=points[i],dx=p[0]-pos[0],dz=p[2]-pos[2];if(dx*dx+dz*dz<16)seen[i]=1;mapped+=seen[i];
        const s=project(p);if(s&&s[0]>0&&s[0]<W&&s[1]>0&&s[1]<H)visiblePoints.push([i,s]);
      }
      visiblePoints.sort((a,b)=>b[1][2]-a[1][2]);
      for(const [i,s]of visiblePoints){ctx.globalAlpha=seen[i]?.95:.32;ctx.fillStyle=colors[i];const size=Math.min(3.8,Math.max(1.3,38/s[2]));ctx.fillRect(s[0]-size/2,s[1]-size/2,size,size);}
      line(route.map(p=>[p[0],.08,p[2]]),palette.accent,.28,[3,4]);
      const trail=route.filter((_,i)=>distances[i]<=distance).map(p=>[p[0],.1,p[2]]);trail.push([pos[0],.1,pos[2]]);line(trail,palette.accent,1);
      const ring=[];for(let j=0;j<=64;j++){const a=j/64*Math.PI*2;ring.push([pos[0]+4*Math.cos(a),.03,pos[2]+4*Math.sin(a)]);}line(ring,palette.accent,.32,[2,5]);
      // Metric robot chassis, wheels, mast and 360° camera.
      const hx=Math.cos(heading),hz=Math.sin(heading);
      const local=(x,y,z)=>[pos[0]+x*hx-z*hz,y,pos[2]+x*hz+z*hx];
      const chassis=[local(-.25,.22,-.2),local(.25,.22,-.2),local(.25,.22,.2),local(-.25,.22,.2),local(-.25,.22,-.2)];
      line(chassis,palette.accent);ctx.globalAlpha=1;ctx.fillStyle=palette.accent;ctx.fill();line([local(0,.2,0),local(0,1.05,0)],palette.ink);
      const robot=project(local(0,1.05,0));if(robot){ctx.fillStyle=palette.accent;ctx.beginPath();ctx.arc(robot[0],robot[1],4,0,Math.PI*2);ctx.fill();ctx.font='10px ui-monospace,monospace';ctx.fillStyle=palette.ink;ctx.textAlign='center';ctx.fillText('ROBOT / 360°',Math.max(60,Math.min(W-60,robot[0])),Math.max(70,robot[1]-13));}
      const goal=project(route.at(-1));if(goal){ctx.strokeStyle=palette.accent;ctx.beginPath();ctx.arc(goal[0],goal[1],5,0,Math.PI*2);ctx.stroke();}
      // Nearest real camera capture, rotated to the simulated robot's heading.
      const index=Math.min(captures.length-1,Math.round(distance/.4));
      const image=imageAt(index);imageAt(Math.min(captures.length-1,index+1));imageAt(Math.max(0,index-1));
      pc.setTransform(dpr,0,0,dpr,0,0);pc.globalAlpha=1;pc.fillStyle='#191c1e';pc.fillRect(0,0,CW,CH);
      if(image){
        const shift=-heading/(2*Math.PI)*CW;
        for(let n=-2;n<=2;n++)pc.drawImage(image,0,image.height*.25,image.width,image.height*.5,shift+n*CW,0,CW,CH);
      }else{pc.fillStyle='#e7e2d6';pc.font='11px ui-monospace';pc.fillText(failedImages.has(index)?'Camera capture unavailable':'Loading camera capture…',12,CH/2);}
      pc.fillStyle='rgba(8,12,14,.5)';pc.fillRect(0,CH-22,CW,22);pc.fillStyle='#f6efdf';pc.font='9px ui-monospace';pc.textAlign='center';
      ['BACK','LEFT','FRONT','RIGHT','BACK'].forEach((v,i)=>pc.fillText(v,Math.max(16,Math.min(CW-16,CW*i/4)),CH-8));
      const coverage=Math.round(mapped/points.length*100);
      hud.splats.textContent=mapped.toLocaleString();hud.obs.textContent=`${distance.toFixed(1)} / ${length.toFixed(1)} m`;hud.pose.textContent=`${pos[0].toFixed(1)}, ${pos[2].toFixed(1)} m`;hud.time.textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;hud.coverage.textContent=`${coverage}%`;hud.progress.value=coverage;hud.status.textContent=paused?'Paused':'Dataset replay';
    }
    raf=requestAnimationFrame(draw);
  }
  on(document.getElementById('map-toggle'),'click',()=>{paused=!paused;controls();});
  on(document.getElementById('map-replay'),'click',()=>{elapsed=0;seen.fill(0);});
  function setView(v){view=v;document.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapView===v)));}
  document.querySelectorAll('[data-map-view]').forEach(b=>on(b,'click',()=>setView(b.dataset.mapView)));
  function reset(){yaw=.45;pitch=.86;setView('orbit');}
  on(document.getElementById('map-reset'),'click',reset);
  canvas.style.touchAction='pan-y';on(canvas,'pointerdown',e=>{if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;dragging=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
  on(canvas,'pointermove',e=>{if(!dragging)return;yaw-=(e.clientX-lx)*.006;if(e.pointerType!=='touch')pitch=Math.max(.2,Math.min(1.5,pitch+(e.clientY-ly)*.004));lx=e.clientX;ly=e.clientY;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(canvas,event,()=>dragging=false);
  on(canvas,'keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')reset();if(e.key==='ArrowLeft')yaw-=.15;if(e.key==='ArrowRight')yaw+=.15;if(e.key==='ArrowUp')pitch=Math.min(1.5,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(.2,pitch-.1);});
  const motion=matchMedia('(prefers-reduced-motion: reduce)');on(motion,'change',e=>{paused=e.matches;controls();});
  const ro=new ResizeObserver(resize);ro.observe(canvas);ro.observe(panorama);
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;});io.observe(canvas);
  refreshColors();resize();controls();raf=requestAnimationFrame(draw);
  return{refreshColors,destroy(){dead=true;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();listeners.forEach(fn=>fn());images.clear();}};
}
