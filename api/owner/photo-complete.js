import { ApiError, assertSameOrigin, readJson, requireMethod, requireUuid, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbSelect, dbUpdate, objectExists, storageBucket } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const { photoId } = readJson(req);
  const id = requireUuid(photoId, 'photo');
  const photos = await dbSelect('collection_photos', {
    id: `eq.${id}`,
    select: 'id,collection_id,storage_path,upload_status',
  }, 'id,collection_id,storage_path,upload_status');
  const photo = photos[0];
  if (!photo) throw new ApiError(404, 'That photo upload could not be found.');
  if (photo.upload_status === 'deleting') throw new ApiError(409, 'This photo is being removed and cannot be completed.');
  const collections = await dbSelect('collections', {
    id: `eq.${photo.collection_id}`,
    owner_id: `eq.${owner.id}`,
    status: 'neq.deleting',
  }, 'id');
  if (!collections[0]) throw new ApiError(404, 'That photo upload could not be found.');
  if (!await objectExists(storageBucket(), photo.storage_path)) {
    throw new ApiError(409, 'The image has not finished uploading. Please retry it.');
  }
  if (photo.upload_status === 'ready') return res.status(200).json({ photoId: id, status: 'ready' });
  const rows = await dbUpdate('collection_photos', { id: `eq.${id}`, upload_status: 'eq.pending' }, {
    upload_status: 'ready',
  }, 'id,upload_status');
  if (!rows?.[0]) throw new ApiError(409, 'This upload changed while it was being completed. Refresh the collection and try again.');
  return res.status(200).json({ photoId: id, status: rows?.[0]?.upload_status || 'ready' });
});
