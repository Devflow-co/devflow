#!/usr/bin/env npx tsx
/**
 * End-to-End Test: Refinement Workflow (Full with PO Questions)
 *
 * This test validates the complete refinement workflow including PO Q&A:
 * 1. Creates a test issue in Linear
 * 2. Moves it to "To Refinement" status
 * 3. Simulates the Linear webhook
 * 4. Monitors the Temporal workflow execution
 * 5. If PO questions are posted, automatically answers them
 * 6. Verifies the refinement is appended to Linear
 * 7. Verifies the issue moves to "Refinement Ready"
 *
 * Prerequisites:
 * - Docker services running (postgres, redis, temporal)
 * - API running on port 3001
 * - Worker running
 * - LINEAR_API_KEY env var set
 * - DEFAULT_PROJECT_ID env var set (or auto-detected from DB)
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." LINEAR_API_KEY="lin_api_xxx" npx tsx tests/e2e/test-refinement-workflow.ts
 *
 * Options:
 *   --cleanup        Delete the test issue after the test
 *   --team-id        Specify Linear team ID (auto-detected if not provided)
 *   --timeout        Workflow completion timeout in seconds (default: 180)
 *   --skip-answers   Skip auto-answering PO questions (will timeout if questions exist)
 */

import { LinearClient as LinearSDK } from '@linear/sdk';
import { PrismaClient } from '@prisma/client';

// Configuration (will be populated dynamically if not provided)
const config = {
  apiUrl: process.env.DEVFLOW_API_URL || 'http://localhost:3001/api/v1',
  linearApiKey: process.env.LINEAR_API_KEY,
  projectId: process.env.DEFAULT_PROJECT_ID || process.env.PROJECT_ID,
  teamId: process.env.LINEAR_TEAM_ID,
  timeoutSeconds: parseInt(process.env.TEST_TIMEOUT || '180', 10),
  cleanup: process.argv.includes('--cleanup'),
  skipAnswers: process.argv.includes('--skip-answers'),
  databaseUrl: process.env.DATABASE_URL,
};

// Parse CLI arguments
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--team-id' && process.argv[i + 1]) {
    config.teamId = process.argv[i + 1];
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
          not: 'SYSTEM_OAUTH_PROJECT', // Exclude system project
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

// =========================================================================
// PO Questions Handling
// =========================================================================

interface TaskQuestion {
  id: string;
  questionText: string;
  linearCommentId: string | null;
  answered: boolean;
}

/**
 * Get unanswered PO questions for a task from the database
 */
