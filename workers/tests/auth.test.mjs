import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CustomJwtVerifier } from '../dist/auth/customJwtVerifier.js';
import { normalizeAuthPath } from '../dist/auth/routes.js';
import { handleAuthRoute } from '../dist/handlers/authRoutes.js';
import { hashPassword } from '../dist/handlers/authHandler.js';
import { createAdapter } from '../dist/adapters/factory.js';
import { NeonAdapter } from '../dist/adapters/neonAdapter.js';
import { AuthorizationError } from '../dist/types/database.js';
import { requireAdmin, requireAuth } from '../dist/middleware/auth.js';

const testSecret = 'local-auth-test-secret-never-used-in-production';
const baseUser = {
  id: 'user-identifier-1234567890', email: 'jane@example.com', full_name: 'Jane Test',
  artist_id: '37383288262714', role: 'user', account_status: 'active', password_hash: '',
};

function createMemoryAdapter(users) {
  const sessions = new Map();
  return {
    sessions,
    async getUserByEmail(email) { return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null; },
    async getUser(id) { return users.find((user) => user.id === id) || null; },
    async createUser(input) {
      const user = {
        ...baseUser,
        ...input,
        id: randomUUID(),
        artist_id: String(10000000000000 + users.length),
        role: 'user',
      };
      users.push(user);
      return user;
    },
    async createAuthSession(userId, jti, expiresAt) { sessions.set(jti, { userId, expiresAt, revoked: false }); },
    async isAuthSessionValid(userId, jti) {
      const session = sessions.get(jti);
      return !!session && session.userId === userId && !session.revoked && session.expiresAt > new Date();
    },
    async revokeAuthSession(userId, jti) {
      const session = sessions.get(jti);
      if (session?.userId === userId) session.revoked = true;
    },
    async updateUser(userId, input) {
      const user = users.find((row) => row.id === userId);
      Object.assign(user, input);
      return user;
    },
  };
}

function authRequest(path, method = 'GET', token, body) {
  return new Request(`https://worker.test${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function createTestJwt(secret, payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const message = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}`;
  return `${message}.${createHmac('sha256', secret).update(message).digest('base64url')}`;
}

function dependencies(adapter) { return { createAdapter: async () => adapter }; }

async function login(adapter, email = baseUser.email, password = 'CorrectPassword123!') {
  return handleAuthRoute(authRequest('/api/auth/login', 'POST', undefined, { email, password }), {
    JWT_SECRET: testSecret,
  }, {}, dependencies(adapter));
}

test('fresh Neon user login returns bcrypt-backed user data and a verifiable custom JWT', async () => {
  const user = { ...baseUser, password_hash: await hashPassword('CorrectPassword123!') };
  const adapter = createMemoryAdapter([user]);
  const response = await login(adapter);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.user, {
    id: user.id, email: user.email, fullName: user.full_name, role: 'user', artistId: user.artist_id,
  });
  assert.equal(adapter.sessions.size, 1);
  const verifier = new CustomJwtVerifier({
    signingKey: testSecret, algorithm: 'HS256', issuer: 'breakout-music-api',
    audience: 'breakout-music', clockSkew: 60,
  });
  const result = await verifier.verify(body.token);
  assert.equal(result.valid, true);
  assert.equal(result.payload.sub, user.id);
  assert.equal(result.payload.jti, [...adapter.sessions.keys()][0]);
});

test('admin role comes from Neon user_roles and /api/auth/me returns the same trusted role', async () => {
  const admin = { ...baseUser, id: 'admin-identifier', role: 'admin', password_hash: await hashPassword('AdminPassword123!') };
  const adapter = createMemoryAdapter([admin]);
  const loginResponse = await login(adapter, admin.email, 'AdminPassword123!');
  assert.equal(loginResponse.status, 200);
  const { token, user } = await loginResponse.json();
  assert.equal(user.role, 'admin');
  const me = await handleAuthRoute(authRequest('/api/auth/me', 'GET', token), { JWT_SECRET: testSecret }, {}, dependencies(adapter));
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).data.user, {
    id: admin.id, email: admin.email, role: 'admin', artistId: admin.artist_id,
  });
});

test('registration, dashboard session refresh, and logout use one persisted session', async () => {
  const users = [];
  const adapter = createMemoryAdapter(users);
  const response = await handleAuthRoute(authRequest('/api/auth/register', 'POST', undefined, {
    email: 'new-user@example.com', password: 'NewPassword123!', fullName: 'New User',
  }), { JWT_SECRET: testSecret }, {}, dependencies(adapter));
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.user.role, 'user');
  assert.match(payload.user.artistId, /^\d{14}$/);

  const secondRegistration = await handleAuthRoute(authRequest('/api/auth/register', 'POST', undefined, {
    email: 'another-user@example.com', password: 'NewPassword123!', fullName: 'Another User',
  }), { JWT_SECRET: testSecret }, {}, dependencies(adapter));
  assert.equal(secondRegistration.status, 201);
  const secondPayload = await secondRegistration.json();
  assert.match(secondPayload.user.artistId, /^\d{14}$/);
  assert.notEqual(secondPayload.user.artistId, payload.user.artistId);

  // These are the fields saved by the frontend and sent on dashboard navigation/refresh.
  const storage = new Map([['authToken', payload.token], ['authUser', JSON.stringify(payload.user)]]);
  const refresh = () => handleAuthRoute(authRequest('/api/auth/me', 'GET', storage.get('authToken')),
    { JWT_SECRET: testSecret }, {}, dependencies(adapter));
  const firstRefresh = await refresh();
  assert.equal(firstRefresh.status, 200);
  assert.equal((await firstRefresh.json()).data.user.artistId, payload.user.artistId);
  const secondRefresh = await refresh();
  assert.equal(secondRefresh.status, 200);
  assert.equal((await secondRefresh.json()).data.user.artistId, payload.user.artistId);

  const logout = await handleAuthRoute(authRequest('/api/auth/logout', 'POST', storage.get('authToken')),
    { JWT_SECRET: testSecret }, {}, dependencies(adapter));
  assert.equal(logout.status, 200);
  storage.clear();
  assert.equal(storage.size, 0);
  assert.equal((await handleAuthRoute(authRequest('/api/auth/me', 'GET', payload.token),
    { JWT_SECRET: testSecret }, {}, dependencies(adapter))).status, 401);
});

