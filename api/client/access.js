import { ApiError, assertSameOrigin, ipHash, passwordMatches, readJson, requireMethod, tokenHash, withErrors } from '../../server/runtime.js';
import { startClientSession } from '../../server/auth.js';
import { dbSelect, dbRpc } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const { collectionToken, password } = readJson(req);
  if (typeof collectionToken !== 'string' || collectionToken.length < 32 || collectionToken.length > 128
    || typeof password !== 'string' || password.length > 256) {
    throw new ApiError(400, 'Enter the collection link and password.');
  }
  const shareHash = tokenHash(collectionToken);
  const rows = await dbSelect('collections', {
    share_token_hash: `eq.${shareHash}`,
  }, 'id,password_salt,password_hash,status,access_expires_at');
  const collection = rows[0];
  if (!collection) throw new ApiError(401, 'That password was not recognized.');
  const allowed = await dbRpc('record_client_auth_attempt', {
    p_share_token_hash: shareHash,
    p_ip_hash: ipHash(req),
    p_success: false,
  });
  if (!allowed) throw new ApiError(429, 'Too many attempts. Please wait 15 minutes before trying again.');
  const candidate = passwordMatches(password, collection.password_salt, collection.password_hash);
  if (candidate) {
    await dbRpc('record_client_auth_attempt', {
      p_share_token_hash: shareHash,
      p_ip_hash: ipHash(req),
      p_success: true,
    });
  }
  if (!candidate) throw new ApiError(401, 'That password was not recognized.');
  if (collection.status !== 'published' || !collection.access_expires_at || Date.parse(collection.access_expires_at) <= Date.now()) {
    throw new ApiError(410, 'This collection is no longer available. Contact Evayoung Photography if you need access.');
  }
  startClientSession(res, collection.id, shareHash);
  return res.status(204).end();
});
