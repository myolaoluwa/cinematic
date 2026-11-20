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
dialog.setAttribute('aria-labelledby','page-contact-title');
dialog.innerHTML=`<button class="close-dialog" aria-label="Close contact">Close ×</button><span class="eyebrow">BOOKINGS &amp; ENQUIRIES</span><h2 id="page-contact-title">Let's talk about<br><i>your photos.</i></h2><p class="page-inquiry-context" hidden></p><form class="booking-form" action="https://formsubmit.co/ayomideayomide990@gmail.com" method="POST"><input type="hidden" name="_subject" value="New booking or enquiry — Evayoung Photography"><input type="hidden" name="_template" value="table"><input type="hidden" name="enquiry_context" value="General booking or photography enquiry"><div class="booking-honeypot" aria-hidden="true"><label>Leave this field empty<input type="text" name="_honey" tabindex="-1" autocomplete="off"></label></div><div class="booking-fields"><label class="booking-field">YOUR NAME<input type="text" name="name" autocomplete="name" required></label><label class="booking-field">EMAIL ADDRESS<input type="email" name="email" autocomplete="email" required></label><label class="booking-field">PHONE (OPTIONAL)<input type="tel" name="phone" autocomplete="tel"></label><label class="booking-field">TYPE OF PHOTOGRAPHY<select name="service_type" required><option value="" selected disabled>Choose a service</option><option>Wedding photography</option><option>Pre-wedding or couple photography</option><option>Portrait photography</option><option>Family or maternity photography</option><option>Graduation photography</option><option>Birthday or celebration photography</option><option>Event photography</option><option>Studio or lifestyle photography</option><option>Outdoor photography</option><option>Fashion, beauty or editorial photography</option><option>Other / not sure yet</option></select></label><label class="booking-field">PREFERRED DATE (OPTIONAL)<input type="date" name="preferred_date"></label><label class="booking-field">LOCATION (OPTIONAL)<input type="text" name="location" autocomplete="address-level2" placeholder="City or preferred location"></label><label class="booking-field booking-field-wide">TELL US WHAT YOU HAVE IN MIND<textarea name="message" rows="4" required placeholder="Share a few details about your plans, timing, and the photos you need."></textarea></label></div><p class="form-privacy">Your enquiry is sent via FormSubmit to Evayoung Photography. FormSubmit stores submissions for up to 30 days. Please don’t include sensitive information.</p><p class="form-status" role="status" aria-live="polite"></p><a class="form-fallback" href="mailto:ayomideayomide990@gmail.com" hidden>Email Evayoung Photography directly</a><button class="form-submit" type="submit">SEND ENQUIRY <span aria-hidden="true">↗</span></button></form>`;
document.body.append(dialog);
dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
document.querySelectorAll('.contact-trigger').forEach(button=>button.addEventListener('click',()=>{
 const form=dialog.querySelector('.booking-form');
 const context=button.dataset.inquiry||'';
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
 const contextLabel=dialog.querySelector('.page-inquiry-context');
 contextLabel.textContent=context||'BOOKING / GENERAL ENQUIRY';
 contextLabel.hidden=false;
 dialog.showModal();
}));
