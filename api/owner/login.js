import { ApiError, assertSameOrigin, readJson, requireMethod, withErrors, requireText } from '../../server/runtime.js';
import { startOwnerSession } from '../../server/auth.js';

export default withErrors(async (req, res) => {
  requireMethod(req, 'POST');
  assertSameOrigin(req);
  const body = readJson(req);
  const email = requireText(body.email, 'email address', 254).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 256) throw new ApiError(400, 'Enter your email and password.');
  try {
    await startOwnerSession(req, res, email, password);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.status === 400 || error?.status === 401) {
      throw new ApiError(401, 'That email or password was not recognized.');
    }
    throw error;
  }
  res.statusCode = 204;
  res.end();
});