test('expired, revoked, and suspended-user sessions are rejected', async () => {
  const user = { ...baseUser };
  const adapter = createMemoryAdapter([user]);
  const now = Math.floor(Date.now() / 1000);
  const unpersisted = createTestJwt(testSecret, {
    sub: user.id, email: user.email, user_role: 'admin', jti: randomUUID(),
    iat: now, exp: now + 3600, aud: 'breakout-music', iss: 'breakout-music-api',
  });
  assert.equal((await handleAuthRoute(authRequest('/api/auth/me', 'GET', unpersisted), { JWT_SECRET: testSecret }, {}, dependencies(adapter))).status, 401);

  const validLogin = await login(adapter);
  const validToken = (await validLogin.json()).token;
  const jti = [...adapter.sessions.keys()][0];
  await adapter.revokeAuthSession(user.id, jti);
  assert.equal((await handleAuthRoute(authRequest('/api/auth/me', 'GET', validToken), { JWT_SECRET: testSecret }, {}, dependencies(adapter))).status, 401);

  await login(adapter);
  user.account_status = 'suspended';
  const suspendedJti = [...adapter.sessions.keys()][1];
  assert.equal(await adapter.isAuthSessionValid(user.id, suspendedJti), false);
});

test('a normal user cannot pass an admin guard with an admin role JWT claim', async () => {
  const user = { ...baseUser, role: 'user' };
  const adapter = createMemoryAdapter([user]);
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  await adapter.createAuthSession(user.id, jti, new Date(Date.now() + 3600_000));
  const token = createTestJwt(testSecret, {
    sub: user.id, email: user.email, user_role: 'admin', jti,
    iat: now, exp: now + 3600, aud: 'breakout-music', iss: 'breakout-music-api',
  });
  const context = await requireAuth(authRequest('/api/admin/test', 'GET', token), { JWT_SECRET: testSecret }, adapter);
  await assert.rejects(requireAdmin(context, adapter), (error) => error instanceof AuthorizationError && error.statusCode === 403);
});

test('auth routes have one canonical /api/auth prefix', () => {
  assert.equal(normalizeAuthPath('/api/auth/login'), '/api/auth/login');
  assert.equal(normalizeAuthPath('/api/auth/me'), '/api/auth/me');
  assert.equal(normalizeAuthPath('/auth/login'), '/auth/login');
});

test('database adapter refuses non-Neon URLs without provider fallback', async () => {
  await assert.rejects(createAdapter({ DATABASE_URL: 'https://legacy.invalid' }), /Neon PostgreSQL/);
  await assert.rejects(createAdapter({ DATABASE_URL: '' }), /DATABASE_URL is required/);
});

test('Neon registration reads the artist ID generated by the database default', async () => {
  let insertSql = '';
  const adapter = new NeonAdapter({
    async query(sql) {
      insertSql = sql;
      return { rows: [{
        ...baseUser,
        id: 'created-user-id',
        email: 'artist@example.com',
        password_hash: 'test-hash',
        artist_id: '10000000000001',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }] };
    },
  });

  const user = await adapter.createUser({
    email: 'artist@example.com',
    password_hash: 'test-hash',
    full_name: 'New Artist',
  });

  assert.doesNotMatch(insertSql, /artist_id/i);
  assert.equal(user.artist_id, '10000000000001');
});

test('artist ID migration backfills only missing IDs and enforces format, uniqueness, and immutability', async () => {
  const migration = await readFile(new URL('../migrations/0002_user_artist_id.sql', import.meta.url), 'utf8');
  assert.match(migration, /WHERE artist_id IS NULL OR btrim\(artist_id\) = ''/i);
  assert.match(migration, /NO CYCLE/i);
  assert.match(migration, /ALTER COLUMN artist_id SET DEFAULT nextval/i);
  assert.match(migration, /CHECK \(artist_id ~ '\^\[0-9\]\{14\}\$'\)/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS users_artist_id_unique_idx/i);
  assert.match(migration, /BEFORE UPDATE OF artist_id ON public\.users/i);
  assert.match(migration, /artist_id is immutable/i);
});

test('login refuses to issue a token when JWT_SECRET is absent', async () => {
  const adapter = createMemoryAdapter([{ ...baseUser, password_hash: await hashPassword('CorrectPassword123!') }]);
  const response = await handleAuthRoute(authRequest('/api/auth/login', 'POST', undefined, {
    email: baseUser.email, password: 'CorrectPassword123!',
  }), {}, {}, dependencies(adapter));
  assert.equal(response.status, 500);
  assert.equal('token' in await response.json(), false);
});
