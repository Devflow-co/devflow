/**
 * Test script for complete project initialization workflow
 *
 * This script tests:
 * 1. Creating a new project in the database
 * 2. Registering OAuth applications (GitHub + Linear)
 * 3. Verifying OAuth setup
 * 4. Testing the workflow trigger
 *
 * Usage:
 *   DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
 *   npx tsx src/__manual_tests__/test-project-initialization.ts
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface ProjectConfig {
  name: string;
  description: string;
  repository: string;
  linearConfig?: {
    triggerStatus: string;
    nextStatus: string;
    teamId?: string;
  };
  githubConfig?: {
    owner: string;
    defaultBranch: string;
  };
  aiConfig?: {
    provider: string;
    model: string;
  };
}

/**
 * Step 1: Create a new project
 */
async function createProject(config: ProjectConfig) {
  console.log('\n📦 Step 1: Creating new project...');

  const project = await prisma.project.create({
    data: {
      name: config.name,
      description: config.description,
      repository: config.repository,
      config: {
        linear: config.linearConfig || {
          triggerStatus: 'To Spec',
          nextStatus: 'Spec Ready',
        },
        github: config.githubConfig || {
          owner: config.repository.split('/')[0],
          defaultBranch: 'main',
        },
        ai: config.aiConfig || {
          provider: 'openrouter',
          model: 'anthropic/claude-sonnet-4',
        },
      },
      isActive: true,
    },
  });

  console.log(`✅ Project created: ${project.name} (${project.id})`);
  return project;
}

/**
 * Step 2: Register OAuth applications for the project
 */
