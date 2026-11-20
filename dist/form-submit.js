const formSubmitForms = document.querySelectorAll('.booking-form');

formSubmitForms.forEach(form => {
  const dialog = form.closest('dialog');
  if (dialog) {
    dialog.addEventListener('close', () => {
      form.reset();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = false;
      submit.textContent = 'SEND ENQUIRY';
      form.querySelector('.form-status').textContent = '';
      form.querySelector('.form-status').dataset.state = '';
      form.querySelector('.form-fallback').hidden = true;
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submit = form.querySelector('[type="submit"]');
    const status = form.querySelector('.form-status');
    const fallback = form.querySelector('.form-fallback');
    const originalLabel = submit.textContent;

    submit.disabled = true;
    submit.textContent = 'SENDING…';
    status.textContent = 'Sending your enquiry…';
    status.dataset.state = 'sending';
    fallback.hidden = true;

    try {
      const endpoint = form.action.replace(
        'https://formsubmit.co/',
        'https://formsubmit.co/ajax/'
      );
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form))
      });

      if (!response.ok) {
        throw new Error(`The form service returned ${response.status}.`);
      }

      const result = await response.json();
      if (result?.success !== 'true' && result?.success !== true) {
        throw new Error(result?.message || 'The form service did not accept the enquiry.');
      }

      const name = form.elements.namedItem('name').value.trim();
      form.reset();
      form.querySelector('[type="submit"]').textContent = 'SENT';
      status.textContent = `Thank you${name ? `, ${name}` : ''}. Your enquiry was submitted. We’ll reply to the email you provided.`;
      status.dataset.state = 'success';
    } catch (error) {
      console.error('Booking form submission failed:', error);
      status.textContent = 'We couldn’t send your enquiry just now. Please try again or email Evayoung Photography directly.';
      status.dataset.state = 'error';
      fallback.hidden = false;
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });
});
