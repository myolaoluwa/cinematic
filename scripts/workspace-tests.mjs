import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ApiError,
  assertSameOrigin,
  hashPassword,
  isISODate,
  ipHash,
  newClientPassword,
  newShareToken,
  openSession,
  passwordMatches,
  requireSelectionLimit,
  requireText,
  sealSession,
  tokenHash,
} from '../server/runtime.js';

process.env.WORKSPACE_SESSION_SECRET = 'test-secret-with-more-than-thirty-two-bytes';

test('every API route imports and exposes a function handler', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
  const routes = walk(path.join(root, 'api')).filter(filename => filename.endsWith('.js'));

  for (const filename of routes) {
    const route = await import(pathToFileURL(filename));
    assert.equal(typeof route.default, 'function', `Missing API handler: ${path.relative(root, filename)}`);
  }
});

test('collection passwords are salted and checked without storing plaintext', () => {
  const one = hashPassword('a private collection password');
  const two = hashPassword('a private collection password');
  assert.notEqual(one.salt, two.salt);
  assert.notEqual(one.hash, two.hash);
  assert.equal(passwordMatches('a private collection password', one.salt, one.hash), true);
  assert.equal(passwordMatches('incorrect password', one.salt, one.hash), false);
});

test('signed sessions reject tampering, wrong purposes, and expired sessions', () => {
  const session = { kind: 'owner', userId: 'owner-id', exp: Date.now() + 60_000 };
  const signed = sealSession(session);
  assert.deepEqual(openSession(signed, 'owner'), session);
  assert.equal(openSession(signed, 'client'), null);
  assert.equal(openSession(`${signed.slice(0, -1)}x`, 'owner'), null);
  assert.equal(openSession(sealSession({ ...session, exp: Date.now() - 1 }), 'owner'), null);
});

test('same-origin protection rejects cross-origin mutations', () => {
  const sameOrigin = {
    method: 'POST',
    headers: { origin: 'https://photos.example', host: 'photos.example', 'x-forwarded-proto': 'https' },
  };
  assert.doesNotThrow(() => assertSameOrigin(sameOrigin));
  assert.throws(() => assertSameOrigin({
    ...sameOrigin,
    headers: { ...sameOrigin.headers, origin: 'https://attacker.example' },
  }), ApiError);
});

test('collection names and selection caps are validated at the API boundary', () => {
  assert.equal(requireText('  Client shoot  ', 'collection name'), 'Client shoot');
  assert.equal(requireSelectionLimit('10'), 10);
  assert.throws(() => requireText('', 'collection name'), ApiError);
  assert.throws(() => requireText('name\nwith newline', 'collection name'), ApiError);
  assert.throws(() => requireSelectionLimit(0), ApiError);
  assert.throws(() => requireSelectionLimit(101), ApiError);
  assert.equal(isISODate('2026-11-20'), true);
  assert.equal(isISODate('2026-02-31'), false);
});

test('collection credentials use URL-safe tokens and hashed IP identifiers', () => {
  assert.match(newShareToken(), /^[A-Za-z0-9_-]{43}$/);
  assert.match(newClientPassword(), /^[A-Za-z0-9!@#$%]{16}$/);
  assert.match(tokenHash('token'), /^[a-f0-9]{64}$/);
  const request = { headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' } };
  assert.match(ipHash(request), /^[a-f0-9]{64}$/);
  assert.notEqual(ipHash(request), '203.0.113.8');
});
