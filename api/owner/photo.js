import { assertSameOrigin, requireMethod, requireUuid, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbRpc, dbSelect, removeObjects, storageBucket } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'DELETE');
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const id = requireUuid(req.query?.id, 'photo');
  const rows = await dbSelect('collection_photos', { id: `eq.${id}` }, 'id,collection_id,storage_path,upload_status');
  const photo = rows[0];
  if (!photo) return res.status(204).end();
  const collections = await dbSelect('collections', {
    id: `eq.${photo.collection_id}`,
    owner_id: `eq.${owner.id}`,
  }, 'id');
  if (!collections[0]) return res.status(404).json({ error: 'That photo could not be found.' });
  if (photo.upload_status !== 'deleting') {
    await dbRpc('mark_collection_photo_deleting', {
      p_photo_id: id,
      p_owner_id: owner.id,
    });
  }
  await removeObjects(storageBucket(), [photo.storage_path]);
  await dbRpc('delete_collection_photo', { p_photo_id: id, p_owner_id: owner.id });
  return res.status(200).json({ deleted: true });
});
