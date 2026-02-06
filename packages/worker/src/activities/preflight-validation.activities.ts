/**
 * Pre-flight Validation Activities - Phase 4 Production Readiness
 *
 * Validates prerequisites before starting code generation workflow:
 * - Ollama health and model availability
 * - GitHub OAuth token validity
 * - Linear OAuth token validity
 * - Repository access permissions
 */

import { createLogger } from '@devflow/common';
import axios from 'axios';
import { oauthResolver } from '@/services/oauth-context';
import { getProjectRepositoryConfig } from '@/activities/codebase.activities';
import { GitHubProvider } from '@devflow/sdk';

const logger = createLogger('PreflightValidation');

// ============================================
// Types
// ============================================

export interface ValidatePrerequisitesInput {
  /** Project ID */
  projectId: string;
  /** Task ID (for logging) */
  taskId: string;
  /** Skip individual checks (for testing) */
  skip?: {
    ollama?: boolean;
    github?: boolean;
    linear?: boolean;
    repoAccess?: boolean;
  };
}

export interface ValidationCheck {
  /** Check name */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Duration of the check in ms */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

export interface ValidatePrerequisitesOutput {
  /** Overall validation result */
  success: boolean;
  /** Individual check results */
  checks: ValidationCheck[];
  /** Total validation duration in ms */
  totalDurationMs: number;
  /** Summary of failures */
  failureSummary?: string;
}

// ============================================
// Main Activity
// ============================================

/**
 * Validate all prerequisites before code generation
 *
 * This activity should be called at the start of the code generation workflow
 * to fail fast if any required service is unavailable.
 */
export async function validatePrerequisites(
  input: ValidatePrerequisitesInput
): Promise<ValidatePrerequisitesOutput> {
  logger.info('Starting pre-flight validation', {
    projectId: input.projectId,
    taskId: input.taskId,
  });

  const startTime = Date.now();
  const checks: ValidationCheck[] = [];

  // Check 1: Ollama health
  if (!input.skip?.ollama) {
    checks.push(await checkOllamaHealth());
  }

  // Check 2: GitHub OAuth token
  if (!input.skip?.github) {
    checks.push(await checkGitHubToken(input.projectId));
  }

  // Check 3: Linear OAuth token
  if (!input.skip?.linear) {
    checks.push(await checkLinearToken(input.projectId));
  }

  // Check 4: Repository access
  if (!input.skip?.repoAccess) {
    checks.push(await checkRepositoryAccess(input.projectId));
  }

  const totalDurationMs = Date.now() - startTime;
  const failedChecks = checks.filter(c => !c.passed);
  const success = failedChecks.length === 0;

  const result: ValidatePrerequisitesOutput = {
    success,
    checks,
    totalDurationMs,
  };

  if (!success) {
    result.failureSummary = failedChecks
      .map(c => `${c.name}: ${c.error}`)
      .join('; ');

    logger.error(
      'Pre-flight validation failed',
      new Error(result.failureSummary),
      {
        projectId: input.projectId,
        taskId: input.taskId,
        failedChecks: failedChecks.map(c => c.name),
      }
    );
  } else {
    logger.info('Pre-flight validation passed', {
      projectId: input.projectId,
      taskId: input.taskId,
      totalDurationMs,
      checksRun: checks.length,
    });
  }

  return result;
}

// ============================================
// Individual Checks
// ============================================

/**
 * Check Ollama health and model availability
 */
async function checkOllamaHealth(): Promise<ValidationCheck> {
  const startTime = Date.now();
  const checkName = 'Ollama Health';

  try {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_CODE_MODEL || 'deepseek-coder:6.7b';

    // Check Ollama is reachable
    const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 10000 });

    if (response.status !== 200) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: `Ollama returned status ${response.status}`,
      };
    }

    // Check model is available
    const models = response.data.models || [];
    const modelBase = model.split(':')[0];
    const modelAvailable = models.some((m: any) => m.name.startsWith(modelBase));

    if (!modelAvailable) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: `Model ${model} not found. Run: ollama pull ${model}`,
        details: {
          availableModels: models.map((m: any) => m.name).slice(0, 5),
          requestedModel: model,
        },
      };
    }

    return {
      name: checkName,
      passed: true,
      durationMs: Date.now() - startTime,
      details: {
        baseUrl,
        model,
        modelsAvailable: models.length,
      },
    };
  } catch (error) {
    return {
      name: checkName,
      passed: false,
      durationMs: Date.now() - startTime,
      error: `Ollama not reachable: ${(error as Error).message}`,
    };
  }
}

