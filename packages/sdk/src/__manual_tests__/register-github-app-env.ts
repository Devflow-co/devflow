#!/usr/bin/env ts-node
/**
 * Script to register GitHub App credentials in DevFlow using environment variables
 *
 * Usage:
 *   DATABASE_URL="..." \
 *   OAUTH_ENCRYPTION_KEY="..." \
 *   GITHUB_APP_ID="123456" \
 *   GITHUB_CLIENT_ID="Iv1.abc123" \
 *   GITHUB_CLIENT_SECRET="..." \
 *   GITHUB_PRIVATE_KEY="$(cat path/to/private-key.pem)" \
 *   GITHUB_WEBHOOK_SECRET="..." \
 *   GITHUB_APP_NAME="DevFlow" \
 *   GITHUB_APP_SLUG="devflow" \
 *   PROJECT_ID="" \
 *   npx ts-node src/__manual_tests__/register-github-app-env.ts
 *
 * Or read from a .env file in the SDK directory
 */

import { PrismaClient } from '@prisma/client';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import { config } from 'dotenv';
import * as path from 'path';

// Load .env file from SDK directory
config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const encryptionService = new TokenEncryptionService();

async function main() {
  console.log('='.repeat(60));
  console.log('GitHub App Registration Script (Environment Variables)');
  console.log('='.repeat(60));
  console.log();

  // Verify required environment variables
  const requiredEnvVars = [
    'OAUTH_ENCRYPTION_KEY',
    'GITHUB_APP_ID',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GITHUB_PRIVATE_KEY',
    'GITHUB_APP_NAME',
    'GITHUB_APP_SLUG',
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error();
    console.error('Example usage:');
    console.error('  DATABASE_URL="postgresql://..." \\');
    console.error('  OAUTH_ENCRYPTION_KEY="your-key" \\');
    console.error('  GITHUB_APP_ID="123456" \\');
    console.error('  GITHUB_CLIENT_ID="Iv1.abc123" \\');
    console.error('  GITHUB_CLIENT_SECRET="..." \\');
    console.error('  GITHUB_PRIVATE_KEY="$(cat private-key.pem)" \\');
    console.error('  GITHUB_WEBHOOK_SECRET="..." \\');
    console.error('  GITHUB_APP_NAME="DevFlow" \\');
    console.error('  GITHUB_APP_SLUG="devflow" \\');
    console.error('  PROJECT_ID="" \\');
    console.error('  npx ts-node src/__manual_tests__/register-github-app-env.ts');
    process.exit(1);
  }

  const appId = process.env.GITHUB_APP_ID!;
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET!;
  const privateKey = process.env.GITHUB_PRIVATE_KEY!;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || null;
  const name = process.env.GITHUB_APP_NAME!;
  const slug = process.env.GITHUB_APP_SLUG!;
  const projectId = process.env.PROJECT_ID || null;

  try {
    console.log('Encrypting sensitive data...');

    // Encrypt sensitive fields
    const { ciphertext: encryptedClientSecret, iv: clientSecretIv } =
      encryptionService.encrypt(clientSecret);

    const { ciphertext: encryptedPrivateKey, iv: privateKeyIv } =
      encryptionService.encrypt(privateKey);

    let encryptedWebhookSecret: string | null = null;
    let webhookSecretIv: string | null = null;

    if (webhookSecret) {
      const result = encryptionService.encrypt(webhookSecret);
      encryptedWebhookSecret = result.ciphertext;
      webhookSecretIv = result.iv;
    }

    console.log('Storing in database...');

    // Check if config already exists for this project
    const existing = await prisma.gitHubAppConfig.findFirst({
      where: {
        projectId: projectId || null,
      },
    });

    if (existing) {
      console.log(`⚠️  Updating existing GitHub App config (ID: ${existing.id})`);

      await prisma.gitHubAppConfig.update({
        where: { id: existing.id },
        data: {
          appId: BigInt(appId),
          clientId,
          clientSecret: encryptedClientSecret,
          encryptionIv: clientSecretIv,
          privateKey: encryptedPrivateKey,
          privateKeyIv,
          webhookSecret: encryptedWebhookSecret,
          webhookSecretIv,
          name,
          slug,
          isActive: true,
        },
      });

      console.log('✅ GitHub App config updated successfully!');
    } else {
      const config = await prisma.gitHubAppConfig.create({
        data: {
          projectId: projectId || null,
          appId: BigInt(appId),
          clientId,
          clientSecret: encryptedClientSecret,
          encryptionIv: clientSecretIv,
          privateKey: encryptedPrivateKey,
          privateKeyIv,
          webhookSecret: encryptedWebhookSecret,
          webhookSecretIv,
          name,
          slug,
          isActive: true,
        },
      });

      console.log('✅ GitHub App registered successfully!');
      console.log(`   Config ID: ${config.id}`);
    }

    console.log();
    console.log('Configuration Details:');
    console.log(`   App ID: ${appId}`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Name: ${name}`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Project: ${projectId || 'Global (all projects)'}`);
    console.log(`   Webhook Secret: ${webhookSecret ? 'Configured' : 'Not configured'}`);
    console.log();
    console.log('Next steps:');
    console.log('1. Go to https://github.com/settings/apps/' + slug);
    console.log('2. Verify callback URL: https://api.your-domain.com/api/v1/auth/github-app/callback');
    console.log('3. Verify webhook URL: https://api.your-domain.com/api/v1/webhooks/github-app');
    console.log('4. Test the installation from your project settings page');
    console.log();

  } catch (error) {
    console.error('❌ Registration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
