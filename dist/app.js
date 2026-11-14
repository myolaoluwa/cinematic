const photographs = [
  {id:1,title:'Human nature',category:'portraits',label:'Portraits',description:'An intimate portrait in natural light.'},
  {id:2,title:'Somewhere, slowly',category:'places',label:'Landscape',description:'Mist settles over a quiet green valley.'},
  {id:3,title:'In her element',category:'editorial',label:'Editorial',description:'A study of movement and personal style.'},
  {id:4,title:'After the last light',category:'places',label:'Night studies',description:'Stars fill the sky above a mountain silhouette.'},
  {id:5,title:'A quiet presence',category:'portraits',label:'Portraits',description:'An honest face, a moment of stillness.'},
  {id:6,title:'Between tides',category:'places',label:'Seascape',description:'Ocean waves stretch toward an open horizon.'},
  {id:7,title:'Everyday poetry',category:'editorial',label:'Editorial',description:'A small observation of everyday style.'},
  {id:8,title:'The long way home',category:'places',label:'Landscape',description:'A mountain lake reflects the fading daylight.'}
];
const $=s=>document.querySelector(s);
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const query=new URLSearchParams(location.search);
let reduced=motionQuery.matches||query.get('reduce')==='1';
document.documentElement.classList.toggle('reduce-motion',reduced);
let visiblePhotos=[...photographs],photoIndex=0,lastPhotoTrigger=null;
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});
function renderGallery(filter='all'){
  visiblePhotos=photographs.filter(p=>filter==='all'||p.category===filter);
  $('#gallery').replaceChildren(...visiblePhotos.map((p,i)=>{
    const button=document.createElement('button');button.className='photo-card reveal';button.setAttribute('aria-label',`View ${p.title}`);
    button.innerHTML=`<div class="image-wrap"><img src="assets/photo-${p.id}.jpg" alt="${p.description}" loading="lazy"><div class="view-photo"><span>VIEW STORY ↗</span></div></div><div class="photo-meta"><span class="photo-name">${p.title}</span><span class="photo-category">${p.label} / ${String(p.id).padStart(2,'0')}</span></div>`;
    button.addEventListener('click',()=>{photoIndex=i;lastPhotoTrigger=button;updateLightbox();$('#lightbox').showModal()});observer.observe(button);return button;
  }));
}
renderGallery();
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});renderGallery(button.dataset.filter);
}));
function updateLightbox(){const p=visiblePhotos[photoIndex];$('#lightbox-image').src=`assets/photo-${p.id}.jpg`;$('#lightbox-image').alt=p.description;$('#lightbox-title').textContent=p.title;$('#lightbox-number').textContent=`${String(photoIndex+1).padStart(2,'0')} / ${String(visiblePhotos.length).padStart(2,'0')}`;}
function stepPhoto(direction){photoIndex=(photoIndex+direction+visiblePhotos.length)%visiblePhotos.length;updateLightbox()}
$('.previous').onclick=()=>stepPhoto(-1);$('.next').onclick=()=>stepPhoto(1);
$('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')stepPhoto(-1);if(e.key==='ArrowRight')stepPhoto(1)});
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
document.querySelectorAll('.contact-trigger').forEach(b=>b.onclick=()=>$('#contact').showModal());
$('#contact-form').addEventListener('submit',e=>{e.preventDefault();const email=$('#email').value.trim();if(!$('#contact-form').reportValidity())return;const link=$('#inquiry-link');link.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Photography inquiry — Still / Stories')}`;link.hidden=false;link.textContent=`Contact ${email} ↗`;});
let introTimeline=null,introRunning=false;
const playhead={time:0};
const introTitle=$('.intro-title'),introCount=$('#intro-count');
let stageRadius=Math.min(innerWidth*.37,450);
window.addEventListener('resize',()=>stageRadius=Math.min(innerWidth*.37,450));
const intro=$('#intro'),stage=$('#photo-stage');
const frames=Array.from({length:14},(_,i)=>{const img=new Image();img.src=`assets/photo-${i%8+1}.jpg`;img.className='intro-photo';img.alt='';img.style.opacity='0';stage.append(img);return img});
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function finishIntro(){introTimeline?.pause();introRunning=false;gsap.set('.title-first,.title-second',{y:0,opacity:1});frames.forEach(img=>img.style.willChange='auto');$('main').inert=false;$('.header').inert=false;intro.classList.add('finished');intro.inert=true;document.body.classList.remove('opening');if(intro.contains(document.activeElement))$('#replay').focus({preventScroll:true})}
function renderIntro(){
 const t=playhead.time;
 introCount.textContent=`${String(Math.min(8,Math.floor(t/.9)+1)).padStart(2,'0')} / 08`;
 frames.forEach((img,i)=>{
  const local=(t-1.2-i*.14)/4.6;
  if(local<=0||local>=1.3){img.style.opacity='0';return}
  const p=ease(Math.min(1,local));const angle=i*.46+p*Math.PI*3.1;
  const radius=(.15+Math.sin(Math.min(1,local)*Math.PI*.7)) * stageRadius;
  const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius*.65;
  const z=-1300+p*2100;
  const opacity=Math.min(1,local*5)*Math.max(0,Math.min(1,(1.1-local)*6));
  img.style.opacity=String(opacity);img.style.transform=`translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateZ(${Math.sin(angle)*18}deg) rotateY(${Math.cos(angle)*27}deg)`;
 });
}
function startIntro(){
 introTimeline?.kill();
 if(reduced){finishIntro();return}
 intro.inert=false;intro.classList.remove('finished');document.body.classList.add('opening');
 $('main').inert=true;$('.header').inert=true;
 frames.forEach(img=>img.style.willChange='transform,opacity');
 $('#pause-intro').textContent='PAUSE';$('#pause-intro').setAttribute('aria-pressed','false');
 introRunning=true;playhead.time=0;
 const tl=gsap.timeline({onComplete:finishIntro,defaults:{ease:'power2.out',duration:.6}});
 introTimeline=tl;window.introTimeline=tl;
 tl.fromTo(introTitle,{opacity:0,y:16},{opacity:1,y:0},0)
   .to(introTitle,{opacity:0,duration:.6,ease:'power2.in'},2.6)
   .to(playhead,{time:7.6,duration:7.6,ease:'none',onUpdate:renderIntro},0)
   .fromTo('.intro-progress',{scaleX:0},{scaleX:1,duration:7.6,ease:'none'},0)
   .fromTo('.title-first,.title-second',{y:35,opacity:0},{y:0,opacity:1,stagger:.08},6.9);
 $('#skip-intro').focus({preventScroll:true});
 if(query.has('t')){tl.pause().seek(Math.max(0,Math.min(7.6,Number(query.get('t'))||0)),false);renderIntro()}
 window.__ready=true;
}
$('#pause-intro').onclick=()=>{if(!introTimeline)return;const paused=!introTimeline.paused();introTimeline.paused(paused);$('#pause-intro').textContent=paused?'RESUME':'PAUSE';$('#pause-intro').setAttribute('aria-pressed',String(paused))};
motionQuery.addEventListener('change',e=>{reduced=e.matches||query.get('reduce')==='1';document.documentElement.classList.toggle('reduce-motion',reduced);if(reduced)finishIntro()});
$('#skip-intro').onclick=finishIntro;$('#replay').onclick=()=>{window.scrollTo({top:0,behavior:'instant'});startIntro()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&introRunning)finishIntro();if(introRunning&&e.key==='Tab'){e.preventDefault();const controls=[$('#pause-intro'),$('#skip-intro')],i=controls.indexOf(document.activeElement);controls[(i+(e.shiftKey?-1:1)+2)%2].focus()}});
$('.skip-link').addEventListener('click',finishIntro);
document.querySelectorAll('.about-image,.about-copy').forEach(e=>{e.classList.add('reveal');observer.observe(e)});
if(reduced){finishIntro();window.__ready=true}else Promise.race([Promise.all(frames.slice(0,8).map(img=>img.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,1600))]).then(startIntro);
if(matchMedia('(pointer:fine)').matches){$('.hero-composition').addEventListener('pointermove',e=>{if(reduced)return;const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;document.querySelectorAll('.float-photo').forEach((p,i)=>{p.style.translate=`${x*(i%2?14:-18)}px ${y*(i%2?12:-16)}px`})});$('.hero-composition').addEventListener('pointerleave',()=>document.querySelectorAll('.float-photo').forEach(p=>p.style.translate='0 0'))}
