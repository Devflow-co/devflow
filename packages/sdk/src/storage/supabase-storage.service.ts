import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  StorageConfig,
  UploadOptions,
  UploadResult,
  StorageError,
  ALLOWED_IMAGE_TYPES,
  AllowedImageType,
} from './storage.types';

/**
 * Service for uploading and managing files in Supabase Storage
 */
export class SupabaseStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.bucket = config.bucket;
  }

  /**
   * Upload a file to Supabase Storage
   */
  async upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    // Validate file size
    if (buffer.length > options.maxSizeBytes) {
      const maxMB = Math.round(options.maxSizeBytes / 1024 / 1024);
      throw new StorageError(
        'File too large. Maximum size: ' + maxMB + 'MB',
        'FILE_TOO_LARGE',
      );
    }

    // Validate content type
    if (!ALLOWED_IMAGE_TYPES.includes(options.contentType as AllowedImageType)) {
      throw new StorageError(
        'Invalid file type: ' + options.contentType + '. Allowed: ' + ALLOWED_IMAGE_TYPES.join(', '),
        'INVALID_FILE_TYPE',
      );
    }

    // Generate file path
    const extension = this.getExtensionFromMimeType(options.contentType);
    const fileName = options.fileName || this.generateFileName();
    const path = options.folder + '/' + fileName + '.' + extension;

    // Upload to Supabase
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType: options.contentType,
        upsert: true,
      });

    if (error) {
      throw new StorageError('Upload failed: ' + error.message, 'UPLOAD_FAILED');
    }

    // Get public URL
    const { data: urlData } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return {
      path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Delete a file from Supabase Storage
   */
  async delete(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new StorageError('Delete failed: ' + error.message, 'DELETE_FAILED');
    }
  }

  /**
   * Delete a file by its public URL
   */
  async deleteByUrl(publicUrl: string): Promise<void> {
    const path = this.extractPathFromUrl(publicUrl);
    if (path) {
      await this.delete(path);
    }
  }

  /**
   * Extract the storage path from a public URL
   * Returns null if the URL is not from this storage bucket
   */
  extractPathFromUrl(publicUrl: string): string | null {
    try {
      const url = new URL(publicUrl);
      // Supabase public URLs have format:
      // https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path}
      const pathMatch = url.pathname.match(
        /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/,
      );
      if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return extensions[mimeType] || 'bin';
  }

  /**
   * Generate a random file name
   */
  private generateFileName(): string {
    return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Factory function to create a SupabaseStorageService
 */
export function createSupabaseStorageService(
  config: StorageConfig,
): SupabaseStorageService {
  return new SupabaseStorageService(config);
}
