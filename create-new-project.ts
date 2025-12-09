#!/usr/bin/env ts-node
/**
 * Interactive script to create a new DevFlow project and set up OAuth
 *
 * Usage:
 *   DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
 *   OAUTH_ENCRYPTION_KEY="$OAUTH_ENCRYPTION_KEY" \
 *   npx ts-node create-new-project.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

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
  console.log('\n🚀 DevFlow - Create New Project\n');
  console.log('='.repeat(60));
  console.log('\n');

  // Check encryption key
  const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('❌ OAUTH_ENCRYPTION_KEY not set!');
    console.error('\nGenerate one with:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    process.exit(1);
  }

  // Gather project details
  console.log('📝 Project Information\n');

  const projectName = await question('Project name: ');
  const projectDescription = await question('Project description: ');
  const repository = await question('GitHub repository (owner/repo): ');

  console.log('\n📋 Linear Configuration\n');
  const triggerStatus = await question('Linear trigger status [To Spec]: ') || 'To Spec';
  const nextStatus = await question('Linear next status [Spec Ready]: ') || 'Spec Ready';

  console.log('\n🤖 AI Configuration\n');
  const aiProvider = await question('AI provider [openrouter]: ') || 'openrouter';
  const aiModel = await question('AI model [anthropic/claude-sonnet-4]: ') || 'anthropic/claude-sonnet-4';

  console.log('\n🔐 GitHub OAuth Setup\n');
  console.log('You can create a GitHub OAuth App at:');
  console.log('https://github.com/settings/developers\n');

  const githubClientId = await question('GitHub OAuth Client ID [Ov23li0GLNRQ6wGKiTyC]: ') || 'Ov23li0GLNRQ6wGKiTyC';
  const githubClientSecret = await question('GitHub OAuth Client Secret (leave empty for testing): ') || 'test_secret_for_development';

  console.log('\n🔗 Linear OAuth Setup\n');
  console.log('You can create a Linear OAuth App at:');
  console.log('https://linear.app/settings/api\n');

  const linearClientId = await question('Linear OAuth Client ID (optional): ') || 'test_linear_client_id';
  const linearClientSecret = await question('Linear OAuth Client Secret (optional): ') || 'test_secret_for_development';

  console.log('\n\n📦 Creating project...');

  // Create project
  const project = await prisma.project.create({
    data: {
      name: projectName,
      description: projectDescription,
      repository: repository,
      config: {
        linear: {
          triggerStatus,
          nextStatus,
        },
        github: {
          owner: repository.split('/')[0],
          defaultBranch: 'main',
        },
        ai: {
          provider: aiProvider,
          model: aiModel,
        },
      },
      isActive: true,
    },
  });

  console.log(`✅ Project created: ${project.name}`);
  console.log(`   ID: ${project.id}\n`);

  // Register OAuth apps
  console.log('🔐 Registering OAuth applications...\n');

  // GitHub OAuth App
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
      description: 'GitHub Device Flow OAuth',
      isActive: true,
    },
  });
  console.log(`✅ GitHub OAuth app registered (${githubApp.id})`);

  // Linear OAuth App
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
      description: 'Linear Authorization Code Flow OAuth',
      isActive: true,
    },
  });
  console.log(`✅ Linear OAuth app registered (${linearApp.id})`);

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Project setup complete!\n');

  console.log('📋 Project Details:');
  console.log(`   Name: ${project.name}`);
  console.log(`   ID: ${project.id}`);
  console.log(`   Repository: ${project.repository}`);
  console.log(`   Linear Trigger: ${triggerStatus} → ${nextStatus}`);
  console.log(`   AI: ${aiProvider}/${aiModel}\n`);

  console.log('🔑 Next Steps - Connect OAuth:\n');
  console.log('1️⃣  Ensure API is running:');
  console.log('   pnpm --filter @devflow/api dev');
  console.log('   (Should be on http://localhost:8000)\n');

  console.log('2️⃣  Test GitHub OAuth (Device Flow):');
  console.log(`   ./test-oauth-flow.sh ${project.id} github\n`);
  console.log('   Or manually:');
  console.log(`   curl -X POST http://localhost:8000/api/v1/auth/github/device/initiate \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"projectId": "${project.id}"}' | jq '.'`);
  console.log('');

  console.log('3️⃣  Test Linear OAuth (Authorization Code):');
  console.log(`   ./test-oauth-flow.sh ${project.id} linear\n`);
  console.log('   Or manually:');
  console.log(`   curl -X POST http://localhost:8000/api/v1/auth/linear/authorize \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"projectId": "${project.id}"}' | jq '.'`);
  console.log('');

  console.log('4️⃣  Verify connections:');
  console.log(`   curl "http://localhost:8000/api/v1/auth/connections?project=${project.id}" | jq '.'`);
  console.log('');

  console.log('📚 For more details, see: docs/TESTING_NEW_PROJECT_WORKFLOW.md\n');
  console.log('='.repeat(60));

  rl.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  rl.close();
  prisma.$disconnect();
  process.exit(1);
});
