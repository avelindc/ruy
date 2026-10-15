import type { DatabaseAdapter } from '../types/database';
import { requireAuth } from '../middleware/auth';
import { handleError, getStatusCode } from '../middleware/errors';
import { NotFoundError } from '../types/database';

function response(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export async function handleNotifications(
  request: Request,
  env: unknown,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
): Promise<Response> {
  try {
    const auth = await requireAuth(request, env);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'GET' && path === '/api/notifications') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
      const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
      return response({ success: true, data: { ...(await adapter.listNotifications(auth.userId, limit, offset)), limit, offset } }, 200, headers);
    }

    if (request.method === 'GET' && path === '/api/notifications/unread-count') {
      return response({ success: true, data: { count: await adapter.getUnreadNotificationCount(auth.userId) } }, 200, headers);
    }

    if (request.method === 'PUT' && path === '/api/notifications/read-all') {
      await adapter.markAllNotificationsRead(auth.userId);
      return response({ success: true, data: {} }, 200, headers);
    }

    if (request.method === 'DELETE' && path === '/api/notifications') {
      await adapter.deleteAllNotifications(auth.userId);
      return response({ success: true, data: {} }, 200, headers);
    }

    const match = path.match(/^\/api\/notifications\/([^/]+)$/);
    if (match) {
      const notificationId = decodeURIComponent(match[1]);
      if (request.method === 'PUT') {
        const body = await request.json().catch(() => ({})) as { read?: boolean };
        if (body.read !== true) throw new NotFoundError('Unsupported notification update');
        await adapter.markNotificationRead(auth.userId, notificationId);
        return response({ success: true, data: {} }, 200, headers);
      }
      if (request.method === 'DELETE') {
        await adapter.deleteNotification(auth.userId, notificationId);
        return response({ success: true, data: {} }, 200, headers);
      }
    }

    return response({ success: false, error: 'Not found' }, 404, headers);
  } catch (error) {
    return response(handleError(error), getStatusCode(error), headers);
  }
}
