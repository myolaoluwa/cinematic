const menu=document.querySelector('.mobile-menu');
if(menu){
 const panel=document.createElement('div');
 panel.className='page-mobile-panel';
 panel.innerHTML='<div class="menu-heading"><span class="footer-brand">Evayoung Photography</span><button class="close-dialog" aria-label="Close menu">Close ×</button></div><nav aria-label="Mobile navigation"><a href="index.html#work"><span>01</span>Photos</a><a href="services.html"><span>02</span>Services</a><a href="portfolio.html"><span>03</span>Categories</a><button class="contact-trigger"><span>04</span>Contact ↗</button></nav>';
 document.body.append(panel);
 const close=()=>{panel.classList.remove('open');menu.setAttribute('aria-expanded','false')};
 menu.setAttribute('aria-expanded','false');
 menu.addEventListener('click',()=>{panel.classList.add('open');menu.setAttribute('aria-expanded','true')});
 panel.querySelector('.close-dialog').addEventListener('click',close);
 panel.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
}
const dialog=document.createElement('dialog');
dialog.className='page-contact';
dialog.innerHTML='<button class="close-dialog" aria-label="Close contact">Close ×</button><span class="eyebrow">CONTACT EVAYOUNG PHOTOGRAPHY</span><h2>Let\'s talk about<br><i>your photos.</i></h2><p>Enter the email address to send your inquiry to. Your email app will open with a draft; nothing is sent from this page.</p><form><label for="page-email">RECIPIENT EMAIL</label><input id="page-email" type="email" required placeholder="Email address"><button type="submit">Create email draft ↗</button></form><a class="page-inquiry-link" hidden></a>';
document.body.append(dialog);
dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.querySelector('form').addEventListener('submit',event=>{
 event.preventDefault();
 const email=dialog.querySelector('input').value.trim();
 const link=dialog.querySelector('.page-inquiry-link');
 link.hidden=false;link.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Photography inquiry — Evayoung Photography')}`;link.textContent='Open email draft ↗';
});
document.querySelectorAll('.contact-trigger').forEach(button=>button.addEventListener('click',()=>dialog.showModal()));
