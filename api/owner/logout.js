import { assertSameOrigin, requireMethod, withErrors } from '../../server/runtime.js';
import { endOwnerSession } from '../../server/auth.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  endOwnerSession(res);
  res.statusCode = 204;
  res.end();
});