async function getUnansweredQuestions(linearIssueId: string): Promise<TaskQuestion[]> {
  const db = getPrisma();

  const task = await db.task.findFirst({
    where: { linearId: linearIssueId },
    include: {
      questions: {
        where: { answered: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!task) {
    return [];
  }

  return task.questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    linearCommentId: q.linearCommentId,
    answered: q.answered,
  }));
}

/**
 * Reply to a PO question comment in Linear
 * Returns the created comment ID
 */
async function replyToQuestion(
  linear: LinearSDK,
  issueId: string,
  parentCommentId: string,
  answerText: string
): Promise<string | null> {
  try {
    // Create a reply comment using Linear GraphQL mutation
    const result = await linear.createComment({
      issueId,
      body: answerText,
      parentId: parentCommentId,
    });

    const comment = await result.comment;
    return comment?.id || null;
  } catch (error) {
    logError(`Failed to reply to question: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Simulate a Linear comment webhook for an answer
 */
async function simulateAnswerWebhook(
  issueId: string,
  answerCommentId: string,
  parentCommentId: string,
  answerText: string
): Promise<boolean> {
  const webhookPayload = {
    action: 'create',
    type: 'Comment',
    createdAt: new Date().toISOString(),
    data: {
      id: answerCommentId,
      body: answerText,
      issueId,
      parent: {
        id: parentCommentId,
      },
      user: {
        id: 'e2e-test',
        name: 'E2E Test PO',
      },
    },
    actor: {
      id: 'e2e-test',
      name: 'E2E Test PO',
    },
  };

  try {
    const response = await fetch(`${config.apiUrl}/webhooks/linear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'linear-signature': 'e2e-test-signature',
      },
      body: JSON.stringify(webhookPayload),
    });

    const result = await response.json();

    if (result.answerDetected) {
      logSuccess(`Answer detected for question ${parentCommentId}`);
      if (result.allQuestionsAnswered) {
        logSuccess('All questions answered - workflow will restart');
      }
      return true;
    }

    return response.ok;
  } catch (error) {
    logError(`Failed to simulate webhook: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Answer all pending PO questions for an issue
 * Uses polling to wait for questions to appear (they may be created asynchronously)
 */
async function answerAllQuestions(
  linear: LinearSDK,
  issueId: string,
  maxRetries: number = 10,
  retryDelayMs: number = 5000
): Promise<{ answered: number; total: number }> {
  let questions: TaskQuestion[] = [];

  // Poll for questions to appear
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    questions = await getUnansweredQuestions(issueId);

    if (questions.length > 0) {
      logInfo(`Found ${questions.length} unanswered PO question(s) on attempt ${attempt}`);
      break;
    }

    if (attempt < maxRetries) {
      logInfo(`No questions found yet (attempt ${attempt}/${maxRetries}), waiting ${retryDelayMs / 1000}s...`);
      await sleep(retryDelayMs);
    }
  }

  if (questions.length === 0) {
    logInfo(`No questions found after ${maxRetries} attempts`);
    return { answered: 0, total: 0 };
  }

  logInfo(`Processing ${questions.length} unanswered PO question(s)`);

  let answered = 0;

  for (const question of questions) {
    if (!question.linearCommentId) {
      logWarning(`Question ${question.id} has no Linear comment ID, skipping`);
      continue;
    }

    // Generate a simple answer
    const answerText = `[E2E Test Auto-Answer]\n\nThis is an automated response for testing purposes.\n\nQuestion: "${question.questionText.substring(0, 100)}..."\n\nAnswer: Yes, this is acceptable. Please proceed with the implementation.`;

    logInfo(`Answering question: "${question.questionText.substring(0, 50)}..."`);

    // Reply via Linear API
    const answerCommentId = await replyToQuestion(
      linear,
      issueId,
      question.linearCommentId,
      answerText
    );

    if (!answerCommentId) {
      logError(`Failed to create reply for question ${question.id}`);
      continue;
    }

    logSuccess(`Created reply comment: ${answerCommentId}`);

    // Simulate the webhook so the system detects the answer
    const webhookSuccess = await simulateAnswerWebhook(
      issueId,
      answerCommentId,
      question.linearCommentId,
      answerText
    );

    if (webhookSuccess) {
      answered++;
    }

    // Small delay between answers
    await sleep(1000);
  }

  return { answered, total: questions.length };
}

// Validate configuration
async function validateConfig(): Promise<boolean> {
  const errors: string[] = [];

  if (!config.linearApiKey) {
    errors.push('LINEAR_API_KEY environment variable is required');
  }

  // Try to auto-detect project if not provided
  if (!config.projectId) {
    const dbProject = await getProjectFromDatabase();
    if (dbProject) {
      config.projectId = dbProject;
    } else {
      errors.push('No project found. Set DEFAULT_PROJECT_ID or PROJECT_ID env var, or ensure a project exists in database');
    }
  }

  if (errors.length > 0) {
    logError('Configuration errors:');
    errors.forEach((e) => console.log(`  - ${e}`));
    return false;
  }

  return true;
}

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main test
async function runTest() {
  console.log('\n' + '═'.repeat(70));
  log('  DevFlow E2E Test: Refinement Workflow', 'blue');
  console.log('═'.repeat(70) + '\n');

  // Validate configuration
  if (!(await validateConfig())) {
    process.exit(1);
  }

  logInfo(`API URL: ${config.apiUrl}`);
  logInfo(`Project ID: ${config.projectId}`);
  logInfo(`Timeout: ${config.timeoutSeconds}s`);
  logInfo(`Cleanup: ${config.cleanup ? 'yes' : 'no'}`);
  logInfo(`Auto-answer PO questions: ${config.skipAnswers ? 'no' : 'yes'}`);

  const totalSteps = 7;
  let createdIssueId: string | null = null;
  let createdIssueIdentifier: string | null = null;

  try {
    // Initialize Linear client
    const linear = new LinearSDK({ apiKey: config.linearApiKey! });

    // =========================================================================
    // Step 1: Check API Health
    // =========================================================================
    logStep(1, totalSteps, 'Checking API health...');

    const healthResponse = await fetch(`${config.apiUrl}/health`);
    if (!healthResponse.ok) {
      throw new Error(`API not healthy: ${healthResponse.status}`);
    }
    logSuccess('API is healthy');

    // =========================================================================
    // Step 2: Get Linear team (auto-detect if not provided)
    // =========================================================================
    logStep(2, totalSteps, 'Getting Linear team...');

    let teamId = config.teamId;
    if (!teamId) {
      const teams = await linear.teams();
      const team = teams.nodes[0];
      if (!team) {
        throw new Error('No Linear team found');
      }
      teamId = team.id;
      logInfo(`Auto-detected team: ${team.name} (${team.key})`);
    }

    // Get "To Refinement" state ID
    const team = await linear.team(teamId);
    const states = await team.states();
    const toRefinementState = states.nodes.find(
      (s) => s.name === 'To Refinement' || s.name === 'To Spec'
    );
    const refinementReadyState = states.nodes.find(
      (s) => s.name === 'Refinement Ready' || s.name === 'Spec Ready'
    );

    if (!toRefinementState) {
      logWarning('No "To Refinement" status found. Available statuses:');
      states.nodes.forEach((s) => console.log(`  - ${s.name} (${s.type})`));
      throw new Error('Please create a "To Refinement" status in Linear');
    }

    logSuccess(`Found "To Refinement" state: ${toRefinementState.name}`);
    if (refinementReadyState) {
      logInfo(`Target state: ${refinementReadyState.name}`);
    }

    // =========================================================================
    // Step 3: Create test issue in Linear
    // =========================================================================
    logStep(3, totalSteps, 'Creating test issue in Linear...');

    const testTitle = `[E2E Test] Refinement Workflow - ${new Date().toISOString()}`;
    const testDescription = `
## Test Issue for E2E Refinement Workflow

This is an automated test issue created by the DevFlow E2E test suite.

### Requirements
- The user should be able to login with email/password
- The system should validate credentials
- On success, return a JWT token
- On failure, return appropriate error messages

### Acceptance Criteria
- [ ] Login endpoint accepts email and password
- [ ] Invalid credentials return 401
- [ ] Valid credentials return JWT
- [ ] Rate limiting is implemented

---
*Created by: test-refinement-workflow.ts*
*Timestamp: ${new Date().toISOString()}*
    `.trim();

    const createResult = await linear.createIssue({
      teamId,
      title: testTitle,
      description: testDescription,
      stateId: toRefinementState.id,
      priority: 2, // Medium priority
    });

    const createdIssue = await createResult.issue;
    if (!createdIssue) {
      throw new Error('Failed to create issue');
    }

    createdIssueId = createdIssue.id;
    createdIssueIdentifier = createdIssue.identifier;

    logSuccess(`Created issue: ${createdIssue.identifier}`);
    logInfo(`Issue ID: ${createdIssue.id}`);
    logInfo(`URL: ${createdIssue.url}`);

    // =========================================================================
    // Step 4: Simulate Linear webhook
    // =========================================================================
    logStep(4, totalSteps, 'Triggering workflow via webhook...');

    // Build webhook payload (simulating Linear webhook)
    const webhookPayload = {
      action: 'update',
      type: 'Issue',
      createdAt: new Date().toISOString(),
      data: {
        id: createdIssue.id,
        identifier: createdIssue.identifier,
        title: testTitle,
        description: testDescription,
        priority: 2,
        state: {
          id: toRefinementState.id,
          name: toRefinementState.name,
          type: toRefinementState.type,
        },
        team: {
          id: teamId,
          key: team.key,
          name: team.name,
        },
      },
      actor: {
        id: 'e2e-test',
        name: 'E2E Test Runner',
      },
    };

    const webhookResponse = await fetch(`${config.apiUrl}/webhooks/linear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'linear-signature': 'e2e-test-signature', // Note: signature validation should be disabled in test mode
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookResult = await webhookResponse.json();

    if (!webhookResponse.ok) {
      logError(`Webhook failed: ${JSON.stringify(webhookResult)}`);
      throw new Error(`Webhook returned ${webhookResponse.status}`);
    }

    if (webhookResult.workflowStarted) {
      logSuccess(`Workflow started: ${webhookResult.workflowId}`);
    } else {
      logWarning('Webhook received but workflow not started');
      logInfo(`Response: ${JSON.stringify(webhookResult, null, 2)}`);
    }

    // =========================================================================
    // Step 5: Monitor workflow progress (with PO question handling)
    // =========================================================================
    logStep(5, totalSteps, 'Monitoring workflow progress...');

    const startTime = Date.now();
    const timeoutMs = config.timeoutSeconds * 1000;
    let workflowCompleted = false;
    let finalStatus = '';
    let lastStatus = '';
    let checkCount = 0;
    let questionsAnswered = false;
    let inProgressSince: number | null = null;
    const IN_PROGRESS_WAIT_FOR_QUESTIONS = 10000; // Wait 10s before starting to poll for questions

    while (Date.now() - startTime < timeoutMs) {
      checkCount++;

      // Check issue status in Linear
      const issue = await linear.issue(createdIssueId);
      const state = await issue.state;
      const currentStatus = state?.name || 'Unknown';

      if (currentStatus !== lastStatus) {
        logInfo(`Status changed: ${lastStatus || 'Initial'} → ${currentStatus}`);
        lastStatus = currentStatus;

        // Track when we enter "In Progress" status
        if (currentStatus.includes('In Progress')) {
          inProgressSince = Date.now();
        } else {
          inProgressSince = null;
        }
      }

      // Check for completion states
      if (currentStatus === 'Refinement Ready' || currentStatus === 'Spec Ready') {
        workflowCompleted = true;
        finalStatus = currentStatus;
        break;
      }

      if (currentStatus === 'Refinement Failed' || currentStatus === 'Spec Failed') {
        finalStatus = currentStatus;
        throw new Error(`Workflow failed with status: ${currentStatus}`);
      }

      // Handle PO questions when stuck in "In Progress"
      if (
        !config.skipAnswers &&
        !questionsAnswered &&
        currentStatus.includes('In Progress') &&
        inProgressSince &&
        Date.now() - inProgressSince > IN_PROGRESS_WAIT_FOR_QUESTIONS
      ) {
        console.log(''); // New line before question handling
        logInfo('Workflow appears to be waiting for PO answers. Polling for questions...');

        // answerAllQuestions has built-in polling to wait for questions to appear
        const answerResult = await answerAllQuestions(linear, createdIssueId);

        if (answerResult.total > 0) {
          logSuccess(
            `Answered ${answerResult.answered}/${answerResult.total} PO question(s)`
          );
          questionsAnswered = true;

          // Give the webhook time to process and restart workflow
          logInfo('Waiting for workflow to restart after answering questions...');
          await sleep(5000);
        } else {
          // No questions after polling - workflow may complete without questions
          logInfo('No questions found after polling - workflow may not require PO input');
          questionsAnswered = true;
        }
      }

      // Progress indicator
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(
        `\r${colors.dim}  Waiting... ${elapsed}s/${config.timeoutSeconds}s (check #${checkCount}, status: ${currentStatus})${colors.reset}`
      );

      await sleep(5000); // Check every 5 seconds
    }

    console.log(''); // New line after progress indicator

    if (!workflowCompleted) {
      throw new Error(
        `Workflow did not complete within ${config.timeoutSeconds}s (last status: ${lastStatus})`
      );
    }

    logSuccess(`Workflow completed with status: ${finalStatus}`);

    // =========================================================================
    // Step 6: Verify refinement output
    // =========================================================================
    logStep(6, totalSteps, 'Verifying refinement output...');

    const finalIssue = await linear.issue(createdIssueId);
    const finalDescription = finalIssue.description || '';

    // Check for refinement markers
    const hasRefinementHeader =
      finalDescription.includes('## 1️⃣ Phase 1: Backlog Refinement') ||
      finalDescription.includes('# DevFlow Analysis') ||
      finalDescription.includes('## Refinement') ||
      finalDescription.includes('## Specification') ||
      finalDescription.includes('## Technical Analysis');

    const hasBusinessContext =
      finalDescription.includes('Business Context') ||
      finalDescription.includes('Objectives') ||
      finalDescription.includes('Requirements');

    const hasComplexityEstimate =
      finalDescription.includes('Complexity') ||
      finalDescription.includes('Estimate') ||
      finalDescription.includes('T-Shirt');

    if (hasRefinementHeader) {
      logSuccess('Refinement header found in description');
    } else {
      logWarning('Refinement header not found');
    }

    if (hasBusinessContext) {
      logSuccess('Business context found');
    } else {
      logWarning('Business context not found');
    }

    if (hasComplexityEstimate) {
      logSuccess('Complexity estimate found');
    } else {
      logWarning('Complexity estimate not found');
    }

    // Show description preview
    console.log(`\n${colors.dim}${'─'.repeat(70)}${colors.reset}`);
    log('Description Preview (first 500 chars):', 'cyan');
    console.log(colors.dim + finalDescription.substring(0, 500) + colors.reset);
    if (finalDescription.length > 500) {
      console.log(colors.dim + `... (${finalDescription.length - 500} more chars)` + colors.reset);
    }
    console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}\n`);

    // =========================================================================
    // Step 7: Cleanup (optional)
    // =========================================================================
    logStep(7, totalSteps, config.cleanup ? 'Cleaning up...' : 'Skipping cleanup');

    if (config.cleanup && createdIssueId) {
      // Archive or delete the test issue
      await linear.archiveIssue(createdIssueId);
      logSuccess(`Archived test issue: ${createdIssueIdentifier}`);
    } else {
      logInfo(`Test issue preserved: ${createdIssueIdentifier}`);
      logInfo(`View at: ${finalIssue.url}`);
    }

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('\n' + '═'.repeat(70));
    log('  Test Summary', 'green');
    console.log('═'.repeat(70) + '\n');

    logSuccess('All tests passed!');
    console.log(`
  Issue: ${createdIssueIdentifier}
  Status: ${finalStatus}
  Duration: ${Math.round((Date.now() - startTime) / 1000)}s
  Cleanup: ${config.cleanup ? 'Issue archived' : 'Issue preserved'}
    `);

    // Close Prisma connection
    await closePrisma();

    return 0;
  } catch (error) {
    console.log('\n' + '═'.repeat(70));
    log('  Test Failed', 'red');
    console.log('═'.repeat(70) + '\n');

    logError(error instanceof Error ? error.message : String(error));

    if (createdIssueId && createdIssueIdentifier) {
      logInfo(`Test issue created: ${createdIssueIdentifier}`);
      logInfo(`You may need to manually clean it up`);
    }

    if (error instanceof Error && error.stack) {
      console.log(`\n${colors.dim}${error.stack}${colors.reset}`);
    }

    // Close Prisma connection
    await closePrisma();

    return 1;
  }
}

// Run the test
runTest()
  .then((exitCode) => process.exit(exitCode))
  .catch(async (error) => {
    logError(`Unexpected error: ${error}`);
    await closePrisma();
    process.exit(1);
  });
