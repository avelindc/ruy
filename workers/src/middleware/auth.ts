/**
 * BREAKOUT MUSIC — Authentication & Authorization Middleware
 *
 * Custom JWT verification with session and role data from Neon.
 * All protected endpoints require valid JWT tokens from /auth/login
 */

import type { DatabaseAdapter } from '../types/database';
import { AuthenticationError, AuthorizationError } from '../types/database';
import type { JwtVerifier } from '../types/jwt';
import { getJwtVerifier } from '../auth/verifierFactory';

export interface AuthContext {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  token: string;
  sessionId: string;
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: Request): string {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Verify JWT token using appropriate strategy based on configuration
 */
export async function verifyToken(
  token: string,
  env: any
): Promise<AuthContext> {
  try {
    // Get appropriate verifier based on provider config
    const verifier = await getJwtVerifier(env);

    // Verify token using strategy
    const result = await verifier.verify(token);

    if (!result.valid || !result.payload) {
      throw new AuthenticationError(
        result.error || 'Token verification failed'
      );
    }

    const payload = result.payload;

    if (typeof payload.jti !== 'string' || !payload.jti) {
      throw new AuthenticationError('Token is missing a session identifier');
    }

    // Role claims are informational only; requireAuth reads the trusted DB role.
    const rawRole = ((payload.user_role as any) || 'user').toLowerCase().trim();
    const normalizedRole: 'user' | 'admin' | 'super_admin' =
      (rawRole === 'admin' || rawRole === 'artist_manager') ? 'admin' :
      (rawRole === 'super_admin' || rawRole === 'superadmin') ? 'super_admin' : 'user';

    const authContext: AuthContext = {
      userId: payload.sub,
      email: payload.email || '',
      role: normalizedRole,
      token,
      sessionId: payload.jti,
    };

    return authContext;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(
      `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get user role from database (override JWT claim for security)
 * Falls back to token role if not found
 */
export async function getUserRole(
  userId: string,
  adapter: DatabaseAdapter
): Promise<'user' | 'admin' | 'super_admin'> {
  try {
    const user = await adapter.getUser(userId);
    if (user && user.role) {
      const normalized = (user.role || '').toLowerCase().trim();
      if (normalized === 'admin' || normalized === 'artist_manager') return 'admin';
      if (normalized === 'super_admin' || normalized === 'superadmin') return 'super_admin';
      return 'user';
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
  }

  // Default to 'user' if not found
  return 'user';
}

/**
 * Middleware: Require authentication
 * Throws AuthenticationError if token is invalid or missing
 */
export async function requireAuth(
  request: Request,
  env?: any,
  providedAdapter?: DatabaseAdapter,
): Promise<AuthContext> {
  const token = extractToken(request);

  // Use env from request if available, otherwise use global
  const environment = env || (globalThis as any).env || {};
  const context = await verifyToken(token, environment);
  const adapter = providedAdapter || await (await import('../adapters/factory')).createAdapter(environment);
  const user = await adapter.getUser(context.userId);
  if (!user || user.account_status !== 'active' || !(await adapter.isAuthSessionValid(context.userId, context.sessionId))) {
    throw new AuthenticationError('Session is invalid or has expired');
  }
  context.email = user.email;
  context.role = user.role || 'user';
  return context;
}

/**
 * Middleware: Require admin role
 * Throws AuthenticationError if user is not admin
 */
export async function requireAdmin(
  authContext: AuthContext,
  adapter: DatabaseAdapter
): Promise<void> {
  const role = await getUserRole(authContext.userId, adapter);
  const normalized = (role || '').toLowerCase().trim();

  if (normalized !== 'admin' && normalized !== 'super_admin' && normalized !== 'superadmin') {
    throw new AuthorizationError('Admin access required');
  }
}

/**
 * Middleware: Verify user owns resource
 * Throws AuthenticationError if user is not the owner and not admin
 */
export async function requireOwnership(
  authContext: AuthContext,
  resourceOwnerId: string,
  adapter: DatabaseAdapter
): Promise<void> {
  // Allow if user is the owner
  if (authContext.userId === resourceOwnerId) {
    return;
  }

  // Allow if user is admin
  const role = await getUserRole(authContext.userId, adapter);
  const normalized = (role || '').toLowerCase().trim();
  if (normalized === 'admin' || normalized === 'super_admin' || normalized === 'superadmin') {
    return;
  }

  throw new AuthorizationError('Access denied: You do not own this resource');
}

/**
 * Wrap an async request handler with authentication
 */
export function withAuth(
  handler: (request: Request, authContext: AuthContext, env: any) => Promise<Response>,
  env: any
) {
  return async (request: Request): Promise<Response> => {
    try {
      const authContext = await requireAuth(request, env);
      return await handler(request, authContext, env);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            code: error instanceof AuthorizationError ? 'FORBIDDEN' : 'AUTH_ERROR',
            timestamp: new Date().toISOString(),
          }),
          { status: error instanceof AuthorizationError ? 403 : 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
  };
}

/**
 * Wrap an async request handler with admin authentication
 */
export function withAdminAuth(
  handler: (request: Request, authContext: AuthContext, adapter: DatabaseAdapter, env: any) => Promise<Response>,
  adapter: DatabaseAdapter,
  env: any
) {
  return async (request: Request): Promise<Response> => {
    try {
      const authContext = await requireAuth(request, env);
      await requireAdmin(authContext, adapter);
      return await handler(request, authContext, adapter, env);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
            code: error instanceof AuthorizationError ? 'FORBIDDEN' : 'AUTH_ERROR',
            timestamp: new Date().toISOString(),
          }),
          { status: error.statusCode || 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
  };
}
