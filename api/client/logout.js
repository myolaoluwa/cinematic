import { assertSameOrigin, clearCookie, requireMethod, withErrors } from '../../server/runtime.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  clearCookie(res, 'evayoung_client', '/api/client');
  return res.status(204).end();
});
