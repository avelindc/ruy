/**
 * BREAKOUT MUSIC — Dynamic Landing Page CMS Handlers
 *
 * Handles public read-only landing page endpoints and admin CMS management
 * endpoints with strict authentication, authorization, and validation.
 */

import type { DatabaseAdapter } from '../types/database';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../types/database';

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ============================================================================
// PUBLIC ENDPOINTS (Read-Only)
// ============================================================================

export async function handlePublicLanding(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  }

  try {
    if (!adapter.getLandingContent) {
      throw new Error('CMS not supported by adapter');
    }

    const content = await adapter.getLandingContent();
    return jsonResponse({ success: true, data: content }, 200, headers);
  } catch (error: any) {
    console.error('CMS public landing error:', error);
    return jsonResponse({ success: false, error: error.message || 'Failed to fetch landing content' }, 500, headers);
  }
}

export async function handlePublicTestimonials(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  }

  try {
    if (!adapter.listCmsTestimonials) {
      throw new Error('CMS testimonials not supported by adapter');
    }

    const testimonials = await adapter.listCmsTestimonials(true);
    return jsonResponse({ success: true, data: testimonials }, 200, headers);
  } catch (error: any) {
    console.error('CMS public testimonials error:', error);
    return jsonResponse({ success: false, error: error.message || 'Failed to fetch testimonials' }, 500, headers);
  }
}

export async function handlePublicFaqs(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  }

  try {
    if (!adapter.listCmsFaqCategories) {
      throw new Error('CMS FAQs not supported by adapter');
    }

    const categories = await adapter.listCmsFaqCategories(true);
    return jsonResponse({ success: true, data: categories }, 200, headers);
  } catch (error: any) {
    console.error('CMS public FAQs error:', error);
    return jsonResponse({ success: false, error: error.message || 'Failed to fetch FAQs' }, 500, headers);
  }
}

export async function handlePublicScrollytelling(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  }

  try {
    if (!adapter.getScrollytelling) {
      throw new Error('CMS scrollytelling not supported by adapter');
    }

    const scrollytelling = await adapter.getScrollytelling(true);
    return jsonResponse({ success: true, data: scrollytelling }, 200, headers);
  } catch (error: any) {
    console.error('CMS public scrollytelling error:', error);
    return jsonResponse({ success: false, error: error.message || 'Failed to fetch scrollytelling config' }, 500, headers);
  }
}

// ============================================================================
// ADMIN CMS ENDPOINTS (Authenticated & Authorized)
// ============================================================================

