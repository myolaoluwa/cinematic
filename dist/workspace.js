const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const loginView = $('#login-view');
const appView = $('#app-view');
const dashboardView = $('#dashboard-view');
const collectionView = $('#collection-view');
const loginForm = $('#login-form');
const collectionList = $('#collection-list');
const credentialsDialog = $('#credentials-dialog');
let collections = [];
let currentCollection = null;
let currentDetail = null;
let pendingPhotoDelete = null;
let messageTimer = 0;

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
      ? 'The workspace API is unavailable in this static preview. Use Vercel with the workspace environment configured.'
      : 'The workspace could not complete that action.';
    const error = new Error(result.error || defaultMessage);
    error.status = response.status;
    throw error;
  }
  return result;
}

function showGlobal(message, isError = false) {
  const node = $('#global-message');
  node.textContent = message;
  node.classList.toggle('is-error', isError);
  node.hidden = false;
  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => { node.hidden = true; }, 7000);
}

function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}

function collectionState(collection) {
  if (collection.status === 'deleting') return 'Removal pending';
  if (collection.status !== 'published') return 'Draft';
  if (!collection.accessExpiresAt || Date.parse(collection.accessExpiresAt) <= Date.now()) return 'Access expired';
  return 'Open to client';
}

function renderCollections() {
  const openCount = collections.filter(item => item.status === 'published' && Date.parse(item.accessExpiresAt || 0) > Date.now()).length;
  const readyCount = collections.filter(item => item.status !== 'published' && item.status !== 'deleting' && item.photoCounts.proofs > 0).length;
  $('#active-count').textContent = String(openCount).padStart(2, '0');
  $('#total-count').textContent = String(collections.length).padStart(2, '0');
  $('#ready-count').textContent = String(readyCount).padStart(2, '0');
  $('#collection-list-count').textContent = `${String(collections.length).padStart(2, '0')} COLLECTION${collections.length === 1 ? '' : 'S'}`;
  $('#empty-state').hidden = collections.length > 0;
  collectionList.innerHTML = collections.map(collection => {
    const state = collectionState(collection);
    const date = collection.shootDate
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${collection.shootDate}T00:00:00Z`))
      : 'Date not set';
    const mediaCount = collection.photoCounts.proofs + collection.photoCounts.finals;
    return `<button class="collection-card" type="button" data-open-collection="${escapeHtml(collection.id)}">
      <span><span class="card-status">${escapeHtml(state)}</span><h3>${escapeHtml(collection.title)}</h3><p>${escapeHtml(collection.clientName || 'Client not named')} · ${escapeHtml(date)}</p></span>
      <span class="card-count"><strong>${String(mediaCount).padStart(2, '0')}</strong><span>PHOTOS</span></span>
    </button>`;
  }).join('');
}

async function loadCollections() {
  const result = await request('/api/owner/collections');
  collections = result.collections;
  renderCollections();
}

function showDashboard() {
  currentCollection = null;
  currentDetail = null;
  collectionView.hidden = true;
  dashboardView.hidden = false;
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

function renderPhotoGrid(role) {
  const photos = currentDetail.photos.filter(photo => photo.role === role);
  const pending = currentDetail.pendingPhotos.filter(photo => photo.role === role);
  const grid = role === 'proof' ? $('#proof-grid') : $('#final-grid');
  const empty = role === 'proof' ? $('#proof-empty') : $('#final-empty');
  grid.innerHTML = photos.map((photo, index) => `<figure class="owner-photo">
    <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy">
    <button class="photo-delete" type="button" data-delete-photo="${escapeHtml(photo.id)}" aria-label="Remove ${escapeHtml(photo.name)}">×</button>
    <figcaption><span title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</span><span>${photo.publishedAt ? String(index + 1).padStart(2, '0') : 'NOT PUBLISHED'}</span></figcaption>
  </figure>`).join('') + pending.map(photo => `<figure class="owner-photo pending-photo">
    <div class="pending-image" role="img" aria-label="${photo.status === 'deleting' ? 'Removal pending' : 'Upload incomplete'}">${photo.status === 'deleting' ? 'REMOVAL PENDING' : 'UPLOAD INCOMPLETE'}</div>
    <button class="photo-delete" type="button" data-delete-photo="${escapeHtml(photo.id)}" aria-label="Remove incomplete upload ${escapeHtml(photo.name)}">×</button>
    <figcaption><span title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</span><span>${photo.status === 'deleting' ? 'RETRY REMOVE' : 'INCOMPLETE'}</span></figcaption>
  </figure>`).join('');
  empty.hidden = photos.length + pending.length > 0;
}

function renderSelections() {
  const selectedIds = new Set(currentDetail.selections.map(item => item.photoId));
  const proofById = new Map(currentDetail.photos.filter(photo => photo.role === 'proof').map(photo => [photo.id, photo]));
  const selected = [...selectedIds].map(id => proofById.get(id)).filter(Boolean);
  const submitted = Boolean(currentDetail.collection.selectionSubmittedAt);
  $('#selection-summary').textContent = submitted
    ? `The client sent ${selected.length} of ${currentDetail.collection.selectionLimit} photo choices.`
    : 'Selections appear here after the client submits them.';
  $('#selection-state').innerHTML = submitted
    ? `<div class="selection-list">${selected.map((photo, index) => `<span class="selection-chip"><img src="${escapeHtml(photo.url)}" alt=""><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(photo.name)}</span></span>`).join('')}</div>`
    : '<p>No submitted choices yet. The client can select photos until they send their list.</p>';
  $('#reopen-selections').hidden = !submitted || currentDetail.collection.status === 'deleting';
}

function fillDetails() {
  const collection = currentDetail.collection;
  const form = $('#details-form');
  form.elements.title.value = collection.title || '';
  form.elements.clientName.value = collection.clientName || '';
  form.elements.shootDate.value = collection.shootDate || '';
  form.elements.selectionLimit.value = collection.selectionLimit;
  $('#collection-title').textContent = collection.title;
  $('#collection-subtitle').textContent = [
    collection.clientName || 'Client not named',
    collection.shootDate ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${collection.shootDate}T00:00:00Z`)) : 'Shoot date not set',
    `${collection.selectionLimit} photo selections`,
  ].join(' · ');
  const state = collectionState(collection);
  const isDeleting = collection.status === 'deleting';
  $('#collection-status').textContent = `${state.toUpperCase()} · ${collection.status === 'published' ? 'CLIENT GALLERY' : 'NOT YET SHARED'}`;
  const publishButton = $('#publish-button');
  publishButton.innerHTML = collection.status === 'published' && Date.parse(collection.accessExpiresAt || 0) > Date.now()
    ? 'PUBLISH UPDATES <span aria-hidden="true">↗</span>'
    : collection.status === 'published' ? 'REPUBLISH TO CLIENT <span aria-hidden="true">↗</span>' : 'PUBLISH TO CLIENT <span aria-hidden="true">↗</span>';
  publishButton.disabled = collection.status === 'deleting';
  $('#details-form').querySelectorAll('input, button').forEach(control => { control.disabled = isDeleting; });
  $('#proof-upload').disabled = isDeleting;
  $('#final-upload').disabled = isDeleting;
  $('#replace-credentials').disabled = isDeleting;
  $('#reopen-selections').disabled = isDeleting;
  $('#delete-title').textContent = isDeleting ? 'Collection removal is in progress.' : 'Delete this collection.';
  $('#delete-collection').textContent = isDeleting ? 'RETRY COLLECTION REMOVAL' : 'DELETE COLLECTION';
  const notice = $('#expiry-notice');
  if (isDeleting) {
    notice.textContent = 'Client access has ended. Retry removal to finish permanently deleting the collection and its photos.';
    notice.hidden = false;
  } else if (collection.status === 'published' && collection.accessExpiresAt) {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(collection.accessExpiresAt));
    notice.textContent = Date.parse(collection.accessExpiresAt) > Date.now()
      ? `Client access is open until ${date}. Publishing new photos or republishing this collection starts a fresh 30-day access period.`
      : `Client access expired on ${date}. Republish this collection to give the client another 30 days.`;
    notice.hidden = false;
  } else {
    notice.hidden = true;
  }
  renderPhotoGrid('proof');
  renderPhotoGrid('final');
  renderSelections();
}

