/**
 * BREAKOUT MUSIC — Dynamic Landing Page CMS Service
 *
 * Interacts with Cloudflare Workers API for CMS Landing Sections,
 * Artist Testimonials ("REAL FEEDBACK / WHAT ARTISTS SAY"),
 * and Categorized FAQ Items & Categories.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@lib/api/client';

export interface CmsLandingSection {
  id: string;
  section_key: string;
  title: string;
  subtitle?: string | null;
  display_order: number;
  is_enabled: boolean;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export interface CmsTestimonial {
  id: string;
  artist_name: string;
  avatar_url?: string | null;
  role_label: string;
  quote: string;
  display_order: number;
  status: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
}

export interface CmsFaqCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order: number;
  status: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
  items?: CmsFaqItem[];
}

export interface CmsFaqItem {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  display_order: number;
  status: 'draft' | 'published';
  created_at?: string;
  updated_at?: string;
}

export interface CmsScrollytellingStep {
  step_index: number;
  badge: string;
  title: string;
  description: string;
  alignment: 'left' | 'center' | 'right';
  start_progress: number;
  end_progress: number;
  is_active: boolean;
}

export interface CmsScrollytellingFrame {
  id: string;
  scrollytelling_id: string;
  frame_index: number;
  frame_url: string;
  created_at?: string;
}

export interface CmsScrollytelling {
  id: string;
  is_enabled: boolean;
  status: 'published' | 'draft';
  bg_color: string;
  scroll_height_vh: number;
  canvas_aspect_ratio: string;
  cta_label: string;
  cta_url: string;
  text_steps: CmsScrollytellingStep[];
  frames: CmsScrollytellingFrame[];
  updated_at?: string;
}

export interface LandingContent {
  sections: CmsLandingSection[];
  testimonials: CmsTestimonial[];
  faq_categories: CmsFaqCategory[];
  scrollytelling?: CmsScrollytelling | null;
}

// ============================================================================
// PUBLIC READ-ONLY ENDPOINTS
// ============================================================================

/**
 * Fetch all published landing page content in one request
 */
