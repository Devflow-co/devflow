import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer;

  constructor() {
    const key = process.env.OAUTH_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required');
    }
    this.masterKey = Buffer.from(key, 'base64');
  }

  encrypt(plaintext: string): { ciphertext: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted + ':' + authTag.toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  decrypt(ciphertext: string, iv: string): string {
    const [encrypted, authTagB64] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
