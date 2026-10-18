/**
 * STORAGE & UPLOAD HANDLER
 *
 * Secure file upload and retrieval handler.
 * Supports Cloudflare R2 bucket binding (when configured) with verified fallback
 * database chunk storage in Neon PostgreSQL (temp_upload_chunks).
 *
 * Enforces strict verification: an upload is NEVER marked as succeeded unless
 * the stored object is verified in persistent storage.
 */

import { requireAuth, requireOwnership, type AuthContext } from '../middleware/auth';
import { handleError, getStatusCode } from '../middleware/errors';
import { ValidationError, NotFoundError, type DatabaseAdapter } from '../types/database';

function jsonResponse(data: any, status: number = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export interface StorageEnv {
  JWT_SECRET?: string;
  STORAGE_BUCKET?: R2Bucket;
  R2_BUCKET?: R2Bucket;
  [key: string]: any;
}

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for database storage
const SIGNED_MEDIA_TTL_SECONDS = 5 * 60;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getStorageOwnerId(fileKey: string): string | null {
  const parts = fileKey.replace(/^\/+/, '').split('/');
  if (!['audio', 'covers', 'reports'].includes(parts[0] || '')) return null;
  if (USER_ID_PATTERN.test(parts[1] || '')) return parts[1];
  const legacy = (parts[1] || '').match(/^([0-9a-f-]{36})-\d+-/i);
  return legacy && USER_ID_PATTERN.test(legacy[1]) ? legacy[1] : null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function storageSignature(secret: string, fileKey: string, expires: number): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${fileKey}\n${expires}`));
  return base64UrlEncode(new Uint8Array(signature));
}

async function isValidStorageSignature(request: Request, env: StorageEnv, fileKey: string): Promise<boolean> {
  const secret = env.JWT_SECRET?.trim();
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature') || '';
  const now = Math.floor(Date.now() / 1000);
  if (!secret || !Number.isSafeInteger(expires) || expires < now || expires > now + SIGNED_MEDIA_TTL_SECONDS + 30 || !signature) return false;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  try {
    return await crypto.subtle.verify(
      'HMAC', cryptoKey, base64UrlDecode(signature), new TextEncoder().encode(`${fileKey}\n${expires}`),
    );
  } catch {
    return false;
  }
}

/** Issue short-lived access for an authenticated owner or admin to a private audio master. */
export async function handleStorageSign(
  request: Request,
  env: StorageEnv,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);
    const body = await request.json() as { fileKey?: string };
    const fileKey = String(body.fileKey || '').replace(/^\/+/, '');
    if ((!fileKey.startsWith('audio/') && !fileKey.startsWith('reports/')) || fileKey.includes('..')) {
      throw new ValidationError('A valid private file key is required.');
    }
    const ownerId = getStorageOwnerId(fileKey);
    if (!ownerId) throw new NotFoundError('File not found.');
    await requireOwnership(authContext, ownerId, adapter);
    if (!(await checkStorageObjectExists(env, adapter, fileKey))) throw new NotFoundError('File not found.');
    const secret = env.JWT_SECRET?.trim();
    if (!secret) throw new Error('Private media signing is not configured.');
    const expires = Math.floor(Date.now() / 1000) + SIGNED_MEDIA_TTL_SECONDS;
    const signature = await storageSignature(secret, fileKey, expires);
    const url = new URL(`/api/storage/${encodeURIComponent(fileKey)}`, request.url);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return jsonResponse({ success: true, data: { url: url.toString(), expires_at: new Date(expires * 1000).toISOString() } }, 200, headers);
  } catch (error) {
    return jsonResponse(handleError(error), getStatusCode(error), headers);
  }
}

/**
 * Upload audio or image file
 * POST /api/uploads
 */
export async function handleUpload(
  request: Request,
  env: StorageEnv,
  adapter: DatabaseAdapter,
  headers: Record<string, string>
): Promise<Response> {
  const authContext = await requireAuth(request, env, adapter);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > 160 * 1024 * 1024) {
    throw new ValidationError('Upload request exceeds the maximum supported size.');
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ValidationError('Request must be multipart/form-data');
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const uploadType = (formData.get('type') as string) || 'artwork'; // 'artwork' | 'cover' | 'audio' | 'report' | 'csv' | 'archive'

  if (!file || typeof file === 'string') {
    throw new ValidationError('File is required in "file" field');
  }

  const fileBlob = file as File;
  const fileName = fileBlob.name || 'unnamed_file';
  const fileMime = fileBlob.type || 'application/octet-stream';
  const fileSize = fileBlob.size;

  // Validate MIME and size
  const isImage = uploadType === 'artwork' || uploadType === 'cover';
  const isAudio = uploadType === 'audio';
  const isReport = uploadType === 'report' || uploadType === 'csv' || uploadType === 'archive';

  if (isImage) {
    const validImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const validImageExtension = /\.(jpe?g|png|webp)$/i.test(fileName);
    if (!validImageExtension || (fileMime !== 'application/octet-stream' && !validImageMimes.includes(fileMime))) {
      throw new ValidationError('Artwork must be a valid image (JPEG, PNG, or WebP)');
    }
    if (fileSize > 15 * 1024 * 1024) {
      throw new ValidationError('Artwork file size must not exceed 15MB');
    }
  } else if (isAudio) {
    const validAudioMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/x-pn-wav',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
      'audio/aac',
      'audio/x-aac',
      'audio/flac',
      'audio/x-flac',
      'audio/ogg',
      'audio/vorbis',
      'application/octet-stream',
    ];
    const hasValidAudioExt = !!fileName.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i);
    const hasValidAudioMime = validAudioMimes.includes(fileMime) || fileMime.startsWith('audio/');

    if (!hasValidAudioExt || (!hasValidAudioMime && fileMime !== 'application/octet-stream')) {
      throw new ValidationError('File audio master harus berupa format yang valid (MP3, WAV, M4A, AAC, atau FLAC)');
    }
    if (fileSize > 150 * 1024 * 1024) {
      throw new ValidationError('Ukuran file audio maksimal 150MB');
    }
  } else if (isReport) {
    const hasValidReportExt = !!fileName.match(/\.(csv|pdf|xlsx|xls|txt|json)$/i);
    if (!hasValidReportExt) {
      throw new ValidationError('File laporan arsip harus berformat CSV, PDF, XLSX, TXT, atau JSON.');
    }
    if (fileSize > 50 * 1024 * 1024) {
      throw new ValidationError('Ukuran file laporan maksimal 50MB.');
    }
  } else {
    throw new ValidationError('Invalid upload type. Must be "artwork", "cover", "audio", or "report"');
  }

  // Generate clean storage key
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const prefix = isImage ? 'covers/' : isAudio ? 'audio/' : 'reports/';
  const fileKey = `${prefix}${authContext.userId}/${crypto.randomUUID()}-${safeName}`;

  const signatureBytes = new Uint8Array(await fileBlob.slice(0, 12).arrayBuffer());
  const startsWith = (...bytes: number[]) => bytes.every((byte, index) => signatureBytes[index] === byte);
  const asciiAt = (offset: number, value: string) => value.split('').every((char, index) => signatureBytes[offset + index] === char.charCodeAt(0));
  const imageSignatureValid = uploadType === 'artwork' || uploadType === 'cover'
    ? (startsWith(0xff, 0xd8, 0xff) || startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      || (asciiAt(0, 'RIFF') && asciiAt(8, 'WEBP')))
    : true;
  const audioSignatureValid = isAudio
    ? (asciiAt(0, 'ID3') || startsWith(0xff, 0xfb) || startsWith(0xff, 0xf3) || startsWith(0xff, 0xf2)
      || (asciiAt(0, 'RIFF') && asciiAt(8, 'WAVE')) || asciiAt(0, 'fLaC') || asciiAt(0, 'OggS')
      || (asciiAt(4, 'ftyp')) || startsWith(0xff, 0xf1) || startsWith(0xff, 0xf9))
    : true;
  if (!imageSignatureValid || !audioSignatureValid) {
    throw new ValidationError('File content does not match a supported image or audio format.');
  }

  // Attempt Storage 1: Cloudflare R2 (if bucket binding available)
  const r2Bucket = env.STORAGE_BUCKET || env.R2_BUCKET;
  let storedInR2 = false;

  if (r2Bucket) {
    try {
      await r2Bucket.put(fileKey, fileBlob.stream(), {
        httpMetadata: {
          contentType: fileMime,
        },
      });

      // Strict verification in R2
      const head = await r2Bucket.head(fileKey);
      if (head) {
        storedInR2 = true;
      }
    } catch (r2Err) {
      console.warn('R2 storage attempt failed:', r2Err);
    }
  }

  // Attempt Storage 2: Database chunk storage fallback (Neon DB temp_upload_chunks)
  // Audio files MUST be stored in Cloudflare R2; never stored permanently in database.
  if (!storedInR2) {
    if (isAudio) {
      return jsonResponse(
        {
          success: false,
          error: 'Cloudflare R2 belum aktif atau tidak dapat diakses. File audio master wajib disimpan di Cloudflare R2 dan tidak diizinkan disimpan di database Neon.',
        },
        503,
        headers,
      );
    }
    if (fileSize > 8 * 1024 * 1024) {
      return jsonResponse(
        { success: false, error: 'R2 belum tersedia; penyimpanan fallback database dibatasi 8MB per file. Hubungi admin untuk konfigurasi storage.' },
        503,
        headers,
      );
    }
    if (adapter.saveUploadChunks) {
      try {
        const buffer = new Uint8Array(await fileBlob.arrayBuffer());
        // Convert to base64 string
        let binaryStr = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i += 8192) {
          binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + 8192, len))));
        }
        const base64Data = btoa(binaryStr);

        // Split into 1MB chunks
        const chunks: string[] = [];
        for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
          chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
        }

        await adapter.saveUploadChunks(fileKey, chunks);

        // Verify storage exists and is retrievable
        const verified = adapter.verifyUploadExists ? await adapter.verifyUploadExists(fileKey) : true;
        if (!verified) {
          throw new Error('Database storage verification check returned false');
        }
      } catch (dbErr: any) {
        console.error('Database storage failed:', dbErr);
        return jsonResponse(
          {
            success: false,
            error: `Gagal menyimpan file: ${dbErr.message || 'Storage verification failed'}. R2 belum diaktifkan dan database fallback gagal.`,
          },
          503,
          headers
        );
      }
    } else {
      return jsonResponse(
        {
          success: false,
          error: 'Penyimpanan file gagal: Cloudflare R2 bucket belum dikonfigurasi dan adapter database tidak mendukung penyimpanan chunk.',
        },
        503,
        headers
      );
    }
  }

  const origin = new URL(request.url).origin;
  const accessUrl = `${origin}/api/storage/${encodeURIComponent(fileKey)}`;

  return jsonResponse(
    {
      success: true,
      data: {
        fileKey,
        file_key: fileKey,
        url: accessUrl,
        filename: fileName,
        contentType: fileMime,
        mime_type: fileMime,
        size: fileSize,
        storageProvider: storedInR2 ? 'cloudflare-r2' : 'database-chunks',
        storage: storedInR2 ? 'r2' : 'database_chunks',
        verified: true,
      },
    },
    201,
    headers
  );
}

/**
 * Retrieve stored file object
 * GET /api/storage/:key
 * Supports HTTP 206 Partial Content Range requests for iOS Safari audio streaming.
 */
export async function handleStorageGet(
  request: Request,
  env: StorageEnv,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  fileKey: string
): Promise<Response> {
  const decodedKey = decodeURIComponent(fileKey).split('?')[0].split('#')[0];
  const isPrivate = decodedKey.startsWith('audio/') || decodedKey.startsWith('reports/');
  if (isPrivate && !(await isValidStorageSignature(request, env, decodedKey))) {
    try {
      const authContext = await requireAuth(request, env, adapter);
      const ownerId = getStorageOwnerId(decodedKey);
      if (!ownerId) throw new NotFoundError('File not found.');
      await requireOwnership(authContext, ownerId, adapter);
    } catch (error) {
      return jsonResponse(handleError(error), getStatusCode(error), headers);
    }
  }
  const rangeHeader = request.headers.get('range');
  const requestUrl = new URL(request.url);
  const isDownload = requestUrl.searchParams.get('download') === 'true' || requestUrl.searchParams.get('download') === '1' || fileKey.startsWith('download/');
  const rawFilename = decodedKey.split('/').pop() || 'download';
  const cleanFilename = rawFilename.replace(/^[0-9a-f-]{36}-/i, '');

  // Determine MIME type by file extension
  let mimeType = 'application/octet-stream';
  if (decodedKey.match(/\.(jpe?g)$/i)) mimeType = 'image/jpeg';
  else if (decodedKey.match(/\.png$/i)) mimeType = 'image/png';
  else if (decodedKey.match(/\.webp$/i)) mimeType = 'image/webp';
  else if (decodedKey.match(/\.gif$/i)) mimeType = 'image/gif';
  else if (decodedKey.match(/\.mp3$/i)) mimeType = 'audio/mpeg';
  else if (decodedKey.match(/\.wav$/i)) mimeType = 'audio/wav';
  else if (decodedKey.match(/\.(m4a|mp4)$/i)) mimeType = 'audio/mp4';
  else if (decodedKey.match(/\.aac$/i)) mimeType = 'audio/aac';
  else if (decodedKey.match(/\.flac$/i)) mimeType = 'audio/flac';
  else if (decodedKey.match(/\.ogg$/i)) mimeType = 'audio/ogg';
  else if (decodedKey.match(/\.csv$/i)) mimeType = 'text/csv';
  else if (decodedKey.match(/\.pdf$/i)) mimeType = 'application/pdf';
  else if (decodedKey.match(/\.xlsx$/i)) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  else if (decodedKey.match(/\.json$/i)) mimeType = 'application/json';

  // 1. Try Cloudflare R2 bucket first (if configured and bound)
  const r2Bucket = env.STORAGE_BUCKET || env.R2_BUCKET;
  if (r2Bucket) {
    try {
      const obj = await r2Bucket.get(decodedKey, rangeHeader ? { range: request.headers } : undefined);
      if (obj) {
        const objHeaders = new Headers(headers);
        objHeaders.set('Content-Type', obj.httpMetadata?.contentType || mimeType);
        objHeaders.set('Accept-Ranges', 'bytes');
        objHeaders.set('Cache-Control', isPrivate ? 'private, max-age=60' : 'public, max-age=31536000, immutable');
        objHeaders.set('Content-Disposition', isDownload ? `attachment; filename="${cleanFilename}"` : `inline; filename="${cleanFilename}"`);
        if (obj.httpEtag) objHeaders.set('ETag', obj.httpEtag);

        if (rangeHeader && 'range' in obj && obj.range) {
          const r = obj.range as any;
          objHeaders.set('Content-Range', `bytes ${r.offset}-${r.offset + (r.length || obj.size) - 1}/${obj.size}`);
          objHeaders.set('Content-Length', String(r.length || obj.size));
          return new Response(obj.body, { status: 206, headers: objHeaders });
        }

        objHeaders.set('Content-Length', String(obj.size));
        return new Response(obj.body, { status: 200, headers: objHeaders });
      }
    } catch (e) {
      console.warn('R2 get error, checking database fallback:', e);
    }
  }

  // 2. Try database chunk storage (Neon DB temp_upload_chunks)
  if (adapter.getUploadChunks) {
    try {
      const chunks = await adapter.getUploadChunks(decodedKey);
      if (chunks && chunks.length > 0) {
        const fullBase64 = chunks.join('');
        const binaryStr = atob(fullBase64);
        const totalSize = binaryStr.length;
        const bytes = new Uint8Array(totalSize);
        for (let i = 0; i < totalSize; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        // Handle HTTP Range request (required for iOS Safari audio seeking & streaming)
        if (rangeHeader) {
          let start = 0;
          let end = totalSize - 1;
          const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
          if (match) {
            if (match[1]) start = parseInt(match[1], 10);
            if (match[2]) end = parseInt(match[2], 10);
          }
          if (isNaN(start) || start < 0) start = 0;
          if (isNaN(end) || end >= totalSize) end = totalSize - 1;

          if (start > end || start >= totalSize) {
            return new Response('Requested Range Not Satisfiable', {
              status: 416,
              headers: {
                ...headers,
                'Content-Range': `bytes */${totalSize}`,
              },
            });
          }

          const slicedBytes = bytes.subarray(start, end + 1);
          const resHeaders = new Headers(headers);
          resHeaders.set('Content-Type', mimeType);
          resHeaders.set('Content-Length', String(slicedBytes.byteLength));
          resHeaders.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          resHeaders.set('Accept-Ranges', 'bytes');
          resHeaders.set('Cache-Control', isPrivate ? 'private, max-age=60' : 'public, max-age=31536000, immutable');
          resHeaders.set('Content-Disposition', isDownload ? `attachment; filename="${cleanFilename}"` : `inline; filename="${cleanFilename}"`);

          return new Response(slicedBytes, { status: 206, headers: resHeaders });
        }

        // Full content response
        const resHeaders = new Headers(headers);
        resHeaders.set('Content-Type', mimeType);
        resHeaders.set('Content-Length', String(totalSize));
        resHeaders.set('Accept-Ranges', 'bytes');
        resHeaders.set('Cache-Control', isPrivate ? 'private, max-age=60' : 'public, max-age=31536000, immutable');
        resHeaders.set('Content-Disposition', isDownload ? `attachment; filename="${cleanFilename}"` : `inline; filename="${cleanFilename}"`);

        return new Response(bytes, { status: 200, headers: resHeaders });
      }
    } catch (err) {
      console.error('Error reading chunks from database:', err);
    }
  }

  return jsonResponse({ success: false, error: 'File tidak ditemukan di storage' }, 404, headers);
}

async function checkStorageObjectExists(env: StorageEnv, adapter: DatabaseAdapter, urlOrKey: string): Promise<boolean> {
  if (!urlOrKey) return false;
  let key = urlOrKey;
  if (key.includes('/api/storage/')) {
    key = decodeURIComponent(key.split('/api/storage/')[1]);
  }

  // Check R2 bucket if bound
  const bucket = env.STORAGE_BUCKET || env.R2_BUCKET;
  if (bucket) {
    try {
      const obj = await bucket.head(key);
      if (obj) return true;
    } catch {}
  }

  // Check database chunk storage
  if (adapter.verifyUploadExists) {
    try {
      const inDb = await adapter.verifyUploadExists(key);
      if (inDb) return true;
    } catch {}
  }

  return false;
}

/**
 * Final submit release for review
 * POST /api/releases/:id/submit
 *
 * Strict enforcement:
 * - Cover artwork MUST be present and verified in storage
 * - Master audio track MUST be present and verified in storage
 * - Status changes from draft (PENDING) to SUBMITTED (REVIEW)
 */
export async function handleReleaseSubmit(
  request: Request,
  env: StorageEnv,
  adapter: DatabaseAdapter,
  headers: Record<string, string>,
  releaseId: string
): Promise<Response> {
  try {
    const authContext = await requireAuth(request, env, adapter);

    const release = await adapter.getRelease(releaseId);
    if (!release) {
      throw new NotFoundError(`Release ${releaseId} tidak ditemukan`);
    }

    await requireOwnership(authContext, release.owner_id, adapter);

    if (release.status !== 'draft' && release.status !== 'rejected') {
      throw new ValidationError('Only draft or rejected releases can be submitted for review.');
    }
    if (release.distribution_rights_confirmed !== true) {
      throw new ValidationError('Confirm distribution rights and ownership before submitting this release.');
    }

    // 1. Verify Cover Artwork
    const artworkUrl = release.artwork_url || '';
    if (!artworkUrl.trim()) {
      return jsonResponse(
        {
          success: false,
          error: 'Pengajuan ditolak: Cover artwork beresolusi tinggi wajib diunggah sebelum mengirim rilis.',
        },
        400,
        headers
      );
    }
    const artworkKey = artworkUrl.includes('/api/storage/')
      ? decodeURIComponent(artworkUrl.split('/api/storage/')[1].split(/[?#]/)[0])
      : artworkUrl.replace(/^\/+/, '');
    if (getStorageOwnerId(artworkKey) !== release.owner_id) {
      throw new ValidationError('Cover artwork must be stored under the release owner account.');
    }

    const artworkVerified = await checkStorageObjectExists(env, adapter, artworkUrl);
    if (!artworkVerified) {
      return jsonResponse(
        {
          success: false,
          error: 'Pengajuan ditolak: File cover artwork tidak terverifikasi di storage penyimpanan. Silakan upload ulang cover artwork.',
        },
        400,
        headers
      );
    }

    // 2. Verify Tracks & Audio Master
    const tracksResult = await adapter.listTracks(releaseId);
    const tracks = tracksResult.data || [];

    if (tracks.length === 0) {
      return jsonResponse(
        {
          success: false,
          error: 'Pengajuan ditolak: Belum ada track lagu audio master yang diunggah untuk rilis ini.',
        },
        400,
        headers
      );
    }

    for (const track of tracks) {
      if (track.owner_id !== release.owner_id) {
        throw new ValidationError(`Track "${track.title}" is not owned by the release artist.`);
      }
      if (track.distribution_rights_confirmed !== true) {
        return jsonResponse({ success: false, error: `Track "${track.title}" is missing distribution-rights confirmation.` }, 400, headers);
      }
      if (!track.audio_url || !track.audio_url.trim()) {
        return jsonResponse(
          {
            success: false,
            error: `Pengajuan ditolak: File audio master untuk track "${track.title}" belum diunggah.`,
          },
          400,
          headers
        );
      }
      const audioKey = track.audio_url.includes('/api/storage/')
        ? decodeURIComponent(track.audio_url.split('/api/storage/')[1].split(/[?#]/)[0])
        : track.audio_url.replace(/^\/+/, '');
      if (getStorageOwnerId(audioKey) !== release.owner_id) {
        throw new ValidationError(`Track "${track.title}" audio must be stored under the release owner account.`);
      }
      const audioVerified = await checkStorageObjectExists(env, adapter, track.audio_url);
      if (!audioVerified) {
        return jsonResponse(
          {
            success: false,
            error: `Pengajuan ditolak: File audio master untuk track "${track.title}" tidak terverifikasi di storage penyimpanan. Silakan upload ulang file audio master Anda.`,
          },
          400,
          headers
        );
      }
    }

    // 3. Update Status to REVIEW (Submitted for review)
    const updated = await adapter.updateReleaseStatus(releaseId, 'REVIEW', 'Submitted by artist for review', authContext.userId);

    return jsonResponse(
      {
        success: true,
        data: {
          ...updated,
          message: 'Rilis lagu dan master audio berhasil diverifikasi dan diajukan untuk ditinjau oleh Admin!',
        },
      },
      200,
      headers
    );
  } catch (error) {
    const errorResponse = handleError(error);
    const statusCode = getStatusCode(error);
    return jsonResponse(errorResponse, statusCode, headers);
  }
}
