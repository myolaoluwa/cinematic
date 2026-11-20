import { ApiError, requireMethod, tokenHash, withErrors } from '../../server/runtime.js';
import { requireClient } from '../../server/auth.js';
import { dbSelect, signedDownload, storageBucket } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'GET');
  const shareToken = req.query?.collectionToken;
  if (typeof shareToken !== 'string' || shareToken.length < 32 || shareToken.length > 128) {
    throw new ApiError(401, 'Enter the collection password to continue.');
  }
  const collection = await requireClient(req, res, tokenHash(shareToken));
  const [photos, selected] = await Promise.all([
    dbSelect('collection_photos', {
      collection_id: `eq.${collection.id}`,
      upload_status: 'eq.ready',
      published_at: 'not.is.null',
      order: 'created_at.asc',
    }, 'id,role,original_name,content_type,storage_path,published_at'),
    dbSelect('collection_selections', {
      collection_id: `eq.${collection.id}`,
    }, 'photo_id'),
  ]);
  const selectedIds = new Set(selected.map(item => item.photo_id));
  const signedUrlLifetime = Math.max(1, Math.min(
    3600,
    Math.floor((Date.parse(collection.access_expires_at) - Date.now()) / 1000),
  ));
  const media = await Promise.all(photos.map(async photo => ({
    id: photo.id,
    role: photo.role,
    name: photo.original_name,
    selected: selectedIds.has(photo.id),
    url: await signedDownload(
      storageBucket(),
      photo.storage_path,
      signedUrlLifetime,
      photo.role === 'final' ? photo.original_name : null,
    ),
  })));
  const finals = media.filter(photo => photo.role === 'final');
  const proofs = media.filter(photo => photo.role === 'proof');
  return res.status(200).json({
    collection: {
      title: collection.title,
      clientName: collection.client_name,
      selectionLimit: collection.selection_limit,
      expiresAt: collection.access_expires_at,
      selectionSubmittedAt: collection.selection_submitted_at,
    },
    proofs,
    finals,
    selectionCount: selected.length,
  });
});
