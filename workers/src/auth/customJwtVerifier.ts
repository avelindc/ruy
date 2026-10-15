/**
 * BREAKOUT MUSIC — Custom JWT Verifier
 *
 * Implements JwtVerifier for custom JWT strategies.
 * Verifies the custom JWTs issued by the Breakout Music Worker auth routes.
 */

import type { JwtVerifier, JwtPayload, VerificationResult, CustomJwtConfig } from '../types/jwt';
import { JWT_ERROR_CODES } from '../types/jwt';

/** Decode a Base64URL segment, including segments without padding. */
function decodeBase64Url(segment: string): Uint8Array | null {
  try {
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = base64.length % 4;
    if (remainder === 1) return null;
    if (remainder > 0) base64 += '='.repeat(4 - remainder);

    const binary = atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Decode JWT without verification
 */
function decodeJwt(token: string): { header: any; payload: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const headerBytes = decodeBase64Url(parts[0]);
    const payloadBytes = decodeBase64Url(parts[1]);
    if (!headerBytes || !payloadBytes) return null;

    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(headerBytes));
    const payload = JSON.parse(decoder.decode(payloadBytes));

    return { header, payload };
  } catch (error) {
    return null;
  }
}

/**
 * Verify JWT signature (HMAC algorithms)
 */
async function verifyHmacSignature(
  token: string,
  secret: string,
  algorithm: string
): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    // Map algorithm to hash function
    let hashAlgo: string;
    if (algorithm === 'HS256') {
      hashAlgo = 'SHA-256';
    } else if (algorithm === 'HS512') {
      hashAlgo = 'SHA-512';
    } else {
      return false;
    }

    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: hashAlgo },
      false,
      ['sign', 'verify']
    );

    const signatureBytes = decodeBase64Url(signatureB64);
    if (!signatureBytes) return false;

    return await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(message));
  } catch (error) {
    return false;
  }
}

/**
 * Custom JWT Verifier Implementation
 * Supports HMAC-based JWT verification for internal or alternative auth systems
 */
export class CustomJwtVerifier implements JwtVerifier {
  private config: CustomJwtConfig;

  constructor(config: CustomJwtConfig) {
    this.config = {
      clockSkew: 0,
      ...config,
    };
  }

  getName(): string {
    return 'CustomJwtVerifier';
  }

  /**
   * Main verification method
   */
  async verify(token: string): Promise<VerificationResult> {
    try {
      // Decode JWT without verification first
      const decoded = decodeJwt(token);
      if (!decoded) {
        return {
          valid: false,
          error: 'Invalid JWT format',
          errorCode: JWT_ERROR_CODES.INVALID_FORMAT,
        };
      }

      const { header, payload } = decoded;

      // Validate required claims
      if (!payload.sub) {
        return {
          valid: false,
          error: 'Missing required claim: sub (user ID)',
          errorCode: JWT_ERROR_CODES.MISSING_CLAIM,
        };
      }

      if (typeof payload.jti !== 'string' || !payload.jti || typeof payload.exp !== 'number') {
        return {
          valid: false,
          error: 'Missing required session or expiry claim',
          errorCode: JWT_ERROR_CODES.MISSING_CLAIM,
        };
      }

      // Validate algorithm
      if (header.alg !== this.config.algorithm) {
        return {
          valid: false,
          error: `Invalid algorithm. Expected ${this.config.algorithm}, got ${header.alg}`,
          errorCode: JWT_ERROR_CODES.INVALID_ALGORITHM,
        };
      }

      // Validate issuer
      if (payload.iss !== this.config.issuer) {
        return {
          valid: false,
          error: `Invalid issuer. Expected ${this.config.issuer}, got ${payload.iss}`,
          errorCode: JWT_ERROR_CODES.INVALID_ISSUER,
        };
      }

      // Validate audience if configured
      if (this.config.audience && payload.aud !== this.config.audience) {
        return {
          valid: false,
          error: `Invalid audience. Expected ${this.config.audience}, got ${payload.aud}`,
          errorCode: JWT_ERROR_CODES.INVALID_AUDIENCE,
        };
      }

      // Validate expiry with clock skew
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        const clockSkew = this.config.clockSkew || 0;
        if (payload.exp < now - clockSkew) {
          return {
            valid: false,
            error: 'Token has expired',
            errorCode: JWT_ERROR_CODES.TOKEN_EXPIRED,
          };
        }
      }

      // Verify signature (HMAC only for custom JWT)
      const signatureValid = await verifyHmacSignature(token, this.config.signingKey, this.config.algorithm);
      if (!signatureValid) {
        return {
          valid: false,
          error: 'Invalid signature',
          errorCode: JWT_ERROR_CODES.INVALID_SIGNATURE,
        };
      }

      // All checks passed
      return {
        valid: true,
        payload: payload as JwtPayload,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
        errorCode: JWT_ERROR_CODES.VERIFICATION_FAILED,
      };
    }
  }
}
