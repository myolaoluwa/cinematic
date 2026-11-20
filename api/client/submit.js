import { assertSameOrigin, requireMethod, withErrors } from '../../server/runtime.js';
import { requireClient } from '../../server/auth.js';
import { dbRpc } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const collection = await requireClient(req, res);
  const result = await dbRpc('submit_client_selections', { p_collection_id: collection.id });
  return res.status(200).json({ submittedAt: result?.submitted_at || result?.[0]?.submitted_at || new Date().toISOString() });
});
