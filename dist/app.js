const photographs = [
  {id:1,title:'Wedding portrait',category:'weddings',label:'Weddings',description:'A bride in a detailed wedding dress, photographed in soft light.'},
  {id:2,title:'Portrait in green',category:'portraits',label:'Portraits',description:'A close portrait in traditional green clothing.'},
  {id:3,title:'A moment together',category:'love',label:'Love stories',description:'A couple sharing a quiet moment by the window.'},
  {id:4,title:'Family tradition',category:'celebrations',label:'Celebrations',description:'A family sharing a moment in traditional clothing.'},
  {id:5,title:'Family portrait',category:'family',label:'Family moments',description:'A family portrait in coordinated traditional clothing.'},
  {id:6,title:'Studio portrait',category:'lifestyle',label:'Studio & lifestyle',description:'A relaxed studio portrait in warm, natural tones.'},
  {id:7,title:'Beauty in focus',category:'editorial',label:'Editorial & fashion',description:'A beauty portrait styled for a skincare editorial.'},
  {id:8,title:'Maternity portrait',category:'family',label:'Family moments',description:'A quiet maternity portrait in a bright studio.'}
];
const $=s=>document.querySelector(s);
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const query=new URLSearchParams(location.search);
let reduced=motionQuery.matches||query.get('reduce')==='1';
document.documentElement.classList.toggle('reduce-motion',reduced);
let visiblePhotos=[...photographs],viewerPhotos=visiblePhotos,photoIndex=0,lastPhotoTrigger=null;
const stories=[
 {title:'Weddings',subtitle:'The people and moments in between.',category:'WEDDINGS',ids:[1,3],image:'assets/story-photo-1.jpg',thumbnail:'assets/story-thumb-1.jpg',alt:'A couple dressed for their wedding standing together.',text:'Wedding photographs that leave room for the people, traditions, and small moments that make the day yours.'},
 {title:'Portraits',subtitle:'Personal, relaxed, and true to you.',category:'PORTRAITS',ids:[2,7],image:'assets/story-photo-2.jpg',thumbnail:'assets/story-thumb-2.jpg',alt:'A woman in a green outfit seated for a portrait.',text:'Portraits shaped around your style, with simple direction and time to feel comfortable.'},
 {title:'Family moments',subtitle:'Photos of the people closest to you.',category:'FAMILY',ids:[5,8],image:'assets/story-photo-3.jpg',thumbnail:'assets/story-thumb-3.jpg',alt:'An expecting couple together during a maternity session.',text:'Family and maternity photographs that keep the focus on the people and moments you want to remember.'}
];
let activeTransition=null;
function transitionDOM(update){
 if(reduced||!document.startViewTransition){update();return null}
 activeTransition?.skipTransition();
 activeTransition=document.startViewTransition(update);
 activeTransition.finished.catch(()=>{});
 return activeTransition;
}
function openPhoto(list,index,trigger){
 viewerPhotos=list;photoIndex=index;lastPhotoTrigger=trigger;
 const source=trigger?.querySelector('img'),target=$('#lightbox-image');
 const previousName=source?.style.viewTransitionName||'';
 if(source)source.style.viewTransitionName='selected-photo';
 const transition=transitionDOM(()=>{
   if(source)source.style.viewTransitionName='none';
   updateLightbox();target.style.viewTransitionName='selected-photo';$('#lightbox').showModal();
 });
 const reset=()=>{if(source)source.style.viewTransitionName=previousName;target.style.viewTransitionName='none'};
 if(transition)transition.finished.then(reset,reset);else reset();
}
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});
function renderGallery(filter='all'){
  visiblePhotos=photographs.filter(p=>filter==='all'||p.category===filter);
  $('#gallery').replaceChildren(...visiblePhotos.map((p,i)=>{
    const button=document.createElement('button');button.className='photo-card reveal';button.setAttribute('aria-label',`View ${p.title}`);
    button.innerHTML=`<span class="photo-number">${String(p.id).padStart(2,'0')} / 08</span><div class="image-wrap"><img src="assets/photo-${p.id}.jpg" alt="${p.description}" loading="lazy" decoding="async"><div class="view-photo"><span>VIEW PHOTO ↗</span></div></div><div class="photo-meta"><span class="photo-name">${p.title}</span><span class="photo-category">${p.label} <span aria-hidden="true">↗</span></span></div>`;
    button.querySelector('img').style.viewTransitionName=`frame-${p.id}`;
    button.addEventListener('click',()=>openPhoto(visiblePhotos,i,button));observer.observe(button);return button;
  }));
  $('#collection-count').textContent=`${String(visiblePhotos.length).padStart(2,'0')} PHOTOS / ${filter==='all'?'ALL':filter.toUpperCase()}`;
}
const requestedFilter=query.get('category');
const initialFilter=[...document.querySelectorAll('[data-filter]')].some(button=>button.dataset.filter===requestedFilter)?requestedFilter:'all';
document.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter===initialFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
renderGallery(initialFilter);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});renderGallery(button.dataset.filter);
}));
function updateLightbox(){const p=viewerPhotos[photoIndex];$('#lightbox-image').src=`assets/photo-${p.id}.jpg`;$('#lightbox-image').alt=p.description;$('#lightbox-title').textContent=p.title;$('#lightbox-number').textContent=`${String(photoIndex+1).padStart(2,'0')} / ${String(viewerPhotos.length).padStart(2,'0')}`;$('#viewer-title').textContent=p.title;$('#viewer-description').textContent=p.description;$('#viewer-category').textContent=p.label;$('#viewer-count').textContent=$('#lightbox-number').textContent;$('#viewer-inquire').dataset.inquiry=`${p.label} photography`;renderViewerFrames();}
function stepPhoto(direction){photoIndex=(photoIndex+direction+viewerPhotos.length)%viewerPhotos.length;transitionDOM(updateLightbox)}
$('.previous').onclick=()=>stepPhoto(-1);$('.next').onclick=()=>stepPhoto(1);
$('#lightbox').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')stepPhoto(-1);if(e.key==='ArrowRight')stepPhoto(1)});
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
document.querySelectorAll('.contact-trigger').forEach(b=>b.onclick=()=>{
 if($('#lightbox').open)$('#lightbox').close();
 if($('#site-menu').open)$('#site-menu').close();
 const context=b.dataset.inquiry||'';
 const form=$('#contact-form');
 const typeField=form.elements.namedItem('service_type');
 const lowerContext=context.toLowerCase();
 const serviceHint=lowerContext.includes('event')?'event':
  lowerContext.includes('wedding')||lowerContext.includes('couple')?'wedding':
  lowerContext.includes('family')||lowerContext.includes('maternity')?'family':
  lowerContext.includes('birthday')?'birthday':
  lowerContext.includes('portrait')?'portrait':'';
 const option=[...typeField.options].find(item=>serviceHint&&item.value.toLowerCase().includes(serviceHint));
 typeField.value=option?.value||'';
 form.elements.namedItem('enquiry_context').value=context||'General booking or photography enquiry';
 form.elements.namedItem('_subject').value=`New ${context||'booking or enquiry'} — Evayoung Photography`;
 $('#inquiry-context').textContent=context||'BOOKING / GENERAL ENQUIRY';$('#inquiry-context').hidden=false;
 $('#contact').showModal();
});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
 const isIndex=button.dataset.view==='index';
 transitionDOM(()=>$('#gallery').classList.toggle('is-index',isIndex));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
}));
$('.mobile-menu').onclick=()=>{$('#site-menu').showModal();$('.mobile-menu').setAttribute('aria-expanded','true')};
$('#site-menu').addEventListener('close',()=>$('.mobile-menu').setAttribute('aria-expanded','false'));
document.querySelectorAll('.menu-links a').forEach(link=>link.addEventListener('click',()=>$('#site-menu').close()));
$('#lightbox').addEventListener('close',()=>lastPhotoTrigger?.focus({preventScroll:true}));
let introTimeline=null,introRunning=false;
const playhead={time:0};
const introTitle=$('.intro-title'),introCount=$('#intro-count');
let stageRadius=Math.min(innerWidth*.37,450);
window.addEventListener('resize',()=>stageRadius=Math.min(innerWidth*.37,450));
const intro=$('#intro'),stage=$('#photo-stage');
const frames=Array.from({length:14},(_,i)=>{const img=new Image();img.src=`assets/intro-photo-${i+1}.jpg`;img.className='intro-photo';img.alt='';img.style.opacity='0';stage.append(img);return img});
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function finishIntro(){introTimeline?.pause();introRunning=false;gsap.set('.title-first,.title-second',{y:0,opacity:1});frames.forEach(img=>img.style.willChange='auto');$('main').inert=false;$('.header').inert=false;intro.classList.add('finished');intro.inert=true;document.body.classList.remove('opening');if(intro.contains(document.activeElement))$('#replay').focus({preventScroll:true});window.dispatchEvent(new Event('portfolio:intro-end'))}
function renderIntro(){
 const t=playhead.time;
 const assemble=ease(Math.max(0,Math.min(1,(t-.7)/2.3)));
 const travel=ease(Math.max(0,Math.min(1,(t-3)/3.8)));
 introCount.textContent=`${String(Math.min(frames.length,Math.floor(t/(7.6/frames.length))+1)).padStart(2,'0')} / ${String(frames.length).padStart(2,'0')}`;
 frames.forEach((img,i)=>{
  const col=i%5-2,row=Math.floor(i/5)-1;
  const depth=(i%3)*-160;
  const x=col*stageRadius*.6*(1-travel*.74);
  const y=row*stageRadius*.65*(1-travel*.74)+(1-assemble)*(i%2?100:-100);
  const z=depth-500+travel*1120;
  const fade=Math.max(0,Math.min(1,(t-.6-i*.055)*1.3))*Math.max(0,Math.min(1,(7.4-t)/.7));
  img.style.opacity=String(fade);
  img.style.transform=`translate(-50%,-50%) translate3d(${x}px,${y}px,${z}px) rotateY(${col*-7*(1-travel)}deg) rotateZ(${(i%2?2:-2)*(1-travel)}deg)`;
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
// User-controlled chapters: one focal phrase, one photograph, no timed rotation.
const aboutTabs=[...document.querySelectorAll('.about-tabs [role="tab"]')];
const aboutPanels=[...document.querySelectorAll('.about-chapter')];
const aboutBackdrops=[...document.querySelectorAll('.about-backdrop')];
let aboutIndex=0,aboutAnimation=null;
function selectAbout(index,focus=false){
 const next=Math.max(0,Math.min(aboutTabs.length-1,index));
 aboutAnimation?.kill();
 aboutTabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===next));tab.tabIndex=i===next?0:-1});
 aboutPanels.forEach((panel,i)=>panel.hidden=i!==next);
 aboutBackdrops.forEach((image,i)=>image.classList.toggle('is-active',i===next));
 $('#about-position').textContent=`0${next+1} / 03`;
 $('#about-prev').disabled=next===0;$('#about-next').disabled=next===aboutTabs.length-1;
 if(next!==aboutIndex){
   const elements=aboutPanels[next].children;
   aboutAnimation=gsap.fromTo(elements,{opacity:0,y:reduced?0:18},{opacity:1,y:0,duration:reduced?.15:.6,stagger:reduced?0:.06,ease:'power2.out',clearProps:'transform,opacity'});
 }
 aboutIndex=next;
 if(focus)aboutTabs[next].focus({preventScroll:true});
}
aboutTabs.forEach((tab,i)=>{
 tab.addEventListener('click',()=>selectAbout(i));
 tab.addEventListener('keydown',e=>{
   let next=i;
   if(e.key==='ArrowRight')next=(i+1)%aboutTabs.length;
   else if(e.key==='ArrowLeft')next=(i-1+aboutTabs.length)%aboutTabs.length;
   else if(e.key==='Home')next=0;
   else if(e.key==='End')next=aboutTabs.length-1;
   else return;
   e.preventDefault();selectAbout(next,true);
 });
});
$('#about-prev').onclick=()=>selectAbout(aboutIndex-1);
$('#about-next').onclick=()=>selectAbout(aboutIndex+1);
function renderViewerFrames(){
 const current=viewerPhotos[photoIndex];
 const story=stories.find(s=>s.ids.includes(current.id));
 $('#viewer-story').textContent=story?.text||'';
 $('#viewer-frames').replaceChildren(...viewerPhotos.map((p,i)=>{
   const button=document.createElement('button');button.type='button';
   button.setAttribute('aria-label',`View ${p.title}`);button.setAttribute('aria-pressed',String(i===photoIndex));
   button.innerHTML=`<img src="assets/photo-${p.id}.jpg" alt="" loading="lazy">`;
   button.onclick=()=>{photoIndex=i;transitionDOM(updateLightbox)};
   return button;
 }));
}
const rail=$('#story-rail');let storyIndex=0,railTick=0;
rail.replaceChildren(...stories.map((story,i)=>{
 const article=document.createElement('article');article.className='story-slide';
 article.setAttribute('aria-roledescription','slide');article.setAttribute('aria-label',`${i+1} of ${stories.length}: ${story.title}`);
 article.innerHTML=`<button class="story-open" aria-label="Explore ${story.title}"><img src="${story.image}" alt="${story.alt}" loading="lazy"><span class="story-shade" aria-hidden="true"></span><span class="story-topline"><span>${story.category}</span><span>${String(story.ids.length).padStart(2,'0')} frames</span></span><span class="story-caption"><span class="story-number">0${i+1}</span><span class="story-title">${story.title}</span><span class="story-subtitle">${story.subtitle}</span><span class="story-enter" aria-hidden="true">&#8599;</span></span></button>`;
 article.querySelector('button').onclick=()=>openPhoto(story.ids.map(id=>photographs.find(p=>p.id===id)),0,article.querySelector('button'));
 return article;
}));
$('#story-thumbnails').replaceChildren(...stories.map((story,i)=>{
 const button=document.createElement('button');button.className='story-thumb';button.setAttribute('aria-label',`Show ${story.title}`);
 button.innerHTML=`<img src="${story.thumbnail}" alt="" loading="lazy"><span>0${i+1}</span>`;
 button.onclick=()=>selectStory(i);return button;
}));
function updateStoryControls(){
 $('#story-position').textContent=`0${storyIndex+1} / 03`;
 $('#story-prev').disabled=storyIndex===0;$('#story-next').disabled=storyIndex===stories.length-1;
 document.querySelectorAll('.story-thumb').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===storyIndex)));
}
function selectStory(index){
 storyIndex=Math.max(0,Math.min(stories.length-1,index));updateStoryControls();
 const left=rail.children[storyIndex].offsetLeft-rail.children[0].offsetLeft;
 if(rail.scrollTo)rail.scrollTo({left,behavior:reduced?'instant':'smooth'});else rail.scrollLeft=left;
}
$('#story-prev').onclick=()=>selectStory(storyIndex-1);$('#story-next').onclick=()=>selectStory(storyIndex+1);
rail.addEventListener('keydown',e=>{
 if(e.target!==rail)return;
 if(e.key==='ArrowRight'){e.preventDefault();selectStory(storyIndex+1)}
 if(e.key==='ArrowLeft'){e.preventDefault();selectStory(storyIndex-1)}
 if(e.key==='Home'){e.preventDefault();selectStory(0)}
 if(e.key==='End'){e.preventDefault();selectStory(stories.length-1)}
});
rail.addEventListener('scroll',()=>{
 if(railTick)return;
 railTick=requestAnimationFrame(()=>{
   railTick=0;
   const offsets=[...rail.children].map(el=>Math.abs(el.offsetLeft-rail.children[0].offsetLeft-rail.scrollLeft));
   storyIndex=offsets.indexOf(Math.min(...offsets));updateStoryControls();
 });
},{passive:true});
updateStoryControls();
if(reduced||location.hash){finishIntro();window.__ready=true}else Promise.race([Promise.all(frames.slice(0,8).map(img=>img.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,1600))]).then(startIntro);
if(matchMedia('(pointer:fine)').matches){$('.hero-composition').addEventListener('pointermove',e=>{if(reduced)return;const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;document.querySelectorAll('.float-photo').forEach((p,i)=>{p.style.translate=`${x*(i%2?14:-18)}px ${y*(i%2?12:-16)}px`})});$('.hero-composition').addEventListener('pointerleave',()=>document.querySelectorAll('.float-photo').forEach(p=>p.style.translate='0 0'))}
