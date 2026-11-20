import { ApiError, assertSameOrigin, isISODate, newClientPassword, newShareToken, hashPassword, optionalText, readJson, requestOrigin, requireMethod, requireSelectionLimit, requireText, safeCollection, tokenHash, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbInsert, dbSelect } from '../../server/supabase.js';

export default withErrors(async (req, res) => {
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  if (req.method === 'GET') {
    requireMethod(req, 'GET');
    const rows = await dbSelect('collections', {
      owner_id: `eq.${owner.id}`,
      order: 'created_at.desc',
    }, 'id,title,client_name,shoot_date,selection_limit,status,created_at,published_at,access_expires_at,selection_submitted_at');
    const ids = rows.map(row => row.id);
    let photoCounts = {};
    if (ids.length) {
      const photos = await dbSelect('collection_photos', {
        collection_id: `in.(${ids.join(',')})`,
        upload_status: 'eq.ready',
        select: 'collection_id,role',
      }, 'collection_id,role');
      photoCounts = photos.reduce((counts, photo) => {
        counts[photo.collection_id] ??= { proofs: 0, finals: 0 };
        counts[photo.collection_id][photo.role === 'proof' ? 'proofs' : 'finals']++;
        return counts;
      }, {});
    }
    return res.status(200).json({ collections: rows.map(row => ({ ...safeCollection(row), photoCounts: photoCounts[row.id] || { proofs: 0, finals: 0 } })) });
  }

  requireMethod(req, 'POST');
  const body = readJson(req);
  const title = requireText(body.title, 'collection name');
  const clientName = optionalText(body.clientName, 'client name');
  const shootDate = body.shootDate === '' || body.shootDate == null ? null : body.shootDate;
  if (shootDate && !isISODate(shootDate)) {
    throw new ApiError(400, 'Choose a valid shoot date.');
  }
  const selectionLimit = requireSelectionLimit(body.selectionLimit ?? 10);
  const origin = requestOrigin(req);
  const shareToken = newShareToken();
  const password = newClientPassword();
  const credentialHash = hashPassword(password);
  const rows = await dbInsert('collections', {
    owner_id: owner.id,
    title,
    client_name: clientName,
    shoot_date: shootDate,
    selection_limit: selectionLimit,
    share_token_hash: tokenHash(shareToken),
    password_salt: credentialHash.salt,
    password_hash: credentialHash.hash,
    status: 'draft',
  }, 'id,title,client_name,shoot_date,selection_limit,status,created_at,published_at,access_expires_at,selection_submitted_at');
  const collection = rows?.[0];
  if (!collection) throw new ApiError(502, 'The collection could not be created.');
  return res.status(201).json({
    collection: safeCollection(collection),
    credentials: {
      url: `${origin}/collection/${shareToken}`,
      password,
    },
  });
});
