(() => {
  // SVG rendering suits these two small vector icons and needs no WASM or CDN.
  if (!window.lottie || !window.portfolioMotionData) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  const isReduced = () => preference.matches || params.get('reduce') === '1';
  const instances = [];
  const configs = [
    {id:'scroll-motion',name:'soft-scroll',target:'.hero',trigger:'.explore',segment:[0,44],still:30},
    {id:'shutter-motion',name:'camera-shutter',target:'#about',trigger:'.about-tabs',segment:[0,32],still:0}
  ];
  configs.forEach(config => {
    const container = document.getElementById(config.id);
    if (!container) return;
    const animation = lottie.loadAnimation({
      container,renderer:'svg',loop:false,autoplay:false,
      animationData:JSON.parse(JSON.stringify(portfolioMotionData[config.name])),
      rendererSettings:{preserveAspectRatio:'xMidYMid meet',progressiveLoad:false}
    });
    let ready=false,visible=false,played=false;
    function play() {
      if (!ready || isReduced() || document.hidden || document.body.classList.contains('opening') || params.has('lottieFrame')) return;
      animation.setSpeed(.85);
      animation.playSegments(config.segment,true);
    }
    function settle() {animation.goToAndStop(config.still,true)}
    function onLoad() {
      if(ready)return;
      ready=true;
      container.classList.add('motion-ready');
      container.closest('.scroll-motion-wrap')?.classList.add('motion-ready');
      const svg=container.querySelector('svg');
      if(svg){svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false')}
      settle();
      if(params.has('lottieFrame'))animation.goToAndStop(Math.min(animation.totalFrames-1,Math.max(0,Number(params.get('lottieFrame'))||0)),true);
      else if(visible&&!played&&!document.body.classList.contains('opening')){played=true;play()}
    }
    animation.addEventListener('DOMLoaded',onLoad);
    if(animation.isLoaded)onLoad();
    animation.addEventListener('data_failed',()=>container.classList.remove('motion-ready'));
    const observer=new IntersectionObserver(entries=>{
      visible=entries.some(entry=>entry.isIntersecting);
      if(!visible){animation.pause();return}
      if(!played&&ready&&!document.body.classList.contains('opening')){played=true;play()}
    },{threshold:.2});
    observer.observe(document.querySelector(config.target));
    const trigger=document.querySelector(config.trigger);
    trigger?.addEventListener('pointerenter',play);
    trigger?.addEventListener('focusin',play);
    if(config.id==='shutter-motion')trigger?.addEventListener('click',play);
    window.addEventListener('portfolio:intro-end',()=>{if(visible&&!played){played=true;play()}});
    preference.addEventListener('change',()=>{if(isReduced())settle()});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)animation.pause()});
    instances.push({animation,config});
  });
  window.portfolioLotties=instances;
  window.addEventListener('pagehide',()=>instances.forEach(({animation})=>animation.pause()));
})();
