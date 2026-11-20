import { randomUUID } from 'node:crypto';
import { ApiError, assertSameOrigin, optionalText, readJson, requireMethod, requireUuid, withErrors } from '../../server/runtime.js';
import { requireOwner } from '../../server/auth.js';
import { dbInsert, dbSelect, signedUpload, storageBucket } from '../../server/supabase.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const owner = await requireOwner(req, res);
  const body = readJson(req);
  const collectionId = requireUuid(body.collectionId);
  const role = body.role;
  if (!['proof', 'final'].includes(role)) throw new ApiError(400, 'Choose proofs or final images.');
  const contentType = body.contentType;
  if (!Object.hasOwn(TYPES, contentType)) throw new ApiError(415, 'Use a JPEG, PNG, WebP, or AVIF image.');
  const size = Number(body.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) {
    throw new ApiError(413, 'Each image must be smaller than 50 MB.');
  }
  const suppliedName = optionalText(body.name, 'file name', 180) || `photo.${TYPES[contentType]}`;
  const originalName = suppliedName.replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g, '_').slice(0, 180);
  const collections = await dbSelect('collections', {
    id: `eq.${collectionId}`,
    owner_id: `eq.${owner.id}`,
    status: 'neq.deleting',
  }, 'id');
  if (!collections[0]) throw new ApiError(404, 'That collection could not be found.');

  const photoId = randomUUID();
  const storagePath = `${collectionId}/${role}/${photoId}.${TYPES[contentType]}`;
  const rows = await dbInsert('collection_photos', {
    id: photoId,
    collection_id: collectionId,
    role,
    original_name: originalName,
    content_type: contentType,
    file_size: size,
    storage_path: storagePath,
    upload_status: 'pending',
    published_at: null,
  }, 'id');
  if (!rows?.length) throw new ApiError(502, 'The photo upload could not be prepared.');
  const upload = await signedUpload(storageBucket(), storagePath);
  return res.status(201).json({ photoId, storagePath, ...upload });
});
