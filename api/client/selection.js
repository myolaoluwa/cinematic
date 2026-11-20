import { ApiError, assertSameOrigin, readJson, requireMethod, requireUuid, withErrors } from '../../server/runtime.js';
import { requireClient } from '../../server/auth.js';
import { dbRpc } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const collection = await requireClient(req, res);
  const body = readJson(req);
  const photoId = requireUuid(body.photoId, 'photo');
  if (typeof body.selected !== 'boolean') throw new ApiError(400, 'Choose whether to select this photo.');
  const count = await dbRpc('update_client_selection', {
    p_collection_id: collection.id,
    p_photo_id: photoId,
    p_selected: body.selected,
  });
  return res.status(200).json({ selectionCount: Number(count) });
});