async function registerOAuthApps(projectId: string) {
  console.log('\n🔐 Step 2: Registering OAuth applications...');

  // Check if OAUTH_ENCRYPTION_KEY is set
  const encryptionKey = process.env.OAUTH_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('❌ OAUTH_ENCRYPTION_KEY not set. Generate one with:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    throw new Error('OAUTH_ENCRYPTION_KEY not set');
  }

  // Encrypt a value using the encryption key
  function encrypt(text: string): { encrypted: string; iv: string } {
    if (!encryptionKey) {
      throw new Error('OAUTH_ENCRYPTION_KEY not set');
    }
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

  // GitHub OAuth App (Device Flow)
  const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID || 'Ov23li0GLNRQ6wGKiTyC';
  const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET || 'placeholder_for_testing';

  const githubEncrypted = encrypt(githubClientSecret);

  const githubApp = await prisma.oAuthApplication.upsert({
    where: {
      projectId_provider: {
        projectId,
        provider: 'GITHUB',
      },
    },
    create: {
      projectId,
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
    update: {
      clientId: githubClientId,
      clientSecret: githubEncrypted.encrypted,
      encryptionIv: githubEncrypted.iv,
      isActive: true,
    },
  });

  console.log(`✅ GitHub OAuth app registered (${githubApp.id})`);

  // Linear OAuth App (Authorization Code Flow)
  const linearClientId = process.env.LINEAR_OAUTH_CLIENT_ID || 'placeholder_linear_client_id';
  const linearClientSecret = process.env.LINEAR_OAUTH_CLIENT_SECRET || 'placeholder_for_testing';

  const linearEncrypted = encrypt(linearClientSecret);

  const linearApp = await prisma.oAuthApplication.upsert({
    where: {
      projectId_provider: {
        projectId,
        provider: 'LINEAR',
      },
    },
    create: {
      projectId,
      provider: 'LINEAR',
      clientId: linearClientId,
      clientSecret: linearEncrypted.encrypted,
      encryptionIv: linearEncrypted.iv,
      redirectUri: 'http://localhost:3000/api/v1/auth/linear/callback',
      flowType: 'authorization_code',
      scopes: ['read', 'write', 'issues:create', 'comments:create'],
      name: 'Linear OAuth App',
      description: 'Linear Authorization Code Flow OAuth',
      isActive: true,
    },
    update: {
      clientId: linearClientId,
      clientSecret: linearEncrypted.encrypted,
      encryptionIv: linearEncrypted.iv,
      isActive: true,
    },
  });

  console.log(`✅ Linear OAuth app registered (${linearApp.id})`);

  return { githubApp, linearApp };
}

/**
 * Step 3: Check OAuth connections status
 */
async function checkOAuthConnections(projectId: string) {
  console.log('\n🔍 Step 3: Checking OAuth connections...');

  const connections = await prisma.oAuthConnection.findMany({
    where: { projectId },
  });

  if (connections.length === 0) {
    console.log('⚠️  No OAuth connections found. You need to connect OAuth providers:');
    console.log('\n   For GitHub (Device Flow):');
    console.log('   1. Start the API: pnpm --filter @devflow/api dev');
    console.log('   2. Call: POST http://localhost:3000/api/v1/auth/github/device/initiate');
    console.log('      Body: {"projectId": "' + projectId + '"}');
    console.log('   3. Visit the verification URL and enter the user code');
    console.log('   4. Poll: POST http://localhost:3000/api/v1/auth/github/device/poll');
    console.log('      Body: {"deviceCode": "...", "projectId": "' + projectId + '"}');

    console.log('\n   For Linear (Authorization Code Flow):');
    console.log('   1. Start the API: pnpm --filter @devflow/api dev');
    console.log('   2. Call: POST http://localhost:3000/api/v1/auth/linear/authorize');
    console.log('      Body: {"projectId": "' + projectId + '"}');
    console.log('   3. Visit the authorization URL');
    console.log('   4. The callback will handle the token exchange automatically');

    return null;
  }

  console.log(`✅ Found ${connections.length} OAuth connection(s):`);
  for (const conn of connections) {
    console.log(`   - ${conn.provider}: ${conn.isActive ? '✅ Active' : '❌ Inactive'}`);
    if (conn.providerEmail) {
      console.log(`     Email: ${conn.providerEmail}`);
    }
    if (conn.expiresAt) {
      const expired = new Date() > conn.expiresAt;
      console.log(`     Expires: ${conn.expiresAt.toISOString()} ${expired ? '(EXPIRED)' : ''}`);
    }
  }

  return connections;
}

/**
 * Step 4: Verify project is ready for workflows
 */
async function verifyProjectReadiness(projectId: string) {
  console.log('\n✅ Step 4: Verifying project readiness...');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      oauthApplications: true,
      oauthConnections: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const checks = {
    projectActive: project.isActive,
    githubOAuthApp: project.oauthApplications.some(app => app.provider === 'GITHUB' && app.isActive),
    linearOAuthApp: project.oauthApplications.some(app => app.provider === 'LINEAR' && app.isActive),
    githubConnected: project.oauthConnections.some(conn => conn.provider === 'GITHUB' && conn.isActive),
    linearConnected: project.oauthConnections.some(conn => conn.provider === 'LINEAR' && conn.isActive),
  };

  console.log('\n📋 Project Readiness Check:');
  console.log(`   Project Active: ${checks.projectActive ? '✅' : '❌'}`);
  console.log(`   GitHub OAuth App: ${checks.githubOAuthApp ? '✅' : '❌'}`);
  console.log(`   Linear OAuth App: ${checks.linearOAuthApp ? '✅' : '❌'}`);
  console.log(`   GitHub Connected: ${checks.githubConnected ? '✅' : '❌'}`);
  console.log(`   Linear Connected: ${checks.linearConnected ? '✅' : '❌'}`);

  const isReady = Object.values(checks).every(v => v === true);

  if (isReady) {
    console.log('\n🎉 Project is fully configured and ready for workflows!');
  } else {
    console.log('\n⚠️  Project is not fully configured. Complete the missing steps above.');
  }

  return { checks, isReady };
}

/**
 * Step 5: Display next steps
 */
function displayNextSteps(projectId: string, isReady: boolean) {
  console.log('\n📝 Next Steps:');

  if (!isReady) {
    console.log('\n1. Complete OAuth connections (see instructions above)');
    console.log('2. Re-run this script to verify');
  } else {
    console.log('\n1. Create a Linear issue with status "To Spec"');
    console.log('2. The webhook will trigger the workflow automatically');
    console.log('\n   Or manually trigger a workflow:');
    console.log(`   POST http://localhost:3000/api/v1/workflows/{workflowId}/start`);
    console.log(`   Body: {`);
    console.log(`     "projectId": "${projectId}",`);
    console.log(`     "taskId": "linear-issue-id"`);
    console.log(`   }`);
  }

  console.log('\n🔧 Useful commands:');
  console.log('   - View Temporal UI: http://localhost:8080');
  console.log('   - View database: pnpm --filter @devflow/api prisma:studio');
  console.log('   - Start API: pnpm --filter @devflow/api dev');
  console.log('   - Start Worker: pnpm --filter @devflow/worker dev');
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 DevFlow Project Initialization Test\n');
  console.log('='.repeat(60));

  try {
    // Example project configuration
    const projectConfig: ProjectConfig = {
      name: 'Test Project',
      description: 'A test project for DevFlow workflow',
      repository: 'your-github-username/your-repo', // TODO: Update this
      linearConfig: {
        triggerStatus: 'To Spec',
        nextStatus: 'Spec Ready',
      },
      githubConfig: {
        owner: 'your-github-username', // TODO: Update this
        defaultBranch: 'main',
      },
      aiConfig: {
        provider: 'openrouter',
        model: 'anthropic/claude-sonnet-4',
      },
    };

    // Create project
    const project = await createProject(projectConfig);

    // Register OAuth apps
    await registerOAuthApps(project.id);

    // Check OAuth connections
    await checkOAuthConnections(project.id);

    // Verify readiness
    const { isReady } = await verifyProjectReadiness(project.id);

    // Display next steps
    displayNextSteps(project.id, isReady);

    console.log('\n' + '='.repeat(60));
    console.log('✨ Test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();