async function openCollection(id) {
  try {
    const detail = await request(`/api/owner/collection?id=${encodeURIComponent(id)}`);
    currentCollection = id;
    currentDetail = detail;
    dashboardView.hidden = true;
    collectionView.hidden = false;
    fillDetails();
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (error) {
    showGlobal(error.message, true);
  }
}

function showCredentials(link, password, isReplacement = false) {
  $('#credentials-title').textContent = isReplacement ? 'Your new access details.' : 'Keep these details safe.';
  $('#credentials-intro').textContent = isReplacement
    ? 'The previous link and password have been replaced. Share these new details through separate channels.'
    : 'Share the collection link and password through separate channels. The password will not be shown again.';
  $('#credential-link').value = link;
  $('#credential-password').value = password;
  $('#copy-status').textContent = '';
  credentialsDialog.showModal();
}

async function createCollection(form) {
  const submit = form.querySelector('[type=submit]');
  setBusy(submit, true, 'CREATING COLLECTION…');
  $('#create-error').hidden = true;
  try {
    const body = Object.fromEntries(new FormData(form));
    const result = await request('/api/owner/collections', { method: 'POST', body: JSON.stringify(body) });
    form.reset();
    form.elements.selectionLimit.value = '10';
    form.hidden = true;
    showCredentials(result.credentials.url, result.credentials.password);
    await loadCollections();
    await openCollection(result.collection.id);
  } catch (error) {
    const node = $('#create-error');
    node.textContent = error.message;
    node.hidden = false;
  } finally {
    setBusy(submit, false);
  }
}

async function updateDetails(form) {
  const submit = form.querySelector('[type=submit]');
  setBusy(submit, true, 'SAVING…');
  try {
    const body = Object.fromEntries(new FormData(form));
    const result = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    currentDetail.collection = result.collection;
    fillDetails();
    await loadCollections();
    showGlobal('Collection details saved.');
  } catch (error) {
    showGlobal(error.message, true);
  } finally {
    setBusy(submit, false);
  }
}

async function publishCollection() {
  const button = $('#publish-button');
  setBusy(button, true, 'PUBLISHING…');
  try {
    const result = await request('/api/owner/publish', {
      method: 'POST',
      body: JSON.stringify({ id: currentCollection }),
    });
    currentDetail.collection = result.collection;
    fillDetails();
    await loadCollections();
    showGlobal('The client gallery is published. Share the private link and password.');
  } catch (error) {
    showGlobal(error.message, true);
  } finally {
    setBusy(button, false);
    fillDetails();
  }
}

async function rotateCredentials() {
  const button = $('#replace-credentials');
  button.disabled = true;
  try {
    const result = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset-credentials' }),
    });
    showCredentials(result.url, result.password, true);
    showGlobal('The old collection link and password no longer work.');
  } catch (error) {
    showGlobal(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function copyCredential(which) {
  const input = which === 'link' ? $('#credential-link') : $('#credential-password');
  const status = $('#copy-status');
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = which === 'link' ? 'Link copied.' : 'Password copied.';
  } catch {
    input.focus();
    input.select();
    const copied = document.execCommand('copy');
    status.textContent = copied ? 'Copied.' : 'Select and copy the text manually.';
  }
}

async function compressProof(file) {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 2200;
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const context = canvas.getContext('2d', { alpha: false });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.84));
  if (!blob) throw new Error('This image could not be prepared as a proof.');
  return blob;
}

