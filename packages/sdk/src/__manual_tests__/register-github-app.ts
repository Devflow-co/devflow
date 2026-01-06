#!/usr/bin/env ts-node
/**
 * Script to register GitHub App credentials in DevFlow
 *
 * Usage:
 *   OAUTH_ENCRYPTION_KEY="..." npx ts-node src/__manual_tests__/register-github-app.ts
 *
 * You'll be prompted to enter:
 *   - App ID (from GitHub App settings)
 *   - Client ID (from GitHub App settings)
 *   - Client Secret (from GitHub App settings)
 *   - Private Key (PEM file content)
 *   - Webhook Secret (from GitHub App settings)
 *   - App Name
 *   - App Slug
 *   - Project ID (optional, leave empty for global config)
 */

import { PrismaClient } from '@prisma/client';
import { TokenEncryptionService } from '../auth/token-encryption.service';
import * as readline from 'readline';

const prisma = new PrismaClient();
const encryptionService = new TokenEncryptionService();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionMultiline(prompt: string): Promise<string> {
  console.log(prompt);
  console.log('(Paste your content and press Ctrl+D when done)');

  return new Promise((resolve) => {
    let content = '';
    process.stdin.on('data', (chunk) => {
      content += chunk.toString();
    });
    process.stdin.on('end', () => {
      resolve(content.trim());
    });
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('GitHub App Registration Script');
  console.log('='.repeat(60));
  console.log();

  // Verify encryption key is set
  if (!process.env.OAUTH_ENCRYPTION_KEY) {
    console.error('❌ OAUTH_ENCRYPTION_KEY environment variable is required');
    process.exit(1);
  }

  console.log('Please provide the following information from your GitHub App:');
  console.log('(You can find these at: https://github.com/settings/apps/YOUR_APP)');
  console.log();

  try {
    // Collect information
    const appId = await question('App ID: ');
    const clientId = await question('Client ID: ');
    const clientSecret = await question('Client Secret: ');

    // Switch to raw mode for multiline private key input
    rl.close();
    const privateKey = await questionMultiline('\nPrivate Key (PEM format):');

    // Create new readline interface for remaining questions
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const webhookSecret = await new Promise<string>((resolve) => {
      rl2.question('\nWebhook Secret (optional, press Enter to skip): ', (answer) => {
        resolve(answer.trim());
      });
    });

    const name = await new Promise<string>((resolve) => {
      rl2.question('App Name: ', (answer) => {
        resolve(answer.trim());
      });
    });

    const slug = await new Promise<string>((resolve) => {
      rl2.question('App Slug (URL-friendly name): ', (answer) => {
        resolve(answer.trim());
      });
    });

    const projectId = await new Promise<string>((resolve) => {
      rl2.question('Project ID (optional, leave empty for global config): ', (answer) => {
        resolve(answer.trim());
      });
    });

    rl2.close();

    console.log();
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
      console.log();
      console.log('⚠️  A GitHub App config already exists for this project.');
      console.log(`   Existing config ID: ${existing.id}`);
      console.log(`   Existing app: ${existing.name} (${existing.slug})`);
      console.log();

      const rl3 = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const overwrite = await new Promise<string>((resolve) => {
        rl3.question('Do you want to overwrite it? (yes/no): ', (answer) => {
          resolve(answer.trim().toLowerCase());
        });
      });

      rl3.close();

      if (overwrite !== 'yes' && overwrite !== 'y') {
        console.log('❌ Registration cancelled.');
        await prisma.$disconnect();
        process.exit(0);
      }

      // Update existing config
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

      console.log();
      console.log('✅ GitHub App config updated successfully!');
    } else {
      // Create new config
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

      console.log();
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
    console.log('1. Ensure your GitHub App callback URL is set to:');
    console.log('   https://api.your-domain.com/api/v1/auth/github-app/callback');
    console.log('2. Ensure your GitHub App webhook URL is set to:');
    console.log('   https://api.your-domain.com/api/v1/webhooks/github-app');
    console.log('3. Go to your project settings and click "Install GitHub App"');
    console.log();

  } catch (error) {
    console.error('❌ Registration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
