const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const pathToken = location.pathname.match(/^\/collection\/([^/]+)\/?$/)?.[1];
const collectionToken = params.get('collection') || (pathToken ? decodeURIComponent(pathToken) : '');
let galleryData = null;
let busySelection = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {};
  if (!response.ok) {
    const defaultMessage = response.status === 404
      ? 'The gallery service is unavailable. Please open this link again later or contact Evayoung Photography.'
      : 'This collection could not be opened.';
    const error = new Error(result.error || defaultMessage);
    error.status = response.status;
    throw error;
  }
  return result;
}

function setMessage(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

function updateCounter() {
  const selected = galleryData.proofs.filter(photo => photo.selected).length;
  $('#selection-counter').textContent = `${selected} OF ${galleryData.collection.selectionLimit} SELECTED`;
}

function renderProofs() {
  const locked = Boolean(galleryData.collection.selectionSubmittedAt);
  $('#proof-instructions').textContent = locked
    ? 'Your choices have been sent to Evayoung Photography.'
    : `Choose up to ${galleryData.collection.selectionLimit} photos. You can change your choices until you submit them.`;
  $('#proof-gallery').innerHTML = galleryData.proofs.map((photo, index) => `<figure class="client-photo">
    <button class="photo-select" type="button" data-select-photo="${escapeHtml(photo.id)}"     aria-pressed="${photo.selected}" aria-label="${photo.selected ? 'Remove selection for' : 'Select'} ${escapeHtml(photo.name)}" ${busySelection || locked || (galleryData.proofs.filter(item => item.selected).length >= galleryData.collection.selectionLimit && !photo.selected) ? 'disabled' : ''}>
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy">
    </button>
    <figcaption class="photo-caption"><span>${escapeHtml(photo.name)}</span><span class="photo-number">${String(index + 1).padStart(2, '0')}</span></figcaption>
  </figure>`).join('');
  $('#selection-submit-area').hidden = locked;
  $('#selection-complete').hidden = !locked;
  $('#submit-selections').disabled = galleryData.proofs.filter(photo => photo.selected).length === 0;
  updateCounter();
}

function renderFinals() {
  const finals = galleryData.finals;
  $('#final-section').hidden = finals.length === 0;
  $('#final-count').textContent = `${String(finals.length).padStart(2, '0')} PHOTOS`;
  $('#final-gallery').innerHTML = finals.map((photo, index) => `<figure class="client-photo">
    <a class="photo-select" href="${escapeHtml(photo.url)}" target="_blank" rel="noopener" aria-label="Open final photo ${String(index + 1).padStart(2, '0')}">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy">
    </a>
    <figcaption class="photo-caption"><span>${escapeHtml(photo.name)}</span><span class="photo-number">${String(index + 1).padStart(2, '0')}</span></figcaption>
    <a class="download-link" href="${escapeHtml(photo.url)}" target="_blank" rel="noopener">DOWNLOAD PHOTO ↓</a>
  </figure>`).join('');
}

function renderGallery() {
  $('#access-view').hidden = true;
  $('#gallery-view').hidden = false;
  $('#gallery-title').textContent = galleryData.collection.title || 'Your photos.';
  $('#gallery-client').textContent = galleryData.collection.clientName ? `For ${galleryData.collection.clientName}` : '';
  const expiry = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(galleryData.collection.expiresAt));
  $('#gallery-expiry').textContent = `PRIVATE GALLERY · ACCESS AVAILABLE UNTIL ${expiry.toUpperCase()}`;
  setMessage($('#gallery-error'), '');
  renderProofs();
  renderFinals();
}

async function loadGallery() {
  galleryData = await request(`/api/client/collection?collectionToken=${encodeURIComponent(collectionToken)}`);
  renderGallery();
}

$('#access-form').addEventListener('submit', async event => {
  event.preventDefault();
  const passwordInput = $('#access-password');
  const button = event.currentTarget.querySelector('[type=submit]');
  const error = $('#access-error');
  setMessage(error, '');
  button.disabled = true;
  button.textContent = 'CHECKING PASSWORD…';
  try {
    if (!collectionToken) throw new Error('This collection link is incomplete. Ask Evayoung Photography for the correct link.');
    await request('/api/client/access', {
      method: 'POST',
      body: JSON.stringify({ collectionToken, password: passwordInput.value }),
    });
    passwordInput.value = '';
    await loadGallery();
  } catch (problem) {
    setMessage(error, problem.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'OPEN MY COLLECTION <span aria-hidden="true">↗</span>';
  }
});

$('#proof-gallery').addEventListener('click', async event => {
  const button = event.target.closest('[data-select-photo]');
  if (!button || busySelection || button.disabled) return;
  const photo = galleryData.proofs.find(item => item.id === button.dataset.selectPhoto);
  if (!photo) return;
  busySelection = true;
  button.disabled = true;
  const previous = photo.selected;
  photo.selected = !previous;
  renderProofs();
  try {
    await request('/api/client/selection', {
      method: 'POST',
      body: JSON.stringify({ photoId: photo.id, selected: photo.selected }),
    });
  } catch (error) {
    photo.selected = previous;
    renderProofs();
    setMessage($('#gallery-error'), error.message);
  } finally {
    busySelection = false;
    renderProofs();
  }
});

$('#submit-selections').addEventListener('click', () => $('#submit-dialog').showModal());
$('#confirm-submit').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'SENDING CHOICES…';
  try {
    await request('/api/client/submit', { method: 'POST', body: '{}' });
    $('#submit-dialog').close();
    await loadGallery();
  } catch (error) {
    $('#submit-dialog').close();
    setMessage($('#gallery-error'), error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'SEND MY CHOICES <span aria-hidden="true">↗</span>';
  }
});

$('#submit-dialog').addEventListener('click', event => {
  if (event.target.closest('[data-close-dialog]')) $('#submit-dialog').close();
});
$('#client-logout').addEventListener('click', async () => {
  try {
    await request('/api/client/logout', { method: 'POST', body: '{}' });
  } catch (error) {
    setMessage($('#gallery-error'), `Could not close the private gallery. ${error.message}`);
    return;
  }
  galleryData = null;
  $('#gallery-view').hidden = true;
  $('#access-view').hidden = false;
});

if (!collectionToken) {
  $('#access-password').disabled = true;
  $('#access-error').textContent = 'This collection link is incomplete. Ask Evayoung Photography for the correct link.';
  $('#access-error').hidden = false;
}

request(`/api/client/collection?collectionToken=${encodeURIComponent(collectionToken)}`)
  .then(result => {
    galleryData = result;
    renderGallery();
  })
  .catch(error => {
    if (error.status && error.status !== 401) {
      $('#access-error').textContent = error.message;
      $('#access-error').hidden = false;
    }
  });
