import type {
  ArtistStreamingAggregateInput,
  DatabaseAdapter,
  ManualArtistRoyaltyInput,
} from '../types/database';
import { AuthenticationError, NotFoundError, ValidationError } from '../types/database';
import { requireAdmin, requireAuth, getUserRole } from '../middleware/auth';
import { handleError, getStatusCode } from '../middleware/errors';

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedCurrencies = new Set([
  'USD', 'EUR', 'GBP', 'IDR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'NZD', 'SGD', 'HKD', 'MYR',
  'THB', 'PHP', 'VND', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR', 'TRY', 'AED', 'SAR', 'QAR', 'KWD',
  'BHD', 'OMR', 'PLN', 'CZK', 'HUF', 'SEK', 'NOK', 'DKK', 'TWD', 'ARS', 'CLP', 'COP', 'PEN',
  'EGP', 'NGN', 'PKR', 'BDT', 'LKR', 'NPR', 'KHR', 'LAK', 'MMK', 'KES', 'GHS', 'TZS', 'UGX',
  'MAD', 'ILS', 'RON', 'BGN', 'HRK', 'RSD', 'UAH', 'ISK', 'DOP', 'CRC', 'UYU', 'BOB', 'PYG',
  'GTQ', 'HNL', 'NIO', 'JMD', 'TTD', 'BBD', 'XCD', 'FJD', 'BWP', 'MUR', 'MZN', 'ETB', 'XOF', 'XAF',
]);

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseMoney(value: unknown, field: string, optional = false): string | null {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required.`);
  }

  let str: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
      throw new ValidationError(`${field} must be a non-negative amount with at most two decimal places.`);
    }
    str = value.toFixed(2);
  } else if (typeof value === 'string') {
    str = value.trim();
    if (!str && optional) return null;
    if (!str) throw new ValidationError(`${field} is required.`);
  } else {
    throw new ValidationError(`${field} must be a valid amount.`);
  }

  // Strip currency prefixes e.g. "Rp", "Rp.", "IDR", "$"
  str = str.replace(/^(Rp\.?|IDR|\$|\€|\£)\s*/i, '').trim();

  if (str.startsWith('-')) {
    throw new ValidationError(`${field} must be a non-negative amount.`);
  }

  // Handle Indonesian thousand separator dots vs commas
  // e.g. "1.500.000,50" -> dots are thousands, comma is decimal
  // e.g. "1,500,000.50" -> commas are thousands, dot is decimal
  // e.g. "100.000" or "1.500.000" -> thousand separator dot
  // e.g. "100.50" -> decimal dot
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2) {
      // Multiple dots: 1.500.000
      str = parts.join('');
    } else {
      // Exactly one dot: e.g. "100.000" (seratus ribu) vs "100.50" (seratus koma lima puluh)
      const decimalPart = parts[1];
      if (decimalPart.length === 3) {
        // In Indonesian currency context, a 3-digit dot suffix is thousand separator
        str = parts.join('');
      } else if (decimalPart.length <= 2) {
        str = parts.join('.');
      } else {
        throw new ValidationError(`${field} must be a non-negative amount with at most two decimal places.`);
      }
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = parts.join('');
    } else {
      const decimalPart = parts[1];
      if (decimalPart.length === 3) {
        str = parts.join('');
      } else if (decimalPart.length <= 2) {
        str = parts.join('.');
      } else {
        throw new ValidationError(`${field} must be a non-negative amount with at most two decimal places.`);
      }
    }
  }

  if (!/^\d{1,14}(\.\d{1,2})?$/.test(str)) {
    throw new ValidationError(`${field} must be a non-negative amount with at most two decimal places.`);
  }

  const num = Number(str);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError(`${field} must be a non-negative amount.`);
  }
  return num.toFixed(2);
}

function parseStreamingInput(value: unknown): ArtistStreamingAggregateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('A streaming report object is required.');
  const body = value as Record<string, unknown>;
  if (typeof body.artist_id !== 'string' || !uuidPattern.test(body.artist_id)) throw new ValidationError('Select a valid catalog artist.');

  const isAggregate = body.is_aggregate === true || body.platform_mode === 'aggregate';
  let platform = typeof body.platform === 'string' ? body.platform.trim() : '';
  if (isAggregate && (!platform || platform === 'ALL' || platform === 'Semua Platform')) {
    platform = 'Agregat';
  }
  if (!platform || platform.length > 80) throw new ValidationError('Platform is required and must be at most 80 characters.');

  if (!isIsoDate(body.period_start) || !isIsoDate(body.period_end) || body.period_end < body.period_start) throw new ValidationError('A valid report period is required.');
  if (typeof body.streams !== 'number' || !Number.isSafeInteger(body.streams) || body.streams < 0) throw new ValidationError('Stream count must be a non-negative whole number.');
  const gross = parseMoney(body.gross_revenue, 'Reported revenue', true);
  const currency = typeof body.currency === 'string' && body.currency ? body.currency.toUpperCase() : null;
  if (gross !== null && (!currency || !supportedCurrencies.has(currency))) throw new ValidationError('Choose a supported currency when reported revenue is provided.');
  if (currency && !supportedCurrencies.has(currency)) throw new ValidationError('Currency must be a supported ISO 4217 code.');
  if (body.territory != null && (typeof body.territory !== 'string' || body.territory.trim().length > 80)) throw new ValidationError('Territory must be at most 80 characters.');
  if (body.report_identifier != null && (typeof body.report_identifier !== 'string' || body.report_identifier.trim().length > 160)) throw new ValidationError('Report identifier must be at most 160 characters.');
  if (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 2000)) throw new ValidationError('Admin notes must be at most 2,000 characters.');
  return {
    artist_id: body.artist_id,
    platform,
    period_start: body.period_start,
    period_end: body.period_end,
    streams: body.streams,
    territory: typeof body.territory === 'string' ? body.territory.trim() || undefined : undefined,
    gross_revenue: gross,
    currency,
    report_identifier: typeof body.report_identifier === 'string' ? body.report_identifier.trim() || null : null,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
  };
}

function parseRoyaltyInput(value: unknown, artistIdRequired: boolean): ManualArtistRoyaltyInput | Omit<ManualArtistRoyaltyInput, 'artist_id'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('A royalty entry object is required.');
  const body = value as Record<string, unknown>;
  if (artistIdRequired && (typeof body.artist_id !== 'string' || !uuidPattern.test(body.artist_id))) throw new ValidationError('Select a valid catalog artist.');
  if (!isIsoDate(body.period_start) || !isIsoDate(body.period_end) || body.period_end < body.period_start) throw new ValidationError('A valid royalty period is required.');
  if (body.streams != null && (typeof body.streams !== 'number' || !Number.isSafeInteger(body.streams) || body.streams < 0)) throw new ValidationError('Related streams must be a non-negative whole number.');
  const gross = parseMoney(body.gross_revenue, 'Gross revenue', true);
  const deductions = parseMoney(body.deductions ?? '0.00', 'Deductions');
  const net = parseMoney(body.net_royalty, 'Net royalty');
  if (!body.currency || typeof body.currency !== 'string' || !supportedCurrencies.has(body.currency.toUpperCase())) throw new ValidationError('Choose a supported ISO 4217 currency.');
  if (gross !== null && Number(deductions) > Number(gross)) throw new ValidationError('Deductions cannot exceed gross revenue.');
  if (body.status !== 'draft' && body.status !== 'finalized') throw new ValidationError('Royalty status must be draft or finalized.');
  if (body.report_identifier != null && (typeof body.report_identifier !== 'string' || body.report_identifier.trim().length > 160)) throw new ValidationError('Report identifier must be at most 160 characters.');
  if (body.notes != null && (typeof body.notes !== 'string' || body.notes.length > 2000)) throw new ValidationError('Admin notes must be at most 2,000 characters.');
  return {
    ...(artistIdRequired ? { artist_id: body.artist_id as string } : {}),
    period_start: body.period_start,
    period_end: body.period_end,
    streams: body.streams as number | null | undefined,
    gross_revenue: gross,
    deductions: deductions!,
    net_royalty: net!,
    currency: body.currency.toUpperCase(),
    status: body.status,
    report_identifier: typeof body.report_identifier === 'string' ? body.report_identifier.trim() || null : null,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
  };
}

function translateUniqueConstraint(error: unknown): never {
  if ((error as { code?: string } | null)?.code === '23505') {
    throw new ValidationError('A report with this artist, period, platform, currency, and report identity already exists. Use the correction action for changes.');
  }
  throw error;
}

export async function handleAdminArtistFinance(
  request: Request,
  env: unknown,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
): Promise<Response> {
  try {
    const auth = await requireAuth(request, env, adapter);
    await requireAdmin(auth, adapter);
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === 'GET' && pathname === '/api/admin/artist-finance/artists') {
      const artists = await adapter.listArtistFinanceArtists();
      return jsonResponse({ success: true, data: artists }, 200, headers);
    }

    if (pathname === '/api/admin/artist-finance/streaming' && request.method === 'GET') {
      const result = await adapter.listArtistStreamingAggregates({
        artist_id: url.searchParams.get('artist_id') || undefined,
        platform: url.searchParams.get('platform') || undefined,
        start_date: url.searchParams.get('start_date') || undefined,
        end_date: url.searchParams.get('end_date') || undefined,
        limit: Number(url.searchParams.get('limit') || 100), offset: Number(url.searchParams.get('offset') || 0),
      });
      return jsonResponse({ success: true, data: result }, 200, headers);
    }

    if (pathname === '/api/admin/artist-finance/streaming' && request.method === 'POST') {
      const input = parseStreamingInput(await request.json());
      try {
        const row = await adapter.createArtistStreamingAggregate(input, auth.userId);
        return jsonResponse({ success: true, data: row }, 201, headers);
      } catch (error) { translateUniqueConstraint(error); }
    }

    const streamingCorrection = pathname.match(/^\/api\/admin\/artist-finance\/streaming\/([0-9a-f-]+)$/i);
    if (streamingCorrection && request.method === 'PUT') {
      if (!uuidPattern.test(streamingCorrection[1])) throw new ValidationError('A valid streaming report ID is required.');
      const input = parseStreamingInput(await request.json());
      try {
        const row = await adapter.correctArtistStreamingAggregate(streamingCorrection[1], input, auth.userId);
        return jsonResponse({ success: true, data: row }, 200, headers);
      } catch (error) { translateUniqueConstraint(error); }
    }

    if (pathname === '/api/admin/artist-finance/royalties' && request.method === 'GET') {
      const result = await adapter.listManualArtistRoyalties({
        artist_id: url.searchParams.get('artist_id') || undefined,
        start_date: url.searchParams.get('start_date') || undefined,
        end_date: url.searchParams.get('end_date') || undefined,
        include_superseded: url.searchParams.get('include_superseded') === 'true',
        limit: Number(url.searchParams.get('limit') || 100), offset: Number(url.searchParams.get('offset') || 0),
      });
      return jsonResponse({ success: true, data: result }, 200, headers);
    }

    if (pathname === '/api/admin/artist-finance/royalties' && request.method === 'POST') {
      const input = parseRoyaltyInput(await request.json(), true) as ManualArtistRoyaltyInput;
      try {
        const row = await adapter.createManualArtistRoyalty(input, auth.userId);
        return jsonResponse({ success: true, data: row }, 201, headers);
      } catch (error) { translateUniqueConstraint(error); }
    }

    const royaltyCorrection = pathname.match(/^\/api\/admin\/artist-finance\/royalties\/([0-9a-f-]+)\/corrections$/i);
    if (royaltyCorrection && request.method === 'POST') {
      if (!uuidPattern.test(royaltyCorrection[1])) throw new ValidationError('A valid royalty entry ID is required.');
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.reason !== 'string' || body.reason.trim().length < 4 || body.reason.trim().length > 500) throw new ValidationError('A correction reason (4–500 characters) is required.');
      const input = parseRoyaltyInput(body, false) as Omit<ManualArtistRoyaltyInput, 'artist_id'>;
      try {
        const row = await adapter.correctManualArtistRoyalty(royaltyCorrection[1], input, auth.userId, body.reason.trim());
        return jsonResponse({ success: true, data: row }, 201, headers);
      } catch (error) { translateUniqueConstraint(error); }
    }

    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
  } catch (error) {
    return jsonResponse(handleError(error), getStatusCode(error), headers);
  }
}

export async function handleArtistStreamingAggregates(
  request: Request,
  env: unknown,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
): Promise<Response> {
  try {
    if (request.method !== 'GET') return jsonResponse({ success: false, error: 'Method not allowed' }, 405, headers);
    const auth = await requireAuth(request, env, adapter);
    const role = await getUserRole(auth.userId, adapter);
    const isAdmin = role === 'admin' || role === 'super_admin';
    const url = new URL(request.url);
    const artistId = url.searchParams.get('artist_id') || undefined;
    if (artistId && !uuidPattern.test(artistId)) throw new ValidationError('A valid artist ID is required.');
    if (artistId && !isAdmin) {
      const artist = await adapter.getArtist(artistId);
      if (!artist || artist.owner_id !== auth.userId) throw new AuthenticationError('Access denied: this artist profile does not belong to the signed-in account.');
    }
    const result = await adapter.listArtistStreamingAggregates({
      artist_id: artistId,
      owner_id: isAdmin ? undefined : auth.userId,
      platform: url.searchParams.get('platform') || undefined,
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined,
      limit: Number(url.searchParams.get('limit') || 100), offset: Number(url.searchParams.get('offset') || 0),
    });
    return jsonResponse({ success: true, data: result }, 200, headers);
  } catch (error) {
    return jsonResponse(handleError(error), getStatusCode(error), headers);
  }
}