async function uploadFiles(role, files) {
  if (!files.length) return;
  const status = role === 'proof' ? $('#proof-upload-status') : $('#final-upload-status');
  const input = role === 'proof' ? $('#proof-upload') : $('#final-upload');
  input.disabled = true;
  let uploaded = 0;
  const failures = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    status.textContent = `Preparing ${index + 1} of ${files.length}: ${file.name}`;
    try {
      const uploadData = role === 'proof' ? await compressProof(file) : file;
      const contentType = role === 'proof' ? 'image/jpeg' : file.type;
      const name = role === 'proof' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
      const prepared = await request('/api/owner/photo-upload', {
        method: 'POST',
        body: JSON.stringify({
          collectionId: currentCollection,
          role,
          contentType,
          size: uploadData.size,
          name,
        }),
      });
      const response = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        headers: {
          apikey: prepared.apiKey,
          Authorization: `Bearer ${prepared.apiKey}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: uploadData,
      });
      if (!response.ok) throw new Error('The secure photo upload did not finish.');
      await request('/api/owner/photo-complete', {
        method: 'POST',
        body: JSON.stringify({ photoId: prepared.photoId }),
      });
      uploaded++;
    } catch (error) {
      failures.push(`${file.name}: ${error.message}`);
    }
    status.textContent = `Uploaded ${uploaded} of ${files.length}${failures.length ? ` · ${failures.length} need attention` : ''}.`;
  }
  input.value = '';
  input.disabled = false;
  try {
    currentDetail = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`);
    fillDetails();
    await loadCollections();
  } catch (error) {
    showGlobal(error.message, true);
  }
  if (failures.length) showGlobal(failures.join(' '), true);
  else status.textContent = `${uploaded} ${role === 'proof' ? 'proof' : 'final'} photo${uploaded === 1 ? '' : 's'} added.`;
}

async function deletePhoto(id) {
  try {
    await request(`/api/owner/photo?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    currentDetail = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`);
    fillDetails();
    await loadCollections();
    showGlobal('Photo removed.');
  } catch (error) {
    showGlobal(error.message, true);
  }
}

