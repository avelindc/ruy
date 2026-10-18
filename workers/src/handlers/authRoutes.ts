import { requireAuth } from '../middleware/auth';
import { handleChangePassword, handleLogin, handleRegister } from './authHandler';
import { normalizeAuthPath } from '../auth/routes';
import type { DatabaseAdapter } from '../types/database';
import { AuthenticationError } from '../types/database';

type AuthRouteDependencies = {
  createAdapter?: (env: any) => Promise<DatabaseAdapter>;
};

function jsonResponse(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Handle all custom-JWT endpoints under the canonical /api/auth prefix. */
export async function handleAuthRoute(
  request: Request,
  env: any,
  headers: Record<string, string>,
  dependencies: AuthRouteDependencies = {},
): Promise<Response | null> {
  const authPath = normalizeAuthPath(new URL(request.url).pathname);

  if (authPath === '/api/auth/login' && request.method === 'POST') {
    const response = await handleLogin(request, env, { createAdapter: dependencies.createAdapter });
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  if (authPath === '/api/auth/register' && request.method === 'POST') {
    const response = await handleRegister(request, env, { createAdapter: dependencies.createAdapter });
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  if (authPath === '/api/auth/password' && request.method === 'POST') {
    const response = await handleChangePassword(request, env, { createAdapter: dependencies.createAdapter });
    Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  if (authPath === '/api/auth/me' && request.method === 'GET') {
    try {
      const adapter = await (dependencies.createAdapter || (await import('../adapters/factory')).createAdapter)(env);
      const authContext = await requireAuth(request, env, adapter);
      return jsonResponse(
        {
          success: true,
          data: {
            user: {
              id: authContext.userId,
              email: authContext.email,
              role: authContext.role,
              artistId: authContext.artistId,
            },
          },
        },
        200,
        headers,
      );
    } catch (error) {
      return authError(error, headers);
    }
  }

  if (authPath === '/api/auth/logout' && request.method === 'POST') {
    try {
      const adapter = await (dependencies.createAdapter || (await import('../adapters/factory')).createAdapter)(env);
      const authContext = await requireAuth(request, env, adapter);
      await adapter.revokeAuthSession(authContext.userId, authContext.sessionId);
      return jsonResponse({ success: true }, 200, headers);
    } catch (error) {
      return authError(error, headers);
    }
  }

  return null;
}

function authError(error: unknown, headers: Record<string, string>): Response {
  const invalidSession = error instanceof AuthenticationError;
  return jsonResponse(
    { success: false, error: invalidSession ? error.message : 'Session verification is unavailable', code: invalidSession ? 'AUTH_ERROR' : 'SESSION_CHECK_FAILED' },
    invalidSession ? 401 : 503,
    headers,
  );
}
