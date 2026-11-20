import { ApiError, assertSameOrigin, readJson, requireMethod, requireUuid, safeCollection, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbRpc } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const { id } = readJson(req);
  const collectionId = requireUuid(id);
  const rows = await dbRpc('publish_client_collection', {
    p_collection_id: collectionId,
    p_owner_id: owner.id,
  });
  const collection = Array.isArray(rows) ? rows[0] : rows;
  if (!collection) throw new ApiError(404, 'That collection could not be found.');
  return res.status(200).json({ collection: safeCollection(collection) });
});
