import { ApiError, assertSameOrigin, readJson, requireMethod, requireUuid, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbRpc, dbSelect } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const { id } = readJson(req);
  const collectionId = requireUuid(id);
  const count = await dbRpc('reopen_client_selections', {
    p_collection_id: collectionId,
    p_owner_id: owner.id,
  });
  if (count == null) throw new ApiError(404, 'That collection could not be found.');
  return res.status(200).json({ selectionCount: Number(count) });
});
