/**
 * BREAKOUT MUSIC — JWT Verification Types & Interface
 *
 * Defines the custom JWT verifier contract used by this Worker.
 */

// ============================================================================
// JWT PAYLOAD TYPES
// ============================================================================

export interface JwtPayload {
  sub: string; // Subject (user ID)
  email: string;
  email_verified?: boolean;
  user_role?: 'user' | 'admin' | 'super_admin';
  aud?: string; // Audience
  iss?: string; // Issuer
  iat?: number; // Issued at
  exp?: number; // Expiration
  [key: string]: any; // Allow additional claims
}

export interface VerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// JWT VERIFIER INTERFACE
// ============================================================================

/**
 * Abstract JWT verifier interface for strategy pattern.
 * The Worker verifies its own signed JWTs.
 */
export interface JwtVerifier {
  /**
   * Verify a JWT token and extract claims
   * @param token - JWT token (without "Bearer " prefix)
   * @returns VerificationResult with valid flag and payload (if valid)
   * @throws AuthenticationError if token cannot be verified
   */
  verify(token: string): Promise<VerificationResult>;

  /**
   * Get verifier strategy name for logging/debugging
   */
  getName(): string;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const JWT_ERROR_CODES = {
  INVALID_FORMAT: 'JWT_INVALID_FORMAT',
  MISSING_CLAIM: 'JWT_MISSING_CLAIM',
  INVALID_SIGNATURE: 'JWT_INVALID_SIGNATURE',
  INVALID_ISSUER: 'JWT_INVALID_ISSUER',
  INVALID_AUDIENCE: 'JWT_INVALID_AUDIENCE',
  TOKEN_EXPIRED: 'JWT_TOKEN_EXPIRED',
  INVALID_ALGORITHM: 'JWT_INVALID_ALGORITHM',
  KEY_NOT_FOUND: 'JWT_KEY_NOT_FOUND',
  VERIFICATION_FAILED: 'JWT_VERIFICATION_FAILED',
} as const;

// ============================================================================
// CUSTOM JWT CONFIGURATION
// ============================================================================

export interface CustomJwtConfig {
  /**
   * Expected JWT issuer
   * Example: https://auth.example.com
   */
  issuer: string;

  /**
   * Signing key (HMAC secret or public key)
   */
  signingKey: string;

  /**
   * Algorithm (HS256, RS256, HS512, etc)
   */
  algorithm: 'HS256' | 'HS512' | 'RS256' | 'RS512' | 'ECDSA';

  /**
   * Expected audience
   */
  audience?: string;

  /**
   * Allowed clock skew in seconds (default: 0)
   */
  clockSkew?: number;
}