/**
 * Check GitHub OAuth token is valid
 */
async function checkGitHubToken(projectId: string): Promise<ValidationCheck> {
  const startTime = Date.now();
  const checkName = 'GitHub OAuth';

  try {
    const token = await oauthResolver.resolveGitHubToken(projectId);

    // Verify token by making a simple API call
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    });

    if (response.status !== 200) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: `GitHub API returned status ${response.status}`,
      };
    }

    return {
      name: checkName,
      passed: true,
      durationMs: Date.now() - startTime,
      details: {
        username: response.data.login,
        scopes: response.headers['x-oauth-scopes'],
      },
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Check for specific error types
    if (errorMessage.includes('No GitHub')) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: 'No GitHub App installation found. Please install the DevFlow GitHub App.',
      };
    }

    return {
      name: checkName,
      passed: false,
      durationMs: Date.now() - startTime,
      error: `GitHub token validation failed: ${errorMessage}`,
    };
  }
}

/**
 * Check Linear OAuth token is valid
 */
async function checkLinearToken(projectId: string): Promise<ValidationCheck> {
  const startTime = Date.now();
  const checkName = 'Linear OAuth';

  try {
    const token = await oauthResolver.resolveLinearToken(projectId);

    // Verify token by making a simple API call
    const response = await axios.post(
      'https://api.linear.app/graphql',
      { query: '{ viewer { id name } }' },
      {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.status !== 200 || response.data.errors) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: response.data.errors?.[0]?.message || 'Linear API error',
      };
    }

    return {
      name: checkName,
      passed: true,
      durationMs: Date.now() - startTime,
      details: {
        viewerName: response.data.data?.viewer?.name,
      },
    };
  } catch (error) {
    return {
      name: checkName,
      passed: false,
      durationMs: Date.now() - startTime,
      error: `Linear token validation failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Check repository access permissions
 */
async function checkRepositoryAccess(projectId: string): Promise<ValidationCheck> {
  const startTime = Date.now();
  const checkName = 'Repository Access';

  try {
    // Get repository config
    const repoConfig = await getProjectRepositoryConfig(projectId);

    // Get GitHub token
    const token = await oauthResolver.resolveGitHubToken(projectId);
    const github = new GitHubProvider(token);

    // Check repository permissions
    const response = await axios.get(
      `https://api.github.com/repos/${repoConfig.owner}/${repoConfig.repo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      }
    );

    if (response.status !== 200) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: `Cannot access repository: ${response.status}`,
      };
    }

    const permissions = response.data.permissions || {};
    const canPush = permissions.push === true;
    const canPull = permissions.pull === true;

    if (!canPush) {
      return {
        name: checkName,
        passed: false,
        durationMs: Date.now() - startTime,
        error: 'No push permission to repository. Cannot create branches or PRs.',
        details: {
          repository: `${repoConfig.owner}/${repoConfig.repo}`,
          permissions,
        },
      };
    }

    return {
      name: checkName,
      passed: true,
      durationMs: Date.now() - startTime,
      details: {
        repository: `${repoConfig.owner}/${repoConfig.repo}`,
        defaultBranch: response.data.default_branch,
        permissions: {
          push: canPush,
          pull: canPull,
          admin: permissions.admin,
        },
      },
    };
  } catch (error) {
    return {
      name: checkName,
      passed: false,
      durationMs: Date.now() - startTime,
      error: `Repository access check failed: ${(error as Error).message}`,
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Reset the Ollama circuit breaker (for recovery scenarios)
 */
export async function resetOllamaCircuitBreaker(): Promise<{ success: boolean }> {
  // This would need to signal the code-generation activities to reset
  // For now, we just return success - the circuit breaker resets on successful call
  logger.info('Ollama circuit breaker reset requested');
  return { success: true };
}

/**
 * Get current system health status
 */
export async function getSystemHealthStatus(
  projectId: string
): Promise<{
  ollama: 'healthy' | 'unhealthy' | 'unknown';
  github: 'healthy' | 'unhealthy' | 'unknown';
  linear: 'healthy' | 'unhealthy' | 'unknown';
}> {
  const checks = await validatePrerequisites({
    projectId,
    taskId: 'health-check',
  });

  const getStatus = (name: string): 'healthy' | 'unhealthy' | 'unknown' => {
    const check = checks.checks.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
    if (!check) return 'unknown';
    return check.passed ? 'healthy' : 'unhealthy';
  };

  return {
    ollama: getStatus('Ollama'),
    github: getStatus('GitHub'),
    linear: getStatus('Linear'),
  };
}
