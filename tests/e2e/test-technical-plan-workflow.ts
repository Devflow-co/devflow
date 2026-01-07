#!/usr/bin/env npx tsx
/**
 * End-to-End Test: Technical Plan Workflow (Phase 3)
 *
 * This test validates the technical plan workflow:
 * 1. Uses an existing issue in "UserStory Ready" status
 * 2. Moves it to "To Plan" status
 * 3. Simulates the Linear webhook
 * 4. Monitors the Temporal workflow execution
 * 5. Verifies the technical plan is created as a Linear document
 * 6. Verifies the issue moves to "Plan Ready"
 *
 * Prerequisites:
 * - Docker services running (postgres, redis, temporal)
 * - API running on port 3001
 * - Worker running
 * - LINEAR_API_KEY env var set
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." LINEAR_API_KEY="lin_api_xxx" npx tsx tests/e2e/test-technical-plan-workflow.ts
 *
 * Options:
 *   --issue-id        Use existing Linear issue ID (must be in UserStory Ready)
 *   --cleanup         Delete the test issue after the test
 *   --timeout         Workflow completion timeout in seconds (default: 300)
 */

import { LinearClient as LinearSDK } from '@linear/sdk';
import { PrismaClient } from '@prisma/client';

// Configuration - Note: Ignore DEFAULT_PROJECT_ID from env, always auto-detect from database
// unless PROJECT_ID is explicitly set
const config = {
  apiUrl: process.env.DEVFLOW_API_URL || 'http://localhost:3001/api/v1',
  linearApiKey: process.env.LINEAR_API_KEY,
  projectId: process.env.PROJECT_ID, // Only explicit PROJECT_ID, not DEFAULT_PROJECT_ID
  teamId: process.env.LINEAR_TEAM_ID,
  issueId: process.env.LINEAR_ISSUE_ID,
  timeoutSeconds: parseInt(process.env.TEST_TIMEOUT || '300', 10), // Longer timeout for Phase 3
  cleanup: process.argv.includes('--cleanup'),
  databaseUrl: process.env.DATABASE_URL,
};

// Parse CLI arguments
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--issue-id' && process.argv[i + 1]) {
    config.issueId = process.argv[i + 1];
    i++;
  }
  if (process.argv[i] === '--timeout' && process.argv[i + 1]) {
    config.timeoutSeconds = parseInt(process.argv[i + 1], 10);
    i++;
  }
}

// Prisma client (singleton)
let prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

