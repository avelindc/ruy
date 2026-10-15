/**
 * BREAKOUT MUSIC — Authentication Handler
 *
 * Login & Register endpoints
 * JWT generation with the Worker environment signing secret.
 * Neon-only database
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  error?: string;
}

import bcrypt from 'bcryptjs';
import type { DatabaseAdapter } from '../types/database';

function requireJwtSecret(env: any): string {
  const secret = typeof env?.JWT_SECRET === 'string' ? env.JWT_SECRET : '';
  if (!secret.trim()) {
    throw new Error('Authentication service is not configured');
  }
  return secret;
}

/** Password hashes use bcrypt; the signing secret is never used as a password salt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!/^\$2[aby]\$\d{2}\$/.test(passwordHash)) return false;
  try {
    return await bcrypt.compare(password, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Generate JWT token using HMAC-SHA256
 */
export async function generateJWT(
  userId: string,
  email: string,
  role: string,
  secret: string,
  expiresIn: number = 3600, // 1 hour
  tokenId: string = crypto.randomUUID(),
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    jti: tokenId,
    email: email,
    user_role: role,
    iat: now,
    exp: now + expiresIn,
    aud: 'breakout-music',
    iss: 'breakout-music-api',
  };

  // Encode header and payload to base64url
  const headerEncoded = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const payloadEncoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const message = `${headerEncoded}.${payloadEncoded}`;

  // Sign with HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signature = btoa(String.fromCharCode(...signatureArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${message}.${signature}`;
}

/** Handle POST /api/auth/login. */
export async function handleLogin(
  request: Request,
  env: any,
  dependencies: { createAdapter?: (env: any) => Promise<Pick<DatabaseAdapter, 'getUserByEmail' | 'createAuthSession'>> } = {}
): Promise<Response> {
  try {
    const body = (await request.json()) as LoginRequest;

    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email and password required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jwtSecret = requireJwtSecret(env);

    const createAdapter = dependencies.createAdapter || (await import('../adapters/factory')).createAdapter;
    const adapter = await createAdapter(env);

    // Get user by email
    const user = await adapter.getUserByEmail(body.email.trim());

    if (
      !user ||
      user.account_status !== 'active' ||
      !user.password_hash ||
      !(await verifyPassword(body.password, user.password_hash))
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email or password',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize role to lowercase
    const normalizedRole = (user.role || 'user').toLowerCase().trim();

    // Generate JWT
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    if (!adapter.createAuthSession) throw new Error('Session storage is not configured');
    await adapter.createAuthSession(user.id, tokenId, expiresAt);
    const token = await generateJWT(user.id, user.email, normalizedRole, jwtSecret, 3600, tokenId);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: normalizedRole,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle POST /auth/register
 */
export async function handleRegister(
  request: Request,
  env: any,
  dependencies: { createAdapter?: (env: any) => Promise<Pick<DatabaseAdapter, 'getUserByEmail' | 'createUser' | 'createAuthSession'>> } = {},
): Promise<Response> {
  try {
    const body = (await request.json()) as RegisterRequest;

    if (!body.email || !body.password || !body.fullName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email, password, and full name required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email format',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength (min 8 chars)
    if (body.password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Password must be at least 8 characters',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const jwtSecret = requireJwtSecret(env);

    // Hash password
    const passwordHash = await hashPassword(body.password);

    // Import createAdapter dynamically
    const createAdapter = dependencies.createAdapter || (await import('../adapters/factory')).createAdapter;
    const adapter = await createAdapter(env);

    // Check if user already exists
    const normalizedEmail = body.email.trim().toLowerCase();
    const existingUser = await adapter.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email already registered',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create user
    const newUser = await adapter.createUser({
      email: normalizedEmail,
      password_hash: passwordHash,
      full_name: body.fullName,
      account_status: 'active',
    });

    if (!newUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create user',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate JWT
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await adapter.createAuthSession(newUser.id, tokenId, expiresAt);
    const token = await generateJWT(newUser.id, newUser.email, 'user', jwtSecret, 3600, tokenId);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: 'user',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Register error:', error);

    // Check for duplicate email or other specific errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('unique') || errorMsg.includes('already exists')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email already registered',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Change a signed-in user's password in the configured Neon database. */
export async function handleChangePassword(
  request: Request,
  env: any,
  dependencies: { createAdapter?: (env: any) => Promise<Pick<DatabaseAdapter, 'getUser' | 'updateUser' | 'isAuthSessionValid'>> } = {},
): Promise<Response> {
  try {
    const createAdapter = dependencies.createAdapter || (await import('../adapters/factory')).createAdapter;
    const adapter = await createAdapter(env);
    const auth = await (await import('../middleware/auth')).requireAuth(request, env, adapter as DatabaseAdapter);
    const body = await request.json() as { currentPassword?: string; newPassword?: string };
    if (!body.currentPassword || !body.newPassword || body.newPassword.length < 8) {
      return new Response(JSON.stringify({ success: false, error: 'Current password and a new password of at least 8 characters are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jwtSecret = requireJwtSecret(env);
    const user = await adapter.getUser(auth.userId);
    if (!user || user.account_status !== 'active' || !user.password_hash || !(await verifyPassword(body.currentPassword, user.password_hash))) {
      return new Response(JSON.stringify({ success: false, error: 'Current password is incorrect' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await adapter.updateUser(auth.userId, { password_hash: await hashPassword(body.newPassword) });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const status = error instanceof Error && error.name === 'AuthenticationError' ? 401 : 500;
    console.error('Password change failed');
    return new Response(JSON.stringify({ success: false, error: status === 401 ? 'Authentication required' : 'Password change failed' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
