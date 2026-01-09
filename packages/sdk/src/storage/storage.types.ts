/**
 * Storage service types for Supabase Storage integration
 */

export interface StorageConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  bucket: string;
}

export interface UploadOptions {
  folder: string;
  fileName?: string;
  contentType: string;
  maxSizeBytes: number;
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// Allowed image types for avatar and logo uploads
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

// Size limits
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_LOGO_SIZE = 10 * 1024 * 1024; // 10MB
