import { ApiError, assertSameOrigin, isISODate, newClientPassword, newShareToken, hashPassword, readJson, requestOrigin, requireMethod, requireSelectionLimit, requireUuid, requireText, safeCollection, tokenHash, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbDelete, dbRpc, dbSelect, dbUpdate, removeObjects, signedDownload, storageBucket } from '../../server/supabase.js';

async function ownedCollection(id, ownerId, select = '*') {
  const rows = await dbSelect('collections', { id: `eq.${id}`, owner_id: `eq.${ownerId}` }, select);
  if (!rows[0]) throw new ApiError(404, 'That collection could not be found.');
  return rows[0];
}

export default withErrors(async (req, res) => {
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const id = requireUuid(req.query?.id);

  if (req.method === 'GET') {
    requireMethod(req, 'GET');
    const collection = await ownedCollection(id, owner.id);
    const photos = await dbSelect('collection_photos', {
      collection_id: `eq.${id}`,
      order: 'created_at.asc',
    }, 'id,role,original_name,content_type,file_size,upload_status,published_at,created_at,storage_path');
    const readyPhotos = collection.status === 'deleting'
      ? []
      : photos.filter(photo => photo.upload_status === 'ready');
    const signedPhotos = await Promise.all(readyPhotos.map(async photo => ({
      id: photo.id,
      role: photo.role,
      name: photo.original_name,
      size: photo.file_size,
      createdAt: photo.created_at,
      publishedAt: photo.published_at,
      url: await signedDownload(storageBucket(), photo.storage_path, 3600),
    })));
    const pendingPhotos = (collection.status === 'deleting'
      ? photos
      : photos.filter(photo => photo.upload_status !== 'ready')).map(photo => ({
      id: photo.id,
      role: photo.role,
      name: photo.original_name,
      status: collection.status === 'deleting' ? 'deleting' : photo.upload_status,
    }));
    const selections = await dbSelect('collection_selections', {
      collection_id: `eq.${id}`,
      select: 'photo_id,created_at',
    }, 'photo_id,created_at');
    return res.status(200).json({
      collection: safeCollection(collection),
      photos: signedPhotos,
      pendingPhotos,
      selections: selections.map(selection => ({ photoId: selection.photo_id, selectedAt: selection.created_at })),
    });
  }

  if (req.method === 'PATCH') {
    const body = readJson(req);
    const current = await ownedCollection(id, owner.id);
    const patch = {};
    let selectionLimitChanged = false;
    if ('title' in body) patch.title = requireText(body.title, 'collection name');
    if ('clientName' in body) patch.client_name = body.clientName === '' ? null : requireText(body.clientName, 'client name');
    if ('shootDate' in body) {
      patch.shoot_date = body.shootDate || null;
      if (patch.shoot_date && !isISODate(patch.shoot_date)) {
        throw new ApiError(400, 'Choose a valid shoot date.');
      }
    }
    if ('selectionLimit' in body) {
      const selectionLimit = requireSelectionLimit(body.selectionLimit);
      await dbRpc('set_collection_selection_limit', {
        p_collection_id: id,
        p_owner_id: owner.id,
        p_selection_limit: selectionLimit,
      });
      selectionLimitChanged = true;
    }
    if (!Object.keys(patch).length && !selectionLimitChanged) throw new ApiError(400, 'Choose a collection detail to update.');
    patch.updated_at = new Date().toISOString();
    const rows = Object.keys(patch).length
      ? await dbUpdate('collections', { id: `eq.${id}`, owner_id: `eq.${owner.id}` }, patch,
        'id,title,client_name,shoot_date,selection_limit,status,created_at,published_at,access_expires_at,selection_submitted_at')
      : [];
    const updated = rows?.[0] || (selectionLimitChanged
      ? await ownedCollection(id, owner.id, 'id,title,client_name,shoot_date,selection_limit,status,created_at,published_at,access_expires_at,selection_submitted_at')
      : current);
    return res.status(200).json({ collection: safeCollection(updated) });
  }

  if (req.method === 'DELETE') {
    requireMethod(req, 'DELETE');
    const collection = await ownedCollection(id, owner.id, 'id,status,share_token_hash');
    if (collection.status !== 'deleting') {
      await dbUpdate('collections', { id: `eq.${id}`, owner_id: `eq.${owner.id}` }, {
        status: 'deleting',
        updated_at: new Date().toISOString(),
      }, 'id');
    }
    const photos = await dbSelect('collection_photos', { collection_id: `eq.${id}` }, 'id,storage_path');
    await removeObjects(storageBucket(), photos.map(photo => photo.storage_path));
    await dbDelete('collection_selections', { collection_id: `eq.${id}` });
    await dbDelete('collection_photos', { collection_id: `eq.${id}` });
    await dbDelete('client_auth_attempts', { share_token_hash: `eq.${collection.share_token_hash}` });
    await dbDelete('collections', { id: `eq.${id}`, owner_id: `eq.${owner.id}` });
    return res.status(200).json({ deleted: true });
  }

  if (req.method === 'POST') {
    const body = readJson(req);
    if (body.action !== 'reset-credentials') throw new ApiError(400, 'Choose a valid collection action.');
    const current = await ownedCollection(id, owner.id, 'id,share_token_hash');
    const password = newClientPassword();
    const shareToken = newShareToken();
    const url = `${requestOrigin(req)}/collection/${shareToken}`;
    const credential = hashPassword(password);
    await dbDelete('client_auth_attempts', { share_token_hash: `eq.${current.share_token_hash}` });
    const rows = await dbUpdate('collections', { id: `eq.${id}`, owner_id: `eq.${owner.id}` }, {
      share_token_hash: tokenHash(shareToken),
      password_salt: credential.salt,
      password_hash: credential.hash,
      updated_at: new Date().toISOString(),
    }, 'id');
    if (!rows?.length) throw new ApiError(404, 'That collection could not be found.');
    return res.status(200).json({ url, password });
  }

  requireMethod(req, 'GET', 'PATCH', 'DELETE', 'POST');
});
