#!/usr/bin/env ts-node
/**
 * Create Indy Promocode project and set up OAuth
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function encrypt(text: string, encryptionKey: string): { encrypted: string; iv: string } {
  const key = Buffer.from(encryptionKey, 'base64');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
  };
}

async function main() {
  console.log('\n🚀 Creating Indy Promocode DevFlow Project\n');
  console.log('='.repeat(60));

  const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('❌ OAUTH_ENCRYPTION_KEY not set!');
    process.exit(1);
  }

  // Create project
  console.log('\n📦 Creating project...');
  const project = await prisma.project.create({
    data: {
      name: 'Indy test',
      description: 'DevFlow automation for Indy Promocode project',
      repository: 'victorgambert/indy-promocode',
      config: {
        linear: {
          triggerStatus: 'To Spec',
          nextStatus: 'Spec Ready',
        },
        github: {
          owner: 'victorgambert',
          repo: 'indy-promocode',
          defaultBranch: 'main',
        },
        ai: {
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-4',
        },
      },
      isActive: true,
    },
  });

  console.log(`✅ Project created: ${project.name}`);
  console.log(`   ID: ${project.id}\n`);

  // Register OAuth apps
  console.log('🔐 Registering OAuth applications...\n');

  // GitHub OAuth App (Device Flow)
  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID || 'Ov23li0GLNRQ6wGKiTyC';
  const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || 'test_secret_for_development';
  const githubEncrypted = encrypt(githubClientSecret, encryptionKey);

  const githubApp = await prisma.oAuthApplication.create({
    data: {
      projectId: project.id,
      provider: 'GITHUB',
      clientId: githubClientId,
      clientSecret: githubEncrypted.encrypted,
      encryptionIv: githubEncrypted.iv,
      redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
      flowType: 'device',
      scopes: ['repo', 'workflow', 'read:user'],
      name: 'GitHub OAuth App',
      isActive: true,
    },
  });
  console.log(`✅ GitHub OAuth app registered`);

  // Linear OAuth App (Authorization Code Flow)
  const linearClientId = process.env.LINEAR_OAUTH_CLIENT_ID || 'test_linear_client';
  const linearClientSecret = process.env.LINEAR_OAUTH_CLIENT_SECRET || 'test_secret_for_development';
  const linearEncrypted = encrypt(linearClientSecret, encryptionKey);

  const linearApp = await prisma.oAuthApplication.create({
    data: {
      projectId: project.id,
      provider: 'LINEAR',
      clientId: linearClientId,
      clientSecret: linearEncrypted.encrypted,
      encryptionIv: linearEncrypted.iv,
      redirectUri: 'http://localhost:8000/api/v1/auth/linear/callback',
      flowType: 'authorization_code',
      scopes: ['read', 'write', 'issues:create', 'comments:create'],
      name: 'Linear OAuth App',
      isActive: true,
    },
  });
  console.log(`✅ Linear OAuth app registered`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Project setup complete!\n');
  console.log('📋 Project ID:', project.id);
  console.log('📦 Repository:', project.repository);
  console.log('');

  // Save project ID to file for easy reference
  const fs = require('fs');
  fs.writeFileSync('.devflow-project-id', project.id);
  console.log('💾 Project ID saved to .devflow-project-id\n');

  await prisma.$disconnect();
  return project.id;
}

main().then((projectId) => {
  console.log('🔑 Next: Connect OAuth providers\n');
  console.log('Run the following commands:\n');
  console.log(`export PROJECT_ID="${projectId}"`);
  console.log('');
  console.log('# Test GitHub OAuth:');
  console.log('./test-oauth-flow.sh $PROJECT_ID github');
  console.log('');
  console.log('# Test Linear OAuth:');
  console.log('./test-oauth-flow.sh $PROJECT_ID linear');
  console.log('');
}).catch((error) => {
  console.error('\n❌ Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
