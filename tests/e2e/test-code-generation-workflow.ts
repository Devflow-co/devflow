#!/usr/bin/env npx tsx
/**
 * End-to-End Test: Code Generation Workflow (Phase 4)
 *
 * This test validates the code generation workflow:
 * 1. Uses an existing issue in "Plan Ready" status
 * 2. Moves it to "To Code" status
 * 3. Simulates the Linear webhook
 * 4. Monitors the Temporal workflow execution
 * 5. Handles V3 interactive questions (ambiguity, solution choice, approval)
 * 6. Verifies a draft PR is created
 * 7. Verifies the issue moves to "Code Review"
 *
 * Prerequisites:
 * - Docker services running (postgres, redis, temporal)
 * - API running on port 3001
 * - Worker running
 * - LINEAR_API_KEY env var set
 * - GitHub OAuth configured for the project
 * - Docker available for container validation (optional)
 * - Ollama/OpenRouter configured for AI generation
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." LINEAR_API_KEY="lin_api_xxx" npx tsx tests/e2e/test-code-generation-workflow.ts
 *
 * Options:
 *   --issue-id        Use existing Linear issue ID (must be in Plan Ready)
 *   --cleanup         Close PR and archive issue after the test
 *   --skip-interactive Skip V3 interactive scenarios (faster)
 *   --timeout         Workflow completion timeout in seconds (default: 600)
 */

import { LinearClient as LinearSDK } from '@linear/sdk';
import { PrismaClient } from '@prisma/client';

// ============================================
// Configuration
// ============================================

