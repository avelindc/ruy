import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

// Artist schemas
export const artistSchema = z.object({
  artist_name: z.string().min(2, 'Artist name must be at least 2 characters'),
  bio: z.string().optional(),
  genre: z.string().optional(),
  country: z.string().optional(),
});

// Release schemas
export const releaseSchema = z.object({
  title: z.string().min(2, 'Release title must be at least 2 characters'),
  release_type: z.enum(['single', 'ep', 'album']),
  primary_artist_id: z.string().uuid('Invalid artist ID'),
  upc: z.string().optional(),
  label_name: z.string().optional(),
  release_date: z.string().datetime(),
});

// Track schemas
export const trackSchema = z.object({
  title: z.string().min(2, 'Track title must be at least 2 characters'),
  duration: z.number().positive('Duration must be positive'),
  isrc: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  explicit_content: z.boolean().default(false),
});

// Withdrawal schemas
export const withdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  payout_method: z.string().min(1, 'Payout method is required'),
  payout_reference: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ArtistInput = z.infer<typeof artistSchema>;
export type ReleaseInput = z.infer<typeof releaseSchema>;
export type TrackInput = z.infer<typeof trackSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