export async function handleAdminCms(
  request: Request,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  env: any
): Promise<Response> {
  try {
    // 1. Authorize admin
    const authContext = await requireAuth(request, env);
    await requireAdmin(authContext, adapter);

    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // Route: /api/admin/cms/sections
    if (pathname === '/api/admin/cms/sections') {
      if (method === 'GET') {
        const sections = await adapter.listCmsSections?.();
        return jsonResponse({ success: true, data: sections }, 200, headers);
      }
    }

    if (pathname.startsWith('/api/admin/cms/sections/')) {
      const sectionId = pathname.replace('/api/admin/cms/sections/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json() as any;
        const updated = await adapter.updateCmsSection?.(sectionId, body);
        return jsonResponse({ success: true, data: updated }, 200, headers);
      }
    }

    // Route: /api/admin/cms/testimonials
    if (pathname === '/api/admin/cms/testimonials') {
      if (method === 'GET') {
        const testimonials = await adapter.listCmsTestimonials?.(false);
        return jsonResponse({ success: true, data: testimonials }, 200, headers);
      }
      if (method === 'POST') {
        const body = await request.json() as any;
        if (!body.artist_name || !body.quote) {
          throw new ValidationError('artist_name and quote are required');
        }
        const created = await adapter.createCmsTestimonial?.(body);
        return jsonResponse({ success: true, data: created }, 201, headers);
      }
    }

    if (pathname.startsWith('/api/admin/cms/testimonials/')) {
      const id = pathname.replace('/api/admin/cms/testimonials/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json() as any;
        const updated = await adapter.updateCmsTestimonial?.(id, body);
        return jsonResponse({ success: true, data: updated }, 200, headers);
      }
      if (method === 'DELETE') {
        await adapter.deleteCmsTestimonial?.(id);
        return jsonResponse({ success: true, message: 'Testimonial deleted successfully' }, 200, headers);
      }
    }

    // Route: /api/admin/cms/faq-categories
    if (pathname === '/api/admin/cms/faq-categories') {
      if (method === 'GET') {
        const categories = await adapter.listCmsFaqCategories?.(false);
        return jsonResponse({ success: true, data: categories }, 200, headers);
      }
      if (method === 'POST') {
        const body = await request.json() as any;
        if (!body.name) {
          throw new ValidationError('name is required');
        }
        const created = await adapter.createCmsFaqCategory?.(body);
        return jsonResponse({ success: true, data: created }, 201, headers);
      }
    }

    if (pathname.startsWith('/api/admin/cms/faq-categories/')) {
      const id = pathname.replace('/api/admin/cms/faq-categories/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json() as any;
        const updated = await adapter.updateCmsFaqCategory?.(id, body);
        return jsonResponse({ success: true, data: updated }, 200, headers);
      }
      if (method === 'DELETE') {
        await adapter.deleteCmsFaqCategory?.(id);
        return jsonResponse({ success: true, message: 'FAQ Category deleted successfully' }, 200, headers);
      }
    }

    // Route: /api/admin/cms/faq-items
    if (pathname === '/api/admin/cms/faq-items') {
      if (method === 'GET') {
        const categoryId = url.searchParams.get('category_id') || undefined;
        const items = await adapter.listCmsFaqItems?.(categoryId, false);
        return jsonResponse({ success: true, data: items }, 200, headers);
      }
      if (method === 'POST') {
        const body = await request.json() as any;
        if (!body.category_id || !body.question || !body.answer) {
          throw new ValidationError('category_id, question, and answer are required');
        }
        const created = await adapter.createCmsFaqItem?.(body);
        return jsonResponse({ success: true, data: created }, 201, headers);
      }
    }

    if (pathname.startsWith('/api/admin/cms/faq-items/')) {
      const id = pathname.replace('/api/admin/cms/faq-items/', '');
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json() as any;
        const updated = await adapter.updateCmsFaqItem?.(id, body);
        return jsonResponse({ success: true, data: updated }, 200, headers);
      }
      if (method === 'DELETE') {
        await adapter.deleteCmsFaqItem?.(id);
        return jsonResponse({ success: true, message: 'FAQ Item deleted successfully' }, 200, headers);
      }
    }

    // Route: /api/admin/cms/scrollytelling
    if (pathname === '/api/admin/cms/scrollytelling') {
      if (method === 'GET') {
        const scrollytelling = await adapter.getScrollytelling?.(false);
        return jsonResponse({ success: true, data: scrollytelling }, 200, headers);
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json() as any;
        const updated = await adapter.updateScrollytelling?.(body);
        return jsonResponse({ success: true, data: updated }, 200, headers);
      }
    }

    // Route: /api/admin/cms/scrollytelling/frames/reorder
    if (pathname === '/api/admin/cms/scrollytelling/frames/reorder' && (method === 'PUT' || method === 'POST')) {
      const body = await request.json() as { frame_ids: string[] };
      if (!body.frame_ids || !Array.isArray(body.frame_ids)) {
        throw new ValidationError('frame_ids array is required');
      }
      await adapter.reorderScrollytellingFrames?.(body.frame_ids);
      const scrollytelling = await adapter.getScrollytelling?.(false);
      return jsonResponse({ success: true, data: scrollytelling }, 200, headers);
    }

    // Route: /api/admin/cms/scrollytelling/frames
    if (pathname === '/api/admin/cms/scrollytelling/frames') {
      if (method === 'POST') {
        const body = await request.json() as { frame_url: string; frame_index?: number };
        if (!body.frame_url) {
          throw new ValidationError('frame_url is required');
        }
        const created = await adapter.addScrollytellingFrame?.(body.frame_url, body.frame_index);
        return jsonResponse({ success: true, data: created }, 201, headers);
      }
    }

    if (pathname.startsWith('/api/admin/cms/scrollytelling/frames/')) {
      const frameId = pathname.replace('/api/admin/cms/scrollytelling/frames/', '');
      if (method === 'DELETE') {
        await adapter.deleteScrollytellingFrame?.(frameId);
        return jsonResponse({ success: true, message: 'Frame deleted successfully' }, 200, headers);
      }
    }

    return jsonResponse({ success: false, error: 'Endpoint not found' }, 404, headers);
  } catch (error: any) {
    console.error('CMS admin error:', error);
    const status = error.statusCode || 500;
    return jsonResponse({ success: false, error: error.message || 'Internal server error' }, status, headers);
  }
}