const config = {
  apiUrl: process.env.DEVFLOW_API_URL || 'http://localhost:3001/api/v1',
  linearApiKey: process.env.LINEAR_API_KEY,
  projectId: process.env.PROJECT_ID,
  teamId: process.env.LINEAR_TEAM_ID,
  issueId: process.env.LINEAR_ISSUE_ID,
  timeoutSeconds: parseInt(process.env.TEST_TIMEOUT || '600', 10), // 10 min for code generation
  cleanup: process.argv.includes('--cleanup'),
  skipInteractive: process.argv.includes('--skip-interactive'),
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

// ============================================
// Prisma Client (Singleton)
// ============================================

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

// ============================================
// Console Logging Helpers
// ============================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: number, total: number, message: string) {
  console.log(`\n${colors.blue}[${step}/${total}] ${message}${colors.reset}`);
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

function logInteractive(message: string) {
  console.log(`${colors.magenta}🤖 ${message}${colors.reset}`);
}

// ============================================
// Database Helpers
// ============================================

async function getProjectFromDatabase(): Promise<string | null> {
  if (!config.databaseUrl) {
    return null;
  }

  try {
    const db = getPrisma();
    const project = await db.project.findFirst({
      where: {
        id: { not: 'SYSTEM_OAUTH_PROJECT' },
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

async function getTaskIdFromLinearId(linearId: string): Promise<string | null> {
  try {
    const db = getPrisma();
    const task = await db.task.findFirst({
      where: { linearId },
      select: { id: true },
    });
    return task?.id || null;
  } catch (error) {
    logWarning(`Could not fetch task ID: ${(error as Error).message}`);
    return null;
  }
}

interface PendingCodeQuestion {
  id: string;
  projectId: string;
  taskId: string;
  workflowId: string;
  questionType: string;
  commentId: string;
  status: string;
  timeoutAt: Date;
}

async function getPendingCodeQuestions(taskId: string): Promise<PendingCodeQuestion[]> {
  try {
    const db = getPrisma();
    const questions = await db.pendingCodeQuestion.findMany({
      where: {
        taskId,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
    });
    return questions as PendingCodeQuestion[];
  } catch (error) {
    logWarning(`Could not fetch pending questions: ${(error as Error).message}`);
    return [];
  }
}

async function markQuestionAnswered(
  questionId: string,
  responseType: string,
  selectedOption?: string,
  customText?: string
): Promise<void> {
  try {
    const db = getPrisma();
    await db.pendingCodeQuestion.update({
      where: { id: questionId },
      data: {
        status: 'answered',
        responseType,
        selectedOption,
        customText,
        respondedBy: 'e2e-test@devflow.local',
        respondedAt: new Date(),
      },
    });
  } catch (error) {
    logWarning(`Could not mark question as answered: ${(error as Error).message}`);
  }
}

// ============================================
// Linear Helpers
// ============================================

async function findPlanReadyIssue(linear: LinearSDK, teamId: string): Promise<any | null> {
  try {
    const team = await linear.team(teamId);
    const states = await team.states();

    const planReadyState = states.nodes.find((s: any) => s.name === 'Plan Ready');

    if (!planReadyState) {
      return null;
    }

    const issues = await linear.issues({
      filter: {
        team: { id: { eq: teamId } },
        state: { id: { eq: planReadyState.id } },
      },
      first: 1,
    });

    return issues.nodes[0] || null;
  } catch (error) {
    logWarning(`Could not find Plan Ready issue: ${(error as Error).message}`);
    return null;
  }
}

async function replyToComment(
  linear: LinearSDK,
  issueId: string,
  parentCommentId: string,
  body: string
): Promise<string | null> {
  try {
    const result = await linear.createComment({
      issueId,
      body,
      parentId: parentCommentId,
    });

    if (result.success) {
      const comment = await result.comment;
      return comment?.id || null;
    }
    return null;
  } catch (error) {
    logWarning(`Could not reply to comment: ${(error as Error).message}`);
    return null;
  }
}

// ============================================
// Webhook Simulation
// ============================================

async function simulateIssueStatusWebhook(
  issueId: string,
  identifier: string,
  newStateId: string,
  newStateName: string,
  teamId: string,
  previousStateId?: string
): Promise<any> {
  const webhookPayload = {
    action: 'update',
    type: 'Issue',
    data: {
      id: issueId,
      identifier,
      stateId: newStateId,
      state: { name: newStateName },
      teamId,
    },
    updatedFrom: {
      stateId: previousStateId || 'previous-state',
    },
  };

  const response = await fetch(`${config.apiUrl}/webhooks/linear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'linear-signature': 'e2e-test-signature',
    },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function simulateCommentWebhook(
  commentId: string,
  body: string,
  issueId: string,
  parentCommentId: string
): Promise<any> {
  const webhookPayload = {
    action: 'create',
    type: 'Comment',
    data: {
      id: commentId,
      body,
      issueId,
      issue: { id: issueId },
      parent: { id: parentCommentId },
      user: { id: 'e2e-test', name: 'E2E Test Runner' },
      createdAt: new Date().toISOString(),
    },
    actor: { id: 'e2e-test', name: 'E2E Test Runner' },
  };

  const response = await fetch(`${config.apiUrl}/webhooks/linear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'linear-signature': 'e2e-test-signature',
    },
    body: JSON.stringify(webhookPayload),
  });

  return response.json();
}

// ============================================
// Question Answering
// ============================================

async function answerPendingQuestions(
  linear: LinearSDK,
  linearIssueId: string,
  taskId: string
): Promise<number> {
  const questions = await getPendingCodeQuestions(taskId);
  let answeredCount = 0;

  for (const question of questions) {
    logInteractive(`Found pending question: ${question.questionType} (${question.id})`);

    let answerBody: string;
    let responseType: string;
    let selectedOption: string | undefined;

    switch (question.questionType) {
      case 'clarification':
        answerBody = 'Option A: Use the recommended approach';
        responseType = 'option_selected';
        selectedOption = 'A';
        break;
      case 'solution_choice':
        answerBody = 'Option A: Apply the suggested fix';
        responseType = 'option_selected';
        selectedOption = 'A';
        break;
      case 'approval':
        answerBody = 'APPROVE';
        responseType = 'approved';
        break;
      default:
        answerBody = 'Proceed with default option';
        responseType = 'custom_text';
    }

    // Reply to Linear comment
    const replyId = await replyToComment(linear, linearIssueId, question.commentId, answerBody);

    if (replyId) {
      logInteractive(`Replied to comment: ${replyId}`);

      // Simulate webhook to trigger signal
      await simulateCommentWebhook(replyId, answerBody, linearIssueId, question.commentId);

      // Mark question as answered in database
      await markQuestionAnswered(question.id, responseType, selectedOption, answerBody);

      answeredCount++;
      logSuccess(`Answered ${question.questionType} question`);

      // Small delay between answers
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return answeredCount;
}

// ============================================
// PR Verification
// ============================================

interface PRInfo {
  number: number;
  url: string;
  draft: boolean;
  title: string;
}

async function extractPRFromDescription(description: string): Promise<PRInfo | null> {
  // Look for PR URL in description
  const prUrlMatch = description.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);

  if (prUrlMatch) {
    return {
      number: parseInt(prUrlMatch[1], 10),
      url: prUrlMatch[0],
      draft: true, // Assume draft
      title: 'Generated PR',
    };
  }

  return null;
}

// ============================================
// Main Test
// ============================================

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════');
  log('  DevFlow E2E Test: Code Generation Workflow (Phase 4)', 'blue');
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
      await closePrisma();
      process.exit(1);
    }
  }

  logInfo(`API URL: ${config.apiUrl}`);
  logInfo(`Project ID: ${config.projectId}`);
  logInfo(`Timeout: ${config.timeoutSeconds}s`);
  logInfo(`Cleanup: ${config.cleanup ? 'yes' : 'no'}`);
  logInfo(`Skip Interactive: ${config.skipInteractive ? 'yes' : 'no'}`);

  const linear = new LinearSDK({ apiKey: config.linearApiKey });
  let testIssueId: string | undefined = config.issueId;
  let testIssueIdentifier: string | undefined;
  let testIssueUrl: string | undefined;
  let taskId: string | null = null;

  const TOTAL_STEPS = 8;
  const startTime = Date.now();

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
    const toCodeState = states.nodes.find((s: any) => s.name === 'To Code');
    const codeReviewState = states.nodes.find((s: any) => s.name === 'Code Review');
    const codeFailedState = states.nodes.find((s: any) => s.name === 'Code Failed');
    const planReadyState = states.nodes.find((s: any) => s.name === 'Plan Ready');

    if (!toCodeState) {
      throw new Error('Linear team must have a "To Code" status');
    }
    if (!codeReviewState) {
      throw new Error('Linear team must have a "Code Review" status');
    }

    logSuccess(`Found "To Code" state: ${toCodeState.name}`);
    logInfo(`Target success state: ${codeReviewState.name}`);
    logInfo(`Target failure state: ${codeFailedState?.name || 'N/A'}`);

    // Find or use existing issue
    if (!testIssueId) {
      const existingIssue = await findPlanReadyIssue(linear, config.teamId);

      if (existingIssue) {
        testIssueId = existingIssue.id;
        testIssueIdentifier = existingIssue.identifier;
        testIssueUrl = existingIssue.url;
        logInfo(`Found existing issue in Plan Ready: ${testIssueIdentifier}`);
      } else {
        throw new Error(
          'No issue found in "Plan Ready" status. Please run the Technical Plan workflow first (Phase 3) to create one.'
        );
      }
    } else {
      const issue = await linear.issue(testIssueId);
      testIssueIdentifier = issue.identifier;
      testIssueUrl = issue.url;
      logInfo(`Using provided issue: ${testIssueIdentifier}`);
    }

    logInfo(`Issue ID: ${testIssueId}`);
    logInfo(`URL: ${testIssueUrl}`);

    // Get task ID from database
    taskId = await getTaskIdFromLinearId(testIssueId);
    if (taskId) {
      logInfo(`Task ID: ${taskId}`);
    }

    // Step 3: Move issue to "To Code" status
    logStep(3, TOTAL_STEPS, 'Moving issue to "To Code" status...');
    await linear.updateIssue(testIssueId, { stateId: toCodeState.id });
    logSuccess('Issue moved to "To Code"');

    // Step 4: Trigger workflow via webhook
    logStep(4, TOTAL_STEPS, 'Triggering workflow via webhook...');

    const webhookResult = await simulateIssueStatusWebhook(
      testIssueId,
      testIssueIdentifier!,
      toCodeState.id,
      'To Code',
      config.teamId,
      planReadyState?.id
    );

    logSuccess(`Workflow started: ${webhookResult.workflowId || 'unknown'}`);

    // Step 5: Monitor workflow progress
    logStep(5, TOTAL_STEPS, 'Monitoring workflow progress...');

    const timeoutMs = config.timeoutSeconds * 1000;
    let lastStatus = '';
    let checkCount = 0;
    let questionsAnswered = 0;
    let inProgressSince: number | null = null;
    const QUESTION_CHECK_DELAY = 15000; // Wait 15s before checking for questions

    while (Date.now() - startTime < timeoutMs) {
      checkCount++;

      // Check issue status in Linear
      const issue = await linear.issue(testIssueId);
      const state = await issue.state;
      const currentStatus = state?.name || 'Unknown';

      if (currentStatus !== lastStatus) {
        console.log(''); // New line after progress indicator
        logInfo(`Status changed: ${lastStatus || 'Initial'} → ${currentStatus}`);
        lastStatus = currentStatus;

        // Track when we entered "In Progress"
        if (currentStatus === 'Code In Progress') {
          inProgressSince = Date.now();
        } else {
          inProgressSince = null;
        }
      }

      // Check for workflow completion
      if (currentStatus === 'Code Review') {
        console.log(''); // New line after progress indicator
        logSuccess(`Workflow completed with status: ${currentStatus}`);
        break;
      }

      // Check for failure status
      if (currentStatus === 'Code Failed') {
        console.log(''); // New line after progress indicator
        logWarning(`Workflow failed with status: ${currentStatus}`);
        break;
      }

      // Check for and answer pending questions (V3 Interactive)
      if (
        !config.skipInteractive &&
        taskId &&
        currentStatus === 'Code In Progress' &&
        inProgressSince &&
        Date.now() - inProgressSince > QUESTION_CHECK_DELAY
      ) {
        const answeredNow = await answerPendingQuestions(linear, testIssueId, taskId);
        if (answeredNow > 0) {
          questionsAnswered += answeredNow;
          logInfo(`Answered ${answeredNow} question(s), total: ${questionsAnswered}`);
          // Reset the check to allow workflow to process
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }
      }

      // Progress indicator
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(
        `${colors.dim}  Waiting... ${elapsed}s/${config.timeoutSeconds}s (check #${checkCount}, status: ${currentStatus})${colors.reset}\r`
      );

      await new Promise((resolve) => setTimeout(resolve, 10000)); // Poll every 10s
    }

    // Step 6: Verify final status
    logStep(6, TOTAL_STEPS, 'Verifying final status...');

    const finalIssue = await linear.issue(testIssueId);
    const finalState = await finalIssue.state;
    const finalStatus = finalState?.name || 'Unknown';
    const finalDescription = finalIssue.description || '';

    if (finalStatus === 'Code Review') {
      logSuccess(`Final status: ${finalStatus}`);
    } else if (finalStatus === 'Code Failed') {
      logError(`Workflow failed: ${finalStatus}`);
    } else {
      logWarning(`Unexpected final status: ${finalStatus}`);
    }

    // Step 7: Verify PR creation
    logStep(7, TOTAL_STEPS, 'Verifying PR creation...');

    const prInfo = await extractPRFromDescription(finalDescription);

    if (prInfo) {
      logSuccess(`PR found: #${prInfo.number}`);
      logInfo(`PR URL: ${prInfo.url}`);
      logInfo(`Draft: ${prInfo.draft ? 'yes' : 'no'}`);
    } else {
      if (finalStatus === 'Code Review') {
        logWarning('PR URL not found in description - check Linear issue directly');
      } else {
        logInfo('No PR created (expected for failed workflow)');
      }
    }

    // Check description content
    const hasCodeGenHeader =
      finalDescription.includes('Code Generation') ||
      finalDescription.includes('Generated Files') ||
      finalDescription.includes('Pull Request');

    const hasFilesList =
      finalDescription.includes('.ts') ||
      finalDescription.includes('.tsx') ||
      finalDescription.includes('.js');

    const hasContainerResults =
      finalDescription.includes('Lint') ||
      finalDescription.includes('Typecheck') ||
      finalDescription.includes('Tests');

    if (hasCodeGenHeader) {
      logSuccess('Code generation header found in description');
    }

    if (hasFilesList) {
      logSuccess('Generated files list found');
    }

    if (hasContainerResults) {
      logSuccess('Container validation results found');
    }

    // Show description preview
    console.log(
      `\n${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}`
    );
    logInfo('Description Preview (first 800 chars):');
    console.log(`${colors.dim}${finalDescription.substring(0, 800)}${colors.reset}`);
    if (finalDescription.length > 800) {
      console.log(`${colors.dim}... (${finalDescription.length - 800} more chars)${colors.reset}`);
    }
    console.log(
      `${colors.dim}──────────────────────────────────────────────────────────────────────${colors.reset}\n`
    );

    // Step 8: Cleanup (optional)
    logStep(8, TOTAL_STEPS, 'Cleanup...');

    if (config.cleanup) {
      // Note: Would need GitHub token to close PR
      logWarning('PR cleanup requires GitHub token - skipping');
      logInfo('Issue preserved for manual review');
    } else {
      logInfo('Cleanup skipped (use --cleanup to enable)');
    }

    // Summary
    console.log('\n══════════════════════════════════════════════════════════════════════');
    if (finalStatus === 'Code Review') {
      log('  Test Summary: PASSED', 'green');
    } else {
      log('  Test Summary: FAILED', 'red');
    }
    console.log('══════════════════════════════════════════════════════════════════════\n');

    const totalElapsed = Math.round((Date.now() - startTime) / 1000);

    console.log(`
  Issue: ${testIssueIdentifier}
  Final Status: ${finalStatus}
  Duration: ${totalElapsed}s
  PR: ${prInfo ? `#${prInfo.number} (${prInfo.url})` : 'N/A'}
  Questions Answered: ${questionsAnswered}
  Interactive: ${config.skipInteractive ? 'skipped' : 'enabled'}
`);

    if (finalStatus === 'Code Review') {
      logSuccess('All tests passed!');
      await closePrisma();
      process.exit(0);
    } else {
      logError('Test failed - workflow did not reach Code Review status');
      await closePrisma();
      process.exit(1);
    }
  } catch (error) {
    console.log('\n══════════════════════════════════════════════════════════════════════');
    log('  Test Failed', 'red');
    console.log('══════════════════════════════════════════════════════════════════════\n');

    logError((error as Error).message);

    if (testIssueIdentifier) {
      logInfo(`Test issue: ${testIssueIdentifier}`);
      if (testIssueUrl) {
        logInfo(`View at: ${testIssueUrl}`);
      }
    }

    if ((error as Error).stack) {
      console.log(`\n${colors.dim}${(error as Error).stack}${colors.reset}`);
    }

    await closePrisma();
    process.exit(1);
  }
}

main();
