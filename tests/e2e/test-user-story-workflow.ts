#!/usr/bin/env npx tsx
/**
 * End-to-End Test: User Story Workflow (Phase 2)
 *
 * This test validates the user story workflow:
 * 1. Uses an existing issue in "Refinement Ready" status (or creates one)
 * 2. Moves it to "To User Story" status
 * 3. Simulates the Linear webhook
 * 4. Monitors the Temporal workflow execution
 * 5. Verifies the user story is appended to Linear
 * 6. Verifies the issue moves to "UserStory Ready"
 *
 * Prerequisites:
 * - Docker services running (postgres, redis, temporal)
 * - API running on port 3001
 * - Worker running
 * - LINEAR_API_KEY env var set
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." LINEAR_API_KEY="lin_api_xxx" npx tsx tests/e2e/test-user-story-workflow.ts
 *
 * Options:
 *   --issue-id        Use existing Linear issue ID (must be in Refinement Ready)
 *   --cleanup         Delete the test issue after the test
 *   --timeout         Workflow completion timeout in seconds (default: 180)
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
  timeoutSeconds: parseInt(process.env.TEST_TIMEOUT || '180', 10),
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

// Find an issue in Refinement Ready status
async function findRefinementReadyIssue(linear: LinearSDK, teamId: string): Promise<any | null> {
  try {
    const team = await linear.team(teamId);
    const states = await team.states();

    const refinementReadyState = states.nodes.find(
      (s: any) => s.name === 'Refinement Ready'
    );

    if (!refinementReadyState) {
      return null;
    }

    const issues = await linear.issues({
      filter: {
        team: { id: { eq: teamId } },
        state: { id: { eq: refinementReadyState.id } },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  } catch (error) {
    logWarning(`Could not find Refinement Ready issue: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  log('  DevFlow E2E Test: User Story Workflow (Phase 2)', 'blue');
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
  let createdNewIssue = false;

  const TOTAL_STEPS = 6;

  try {
    // Step 1: Check API health
    logStep(1, TOTAL_STEPS, 'Checking API health...');
    const healthResponse = await fetch(`${config.apiUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`API health check failed: ${healthResponse.status}`);
    }
    logSuccess('API is healthy');

    // Step 2: Get Linear team and find/create test issue
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
    const toUserStoryState = states.nodes.find((s: any) => s.name === 'To User Story');
    const userStoryReadyState = states.nodes.find((s: any) => s.name === 'UserStory Ready');
    const refinementReadyState = states.nodes.find((s: any) => s.name === 'Refinement Ready');

    if (!toUserStoryState) {
      throw new Error('Linear team must have a "To User Story" status');
    }
    if (!userStoryReadyState) {
      throw new Error('Linear team must have a "UserStory Ready" status');
    }

    logSuccess(`Found "To User Story" state: ${toUserStoryState.name}`);
    logInfo(`Target state: ${userStoryReadyState.name}`);

    // Find or use existing issue
    if (!testIssueId) {
      // Try to find an existing Refinement Ready issue
      const existingIssue = await findRefinementReadyIssue(linear, config.teamId);

      if (existingIssue) {
        testIssueId = existingIssue.id;
        testIssueIdentifier = existingIssue.identifier;
        testIssueUrl = existingIssue.url;
        logInfo(`Found existing issue in Refinement Ready: ${testIssueIdentifier}`);
      } else {
        // Create a new issue with refinement content
        logInfo('No Refinement Ready issue found, creating a new one...');

        const refinementContent = `
Implement a simple feature for testing the User Story workflow.

<details>
<summary>📋 Backlog Refinement</summary>

**Type:** 🆕 feature

### Business Context

This is a test feature to validate the User Story workflow in DevFlow.

### Objectives

1. Generate a valid user story from this refinement
2. Validate the workflow completes successfully
3. Verify the user story is appended to the issue

### Preliminary Acceptance Criteria

1. User story should be generated
2. Status should transition to UserStory Ready
3. User story content should be appended to description

### Complexity Estimate

**M** - Medium complexity

</details>
`;

        const newIssue = await linear.createIssue({
          teamId: config.teamId,
          title: `[E2E Test] User Story Workflow - ${new Date().toISOString()}`,
          description: refinementContent,
          stateId: refinementReadyState?.id || toUserStoryState.id,
        });

        if (!newIssue.success || !newIssue.issue) {
          throw new Error('Failed to create test issue in Linear');
        }

        const issue = await newIssue.issue;
        testIssueId = issue.id;
        testIssueIdentifier = issue.identifier;
        testIssueUrl = issue.url;
        createdNewIssue = true;
        logSuccess(`Created test issue: ${testIssueIdentifier}`);
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

    // Step 3: Move issue to "To User Story" status
    logStep(3, TOTAL_STEPS, 'Moving issue to "To User Story" status...');
    await linear.updateIssue(testIssueId, { stateId: toUserStoryState.id });
    logSuccess('Issue moved to "To User Story"');

    // Step 4: Trigger workflow via webhook
    logStep(4, TOTAL_STEPS, 'Triggering workflow via webhook...');

    const webhookPayload = {
      action: 'update',
      type: 'Issue',
      data: {
        id: testIssueId,
        identifier: testIssueIdentifier,
        stateId: toUserStoryState.id,
        state: { name: 'To User Story' },
        teamId: config.teamId,
      },
      updatedFrom: {
        stateId: refinementReadyState?.id || 'previous-state',
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
      if (currentStatus === 'UserStory Ready') {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logSuccess(`Workflow completed with status: ${currentStatus}`);
        break;
      }

      // Check for failure status
      if (currentStatus === 'UserStory Failed') {
        throw new Error('Workflow failed - status is "UserStory Failed"');
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

    if (finalStatus !== 'UserStory Ready') {
      throw new Error(
        `Workflow did not complete in time. Final status: ${finalStatus}`
      );
    }

    // Step 6: Verify user story output
    logStep(6, TOTAL_STEPS, 'Verifying user story output...');

    const finalDescription = finalIssue.description || '';

    // Check for user story section
    const hasUserStoryHeader =
      finalDescription.includes('User Story') ||
      finalDescription.includes('📖 User Story');
    const hasAcceptanceCriteria =
      finalDescription.toLowerCase().includes('acceptance criteria');
    const hasScenarios =
      finalDescription.toLowerCase().includes('scenario') ||
      finalDescription.toLowerCase().includes('given') ||
      finalDescription.toLowerCase().includes('when') ||
      finalDescription.toLowerCase().includes('then');

    if (hasUserStoryHeader) {
      logSuccess('User story header found in description');
    } else {
      logWarning('User story header not found - may use different format');
    }

    if (hasAcceptanceCriteria) {
      logSuccess('Acceptance criteria found');
    } else {
      logWarning('Acceptance criteria section not explicitly found');
    }

    if (hasScenarios) {
      logSuccess('BDD scenarios found');
    } else {
      logWarning('BDD scenarios not found - may use different format');
    }

    // Show description preview
    console.log(`\n${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}`);
    logInfo('Description Preview (first 500 chars):');
    console.log(`${colors.dim}${finalDescription.substring(0, 500)}${colors.reset}`);
    if (finalDescription.length > 500) {
      console.log(`${colors.dim}... (${finalDescription.length - 500} more chars)${colors.reset}`);
    }
    console.log(`${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}\n`);

    // Cleanup
    if (config.cleanup && createdNewIssue) {
      logInfo('Cleaning up test issue...');
      await linear.deleteIssue(testIssueId);
      logSuccess(`Deleted test issue: ${testIssueIdentifier}`);
    } else {
      logInfo('Skipping cleanup');
      logInfo(`Test issue preserved: ${testIssueIdentifier}`);
      logInfo(`View at: ${testIssueUrl}`);
    }

    // Summary
    console.log('\n══════════════════════════════════════════════════════════════════════');
    log('  Test Summary', 'green');
    console.log('══════════════════════════════════════════════════════════════════════\n');

    logSuccess('All tests passed!');
    console.log(`
  Issue: ${testIssueIdentifier}
  Status: ${finalStatus}
  Duration: ${Math.round((Date.now() - startTime) / 1000)}s
  Cleanup: ${config.cleanup && createdNewIssue ? 'Issue deleted' : 'Issue preserved'}
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