async function reopenSelections() {
  try {
    await request('/api/owner/selection-reopen', {
      method: 'POST',
      body: JSON.stringify({ id: currentCollection }),
    });
    currentDetail = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`);
    fillDetails();
    showGlobal('Selections reopened for the client.');
  } catch (error) {
    showGlobal(error.message, true);
  }
}

async function deleteCollection() {
  const button = $('#confirm-delete');
  setBusy(button, true, 'REMOVING PHOTOS…');
  try {
    await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`, { method: 'DELETE' });
    $('#confirm-delete-dialog').close();
    await loadCollections();
    showDashboard();
    showGlobal('The collection and its photos were permanently removed.');
  } catch (error) {
    showGlobal(`${error.message} The collection remains marked for removal; you can retry from the collection list.`, true);
    $('#confirm-delete-dialog').close();
    try {
      currentDetail = await request(`/api/owner/collection?id=${encodeURIComponent(currentCollection)}`);
      fillDetails();
      await loadCollections();
    } catch (refreshError) {
      showGlobal(`${error.message} The collection remains marked for removal. Refresh to try again. ${refreshError.message}`, true);
    }
  } finally {
    setBusy(button, false);
  }
}

async function initialize() {
  try {
    await loadCollections();
    loginView.hidden = true;
    appView.hidden = false;
  } catch (error) {
    if (error.status !== 401) {
      const node = $('#login-error');
      node.textContent = error.message;
      node.hidden = false;
    }
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('[type=submit]');
  const errorNode = $('#login-error');
  errorNode.hidden = true;
  setBusy(button, true, 'SIGNING IN…');
  try {
    const data = Object.fromEntries(new FormData(loginForm));
    await request('/api/owner/login', { method: 'POST', body: JSON.stringify(data) });
    loginForm.reset();
    loginView.hidden = true;
    appView.hidden = false;
    await loadCollections();
  } catch (error) {
    errorNode.textContent = error.message;
    errorNode.hidden = false;
  } finally {
    setBusy(button, false);
  }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    await request('/api/owner/logout', { method: 'POST', body: '{}' });
  } catch (error) {
    showGlobal(`Could not sign out. ${error.message}`, true);
    return;
  }
  appView.hidden = true;
  loginView.hidden = false;
  showDashboard();
});

$('#new-collection-button').addEventListener('click', () => {
  $('#create-form').hidden = false;
  $('#create-form').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  $('#create-form').elements.title.focus();
});
$$('[data-open-create]').forEach(button => button.addEventListener('click', () => $('#new-collection-button').click()));
$('#cancel-create').addEventListener('click', () => { $('#create-form').hidden = true; });
$('#create-form').addEventListener('submit', event => { event.preventDefault(); createCollection(event.currentTarget); });
collectionList.addEventListener('click', event => {
  const card = event.target.closest('[data-open-collection]');
  if (card) openCollection(card.dataset.openCollection);
});
$('#back-to-collections').addEventListener('click', showDashboard);
$('#details-form').addEventListener('submit', event => { event.preventDefault(); updateDetails(event.currentTarget); });
$('#publish-button').addEventListener('click', publishCollection);
$('#replace-credentials').addEventListener('click', rotateCredentials);
$('#proof-upload').addEventListener('change', event => uploadFiles('proof', [...event.target.files]));
$('#final-upload').addEventListener('change', event => uploadFiles('final', [...event.target.files]));
$('#proof-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-delete-photo]');
  if (button) {
    pendingPhotoDelete = button.dataset.deletePhoto;
    $('#confirm-photo-name').textContent = button.getAttribute('aria-label').replace(/^(Remove|Remove incomplete upload) /, '');
    $('#confirm-photo-dialog').showModal();
  }
});
$('#final-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-delete-photo]');
  if (button) {
    pendingPhotoDelete = button.dataset.deletePhoto;
    $('#confirm-photo-name').textContent = button.getAttribute('aria-label').replace(/^(Remove|Remove incomplete upload) /, '');
    $('#confirm-photo-dialog').showModal();
  }
});
$('#reopen-selections').addEventListener('click', reopenSelections);
$('#delete-collection').addEventListener('click', () => $('#confirm-delete-dialog').showModal());
$('#confirm-delete').addEventListener('click', deleteCollection);
$('#confirm-photo-delete').addEventListener('click', async () => {
  const id = pendingPhotoDelete;
  pendingPhotoDelete = null;
  $('#confirm-photo-dialog').close();
  if (id) await deletePhoto(id);
});
credentialsDialog.addEventListener('click', event => {
  const copy = event.target.closest('[data-copy]');
  if (copy) copyCredential(copy.dataset.copy);
  if (event.target.closest('[data-close-dialog]')) credentialsDialog.close();
});
credentialsDialog.addEventListener('close', () => {
  $('#credential-link').value = '';
  $('#credential-password').value = '';
});
$('#confirm-delete-dialog').addEventListener('click', event => {
  if (event.target.closest('[data-close-dialog]')) $('#confirm-delete-dialog').close();
});
$('#confirm-photo-dialog').addEventListener('click', event => {
  if (event.target.closest('[data-close-dialog]')) {
    pendingPhotoDelete = null;
    $('#confirm-photo-dialog').close();
  }
});

initialize();