export async function getLandingContent(): Promise<{ data: LandingContent | null; error: Error | null }> {
  try {
    const response = await apiGet<LandingContent>('/api/public/landing');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch landing content');
    }
    return { data: response.data, error: null };
  } catch (err: any) {
    console.error('Error getting public landing content:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetch published testimonials
 */
export async function getPublicTestimonials(): Promise<{ data: CmsTestimonial[]; error: Error | null }> {
  try {
    const response = await apiGet<CmsTestimonial[]>('/api/public/testimonials');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch testimonials');
    }
    return { data: response.data, error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Fetch published FAQs with items
 */
export async function getPublicFaqs(): Promise<{ data: CmsFaqCategory[]; error: Error | null }> {
  try {
    const response = await apiGet<CmsFaqCategory[]>('/api/public/faqs');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch FAQs');
    }
    return { data: response.data, error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// ============================================================================
// ADMIN CMS ENDPOINTS
// ============================================================================

// --- SECTIONS ---

export async function getAdminSections(): Promise<{ data: CmsLandingSection[]; error: Error | null }> {
  try {
    const res = await apiGet<CmsLandingSection[]>('/api/admin/cms/sections');
    if (!res.success) throw new Error(res.error || 'Failed to fetch sections');
    return { data: res.data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateAdminSection(
  id: string,
  payload: Partial<CmsLandingSection>
): Promise<{ data: CmsLandingSection | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsLandingSection>(`/api/admin/cms/sections/${id}`, payload);
    if (!res.success) throw new Error(res.error || 'Failed to update section');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// --- TESTIMONIALS ---

export async function getAdminTestimonials(): Promise<{ data: CmsTestimonial[]; error: Error | null }> {
  try {
    const res = await apiGet<CmsTestimonial[]>('/api/admin/cms/testimonials');
    if (!res.success) throw new Error(res.error || 'Failed to fetch testimonials');
    return { data: res.data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function createAdminTestimonial(
  payload: Omit<CmsTestimonial, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: CmsTestimonial | null; error: Error | null }> {
  try {
    const res = await apiPost<CmsTestimonial>('/api/admin/cms/testimonials', payload);
    if (!res.success) throw new Error(res.error || 'Failed to create testimonial');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateAdminTestimonial(
  id: string,
  payload: Partial<CmsTestimonial>
): Promise<{ data: CmsTestimonial | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsTestimonial>(`/api/admin/cms/testimonials/${id}`, payload);
    if (!res.success) throw new Error(res.error || 'Failed to update testimonial');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function deleteAdminTestimonial(id: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const res = await apiDelete(`/api/admin/cms/testimonials/${id}`);
    if (!res.success) throw new Error(res.error || 'Failed to delete testimonial');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// --- FAQ CATEGORIES ---

export async function getAdminFaqCategories(): Promise<{ data: CmsFaqCategory[]; error: Error | null }> {
  try {
    const res = await apiGet<CmsFaqCategory[]>('/api/admin/cms/faq-categories');
    if (!res.success) throw new Error(res.error || 'Failed to fetch FAQ categories');
    return { data: res.data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function createAdminFaqCategory(
  payload: { name: string; description?: string; display_order?: number; status?: 'draft' | 'published' }
): Promise<{ data: CmsFaqCategory | null; error: Error | null }> {
  try {
    const res = await apiPost<CmsFaqCategory>('/api/admin/cms/faq-categories', payload);
    if (!res.success) throw new Error(res.error || 'Failed to create FAQ category');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateAdminFaqCategory(
  id: string,
  payload: Partial<CmsFaqCategory>
): Promise<{ data: CmsFaqCategory | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsFaqCategory>(`/api/admin/cms/faq-categories/${id}`, payload);
    if (!res.success) throw new Error(res.error || 'Failed to update FAQ category');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function deleteAdminFaqCategory(id: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const res = await apiDelete(`/api/admin/cms/faq-categories/${id}`);
    if (!res.success) throw new Error(res.error || 'Failed to delete FAQ category');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// --- FAQ ITEMS ---

export async function createAdminFaqItem(
  payload: { category_id: string; question: string; answer: string; display_order?: number; status?: 'draft' | 'published' }
): Promise<{ data: CmsFaqItem | null; error: Error | null }> {
  try {
    const res = await apiPost<CmsFaqItem>('/api/admin/cms/faq-items', payload);
    if (!res.success) throw new Error(res.error || 'Failed to create FAQ item');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateAdminFaqItem(
  id: string,
  payload: Partial<CmsFaqItem>
): Promise<{ data: CmsFaqItem | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsFaqItem>(`/api/admin/cms/faq-items/${id}`, payload);
    if (!res.success) throw new Error(res.error || 'Failed to update FAQ item');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function deleteAdminFaqItem(id: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const res = await apiDelete(`/api/admin/cms/faq-items/${id}`);
    if (!res.success) throw new Error(res.error || 'Failed to delete FAQ item');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// ============================================================================
// SCROLLYTELLING ANIMATION CRUD (Admin & Public)
// ============================================================================

export async function getPublicScrollytelling(): Promise<{ data: CmsScrollytelling | null; error: Error | null }> {
  try {
    const response = await apiGet<CmsScrollytelling>('/api/public/scrollytelling');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch scrollytelling animation');
    }
    return { data: response.data, error: null };
  } catch (err: any) {
    console.error('Error fetching public scrollytelling:', err);
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function getAdminScrollytelling(): Promise<{ data: CmsScrollytelling | null; error: Error | null }> {
  try {
    const response = await apiGet<CmsScrollytelling>('/api/admin/cms/scrollytelling');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch admin scrollytelling');
    }
    return { data: response.data, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function updateAdminScrollytelling(
  payload: Partial<CmsScrollytelling>
): Promise<{ data: CmsScrollytelling | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsScrollytelling>('/api/admin/cms/scrollytelling', payload);
    if (!res.success) throw new Error(res.error || 'Failed to update scrollytelling');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function addAdminScrollytellingFrame(
  frameUrl: string,
  frameIndex?: number
): Promise<{ data: CmsScrollytellingFrame | null; error: Error | null }> {
  try {
    const res = await apiPost<CmsScrollytellingFrame>('/api/admin/cms/scrollytelling/frames', {
      frame_url: frameUrl,
      frame_index: frameIndex,
    });
    if (!res.success) throw new Error(res.error || 'Failed to add frame');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function deleteAdminScrollytellingFrame(frameId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const res = await apiDelete(`/api/admin/cms/scrollytelling/frames/${frameId}`);
    if (!res.success) throw new Error(res.error || 'Failed to delete frame');
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function reorderAdminScrollytellingFrames(
  frameIds: string[]
): Promise<{ data: CmsScrollytelling | null; error: Error | null }> {
  try {
    const res = await apiPut<CmsScrollytelling>('/api/admin/cms/scrollytelling/frames/reorder', {
      frame_ids: frameIds,
    });
    if (!res.success) throw new Error(res.error || 'Failed to reorder frames');
    return { data: res.data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