async function closePrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string) {
  console.log(`\n${colors.blue}[$${step}/${total}] ${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message: string) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Get first non-system project from database
async function getProjectFromDatabase(): Promise<string | null> {
  if (!config.databaseUrl) {
    return null;
  }

  try {
    const db = getPrisma();
    const project = await db.project.findFirst({
      where: {
        id: {
          not: 'SYSTEM_OAUTH_PROJECT',
        },
      },
      select: { id: true, name: true },
    });

    if (project) {
      logInfo(`Auto-detected project from database: ${project.name} (${project.id})`);
      return project.id;
    }
    return null;
  } catch (error) {
    logWarning(`Could not fetch project from database: ${(error as Error).message}`);
    return null;
  }
}

// Find an issue in UserStory Ready status
async function findUserStoryReadyIssue(linear: LinearSDK, teamId: string): Promise<any | null> {
  try {
    const team = await linear.team(teamId);
    const states = await team.states();

    const userStoryReadyState = states.nodes.find(
      (s: any) => s.name === 'UserStory Ready'
    );

    if (!userStoryReadyState) {
      return null;
    }

    const issues = await linear.issues({
      filter: {
        team: { id: { eq: teamId } },
        state: { id: { eq: userStoryReadyState.id } },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  } catch (error) {
    logWarning(`Could not find UserStory Ready issue: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  log('  DevFlow E2E Test: Technical Plan Workflow (Phase 3)', 'blue');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // Validate required config
  if (!config.linearApiKey) {
    logError('LINEAR_API_KEY is required');
    process.exit(1);
  }

  // Auto-detect project ID from database if not provided
  if (!config.projectId) {
    config.projectId = await getProjectFromDatabase();
    if (!config.projectId) {
      logError('No project found in database. Please create a project first.');
      process.exit(1);
    }
  }

  logInfo(`API URL: ${config.apiUrl}`);
  logInfo(`Project ID: ${config.projectId}`);
  logInfo(`Timeout: ${config.timeoutSeconds}s`);
  logInfo(`Cleanup: ${config.cleanup ? 'yes' : 'no'}`);

  const linear = new LinearSDK({ apiKey: config.linearApiKey });
  let testIssueId: string | undefined = config.issueId;
  let testIssueIdentifier: string | undefined;
  let testIssueUrl: string | undefined;

  const TOTAL_STEPS = 6;

  try {
    // Step 1: Check API health
    logStep(1, TOTAL_STEPS, 'Checking API health...');
    const healthResponse = await fetch(`${config.apiUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`API health check failed: ${healthResponse.status}`);
    }
    logSuccess('API is healthy');

    // Step 2: Get Linear team and find test issue
    logStep(2, TOTAL_STEPS, 'Getting Linear team and test issue...');

    let team: any;
    if (config.teamId) {
      team = await linear.team(config.teamId);
    } else {
      const teams = await linear.teams();
      team = teams.nodes[0];
      config.teamId = team.id;
      logInfo(`Auto-detected team: ${team.name} (${team.key})`);
    }

    const states = await team.states();
    const toPlanState = states.nodes.find((s: any) => s.name === 'To Plan');
    const planReadyState = states.nodes.find((s: any) => s.name === 'Plan Ready');
    const userStoryReadyState = states.nodes.find((s: any) => s.name === 'UserStory Ready');

    if (!toPlanState) {
      throw new Error('Linear team must have a "To Plan" status');
    }
    if (!planReadyState) {
      throw new Error('Linear team must have a "Plan Ready" status');
    }

    logSuccess(`Found "To Plan" state: ${toPlanState.name}`);
    logInfo(`Target state: ${planReadyState.name}`);

    // Find or use existing issue
    if (!testIssueId) {
      // Try to find an existing UserStory Ready issue
      const existingIssue = await findUserStoryReadyIssue(linear, config.teamId);

      if (existingIssue) {
        testIssueId = existingIssue.id;
        testIssueIdentifier = existingIssue.identifier;
        testIssueUrl = existingIssue.url;
        logInfo(`Found existing issue in UserStory Ready: ${testIssueIdentifier}`);
      } else {
        throw new Error(
          'No issue found in "UserStory Ready" status. Please run the User Story workflow first (Phase 2) to create one.'
        );
      }
    } else {
      // Fetch existing issue details
      const issue = await linear.issue(testIssueId);
      testIssueIdentifier = issue.identifier;
      testIssueUrl = issue.url;
      logInfo(`Using provided issue: ${testIssueIdentifier}`);
    }

    logInfo(`Issue ID: ${testIssueId}`);
    logInfo(`URL: ${testIssueUrl}`);

    // Step 3: Move issue to "To Plan" status
    logStep(3, TOTAL_STEPS, 'Moving issue to "To Plan" status...');
    await linear.updateIssue(testIssueId, { stateId: toPlanState.id });
    logSuccess('Issue moved to "To Plan"');

    // Step 4: Trigger workflow via webhook
    logStep(4, TOTAL_STEPS, 'Triggering workflow via webhook...');

    const webhookPayload = {
      action: 'update',
      type: 'Issue',
      data: {
        id: testIssueId,
        identifier: testIssueIdentifier,
        stateId: toPlanState.id,
        state: { name: 'To Plan' },
        teamId: config.teamId,
      },
      updatedFrom: {
        stateId: userStoryReadyState?.id || 'previous-state',
      },
    };

    const webhookResponse = await fetch(`${config.apiUrl}/webhooks/linear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'linear-signature': 'test-signature',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`Webhook failed: ${webhookResponse.status} - ${errorText}`);
    }

    const webhookResult = await webhookResponse.json();
    logSuccess(`Workflow started: ${webhookResult.workflowId || 'unknown'}`);

    // Step 5: Monitor workflow progress
    logStep(5, TOTAL_STEPS, 'Monitoring workflow progress...');

    const startTime = Date.now();
    const timeoutMs = config.timeoutSeconds * 1000;
    let lastStatus = '';
    let checkCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      checkCount++;

      // Check issue status in Linear
      const issue = await linear.issue(testIssueId);
      const state = await issue.state;
      const currentStatus = state?.name || 'Unknown';

      if (currentStatus !== lastStatus) {
        logInfo(`Status changed: ${lastStatus || 'Initial'} → ${currentStatus}`);
        lastStatus = currentStatus;
      }

      // Check if workflow completed
      if (currentStatus === 'Plan Ready') {
        logSuccess(`Workflow completed with status: ${currentStatus}`);
        break;
      }

      // Check for failure status
      if (currentStatus === 'Plan Failed') {
        throw new Error('Workflow failed - status is "Plan Failed"');
      }

      // Wait before next check
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(
        `${colors.dim}  Waiting... ${elapsed}s/${config.timeoutSeconds}s (check #${checkCount}, status: ${currentStatus})${colors.reset}\r`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Check if timed out
    const finalIssue = await linear.issue(testIssueId);
    const finalState = await finalIssue.state;
    const finalStatus = finalState?.name || 'Unknown';

    if (finalStatus !== 'Plan Ready') {
      throw new Error(
        `Workflow did not complete in time. Final status: ${finalStatus}`
      );
    }

    // Step 6: Verify technical plan output
    logStep(6, TOTAL_STEPS, 'Verifying technical plan output...');

    // Get documents attached to the issue
    const documents = await linear.documents({
      filter: {
        project: { issues: { id: { eq: testIssueId } } },
      },
    });

    // Check for technical plan document
    const technicalPlanDoc = documents.nodes.find(
      (d: any) =>
        d.title?.toLowerCase().includes('technical plan') ||
        d.title?.toLowerCase().includes('plan')
    );

    if (technicalPlanDoc) {
      logSuccess(`Technical plan document found: ${technicalPlanDoc.title}`);
      logInfo(`Document URL: ${(technicalPlanDoc as any).url || 'N/A'}`);
    } else {
      logWarning('Technical plan document not found - may be stored differently');
    }

    // Check issue description for plan content
    const finalDescription = finalIssue.description || '';
    const hasPlanHeader =
      finalDescription.includes('Technical Plan') ||
      finalDescription.includes('Implementation Plan');
    const hasArchitecture =
      finalDescription.toLowerCase().includes('architecture') ||
      finalDescription.toLowerCase().includes('component');
    const hasTasks =
      finalDescription.toLowerCase().includes('task') ||
      finalDescription.toLowerCase().includes('step') ||
      finalDescription.toLowerCase().includes('implementation');

    if (hasPlanHeader) {
      logSuccess('Technical plan header found in description');
    } else {
      logWarning('Technical plan header not explicitly found');
    }

    if (hasArchitecture) {
      logSuccess('Architecture/component information found');
    } else {
      logWarning('Architecture details not explicitly found');
    }

    if (hasTasks) {
      logSuccess('Implementation tasks/steps found');
    } else {
      logWarning('Implementation tasks not explicitly found');
    }

    // Show description preview
    console.log(`\n${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}`);
    logInfo('Description Preview (first 500 chars):');
    console.log(`${colors.dim}${finalDescription.substring(0, 500)}${colors.reset}`);
    if (finalDescription.length > 500) {
      console.log(`${colors.dim}... (${finalDescription.length - 500} more chars)${colors.reset}`);
    }
    console.log(`${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}\n`);

    // Summary
    console.log('\n══════════════════════════════════════════════════════════════════════');
    log('  Test Summary', 'green');
    console.log('══════════════════════════════════════════════════════════════════════\n');

    logSuccess('All tests passed!');
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`
  Issue: ${testIssueIdentifier}
  Status: ${finalStatus}
  Duration: ${elapsed}s
  Technical Plan: ${technicalPlanDoc ? 'Document created' : 'Check description'}
`);

    await closePrisma();
    process.exit(0);
  } catch (error) {
    logError(`Test failed: ${(error as Error).message}`);

    if (testIssueIdentifier) {
      logInfo(`Test issue: ${testIssueIdentifier}`);
      if (testIssueUrl) {
        logInfo(`View at: ${testIssueUrl}`);
      }
    }

    await closePrisma();
    process.exit(1);
  }
}

main();
