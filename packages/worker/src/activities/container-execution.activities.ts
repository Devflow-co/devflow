/**
 * Container Execution Activities - Phase 4 V2
 *
 * Temporal activities for executing code validation in isolated Docker containers.
 * Handles: clone → apply files → install → lint → typecheck → test
 */

import { createLogger } from '@devflow/common';
import type {
  ExecuteInContainerInput,
  ExecuteInContainerOutput,
  GeneratedFile,
} from '@devflow/common';
import {
  ContainerExecutorService,
  CredentialInjectorService,
} from '@devflow/sdk';
import { oauthResolver } from '@/services/oauth-context';
import { getProjectRepositoryConfig } from './codebase.activities';

const logger = createLogger('ContainerExecutionActivities');

// ============================================
// Service Instances
// ============================================

let containerExecutor: ContainerExecutorService | null = null;
const credentialInjector = new CredentialInjectorService();

/**
 * Get or create the container executor service instance
 */
function getContainerExecutor(): ContainerExecutorService {
  if (!containerExecutor) {
    containerExecutor = new ContainerExecutorService({
      dockerHost: process.env.DOCKER_HOST || '/var/run/docker.sock',
      defaultMemory: process.env.CONTAINER_DEFAULT_MEMORY || '2g',
      defaultCpuShares: parseInt(process.env.CONTAINER_DEFAULT_CPU_SHARES || '1024'),
      defaultTimeout: parseInt(process.env.CONTAINER_DEFAULT_TIMEOUT || '600000'),
      maxConcurrent: parseInt(process.env.CONTAINER_MAX_CONCURRENT || '5'),
    });
  }
  return containerExecutor;
}

// ============================================
// Input/Output Types
// ============================================

export interface ExecuteInContainerActivityInput {
  /** Project ID for OAuth token resolution */
  projectId: string;
  /** Task ID for logging and container naming */
  taskId: string;
  /** Generated files to apply and validate */
  generatedFiles: GeneratedFile[];
  /** Commands to run in container */
  commands?: {
    /** Install command (default: npm ci) */
    install?: string;
    /** Lint command (optional) */
    lint?: string;
    /** Typecheck command (optional) */
    typecheck?: string;
    /** Test command (optional) */
    test?: string;
  };
  /** Container configuration */
  containerConfig?: {
    /** Docker image (default: node:20-alpine) */
    image?: string;
    /** Memory limit (default: 2g) */
    memory?: string;
    /** Timeout in milliseconds (default: 600000 = 10 min) */
    timeout?: number;
  };
  /** Optional branch to use (default: default branch from repo config) */
  branch?: string;
}

// ============================================
// Main Activity
// ============================================

/**
 * Execute generated code validation in an isolated Docker container
 *
 * Workflow:
 * 1. Resolve GitHub OAuth token
 * 2. Get repository configuration
 * 3. Spawn ephemeral container
 * 4. Clone repository (with token)
 * 5. Apply generated files
 * 6. Run install, lint, typecheck, test (as configured)
 * 7. Collect results and cleanup
 *
 * Security:
 * - Container runs with minimal privileges
 * - Auto-removed after execution
 * - Token injected via env (not persisted)
 */
export async function executeInContainer(
  input: ExecuteInContainerActivityInput
): Promise<ExecuteInContainerOutput> {
  const { projectId, taskId, generatedFiles, commands, containerConfig, branch } = input;

  logger.info('Starting container execution', {
    projectId,
    taskId,
    fileCount: generatedFiles.length,
    hasLint: !!commands?.lint,
    hasTypecheck: !!commands?.typecheck,
    hasTest: !!commands?.test,
  });

  const executor = getContainerExecutor();

  // Check if Docker is available
  const dockerAvailable = await executor.isDockerAvailable();
  if (!dockerAvailable) {
    logger.error('Docker is not available for container execution');
    throw new Error(
      'Docker is not available. Ensure Docker is running and the socket is accessible.'
    );
  }

  try {
    // Step 1: Resolve GitHub token
    const githubToken = await oauthResolver.resolveGitHubToken(projectId);
    if (!githubToken) {
      throw new Error('GitHub OAuth token not found for project');
    }

    // Step 2: Get repository configuration
    const repoConfig = await getProjectRepositoryConfig(projectId);

    // Step 3: Validate credentials
    const credentialValidation = credentialInjector.validateCredentials({
      githubToken,
    });
    if (!credentialValidation.valid) {
      logger.warn('Credential validation warnings', {
        errors: credentialValidation.errors,
      });
    }

    // Step 4: Build container input
    const containerInput: ExecuteInContainerInput = {
      projectId,
      taskId,
      repository: {
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        branch: branch || 'main',
      },
      generatedFiles,
      commands: {
        install: commands?.install || 'npm ci',
        lint: commands?.lint,
        typecheck: commands?.typecheck,
        test: commands?.test,
      },
      timeout: containerConfig?.timeout || 600000,
      image: containerConfig?.image || 'node:20-alpine',
      memory: containerConfig?.memory || '2g',
    };

    // Step 5: Execute in container
    // Note: The container executor will inject the GitHub token via environment
    // This requires modifying the executor to accept credentials
    // For now, we'll set the GITHUB_TOKEN environment variable
    process.env.CONTAINER_GITHUB_TOKEN = githubToken;

    const result = await executor.execute(containerInput);

    // Step 6: Mask sensitive data in logs
    result.logs = credentialInjector.maskSensitiveValues(result.logs);

    // Step 7: Log results
    logger.info('Container execution completed', {
      taskId,
      success: result.success,
      duration: result.duration,
      failedPhase: result.failedPhase,
      testsPassed: result.testResults?.passed || 0,
      testsFailed: result.testResults?.failed || 0,
    });

    // Clear sensitive data
    delete process.env.CONTAINER_GITHUB_TOKEN;
    credentialInjector.clearMaskedValues();

    return result;
  } catch (error) {
    logger.error('Container execution failed', error as Error, {
      taskId,
      projectId,
    });

    // Clear sensitive data on error
    delete process.env.CONTAINER_GITHUB_TOKEN;
    credentialInjector.clearMaskedValues();

    throw error;
  }
}

// ============================================
// Health Check Activity
// ============================================

export interface DockerHealthCheckOutput {
  /** Whether Docker is available */
  available: boolean;
  /** Number of currently active containers */
  activeContainers: number;
  /** Docker socket path */
  socketPath: string;
  /** Error message if not available */
  error?: string;
}

/**
 * Check if Docker is available for container execution
 */
export async function checkDockerHealth(): Promise<DockerHealthCheckOutput> {
  const executor = getContainerExecutor();
  const socketPath = process.env.DOCKER_HOST || '/var/run/docker.sock';

  try {
    const available = await executor.isDockerAvailable();
    return {
      available,
      activeContainers: executor.getActiveContainerCount(),
      socketPath,
    };
  } catch (error) {
    return {
      available: false,
      activeContainers: 0,
      socketPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get default commands for a project based on detected language/framework
 */
export function getDefaultCommands(
  project?: { language: string; framework?: string; testFramework?: string }
): NonNullable<ExecuteInContainerActivityInput['commands']> {
  const language = project?.language?.toLowerCase() || 'typescript';
  const framework = project?.framework?.toLowerCase();

  // Node.js / TypeScript defaults
  if (language === 'typescript' || language === 'javascript' || framework === 'node') {
    return {
      install: 'npm ci',
      lint: 'npm run lint --if-present',
      typecheck: language === 'typescript' ? 'npm run typecheck --if-present' : undefined,
      test: 'npm test --if-present',
    };
  }

  // Python defaults
  if (language === 'python') {
    return {
      install: 'pip install -r requirements.txt',
      lint: 'ruff check . || flake8 .',
      typecheck: 'mypy . --ignore-missing-imports',
      test: 'pytest',
    };
  }

  // Go defaults
  if (language === 'go') {
    return {
      install: 'go mod download',
      lint: 'golangci-lint run',
      typecheck: 'go build ./...',
      test: 'go test ./...',
    };
  }

  // Default to Node.js
  return {
    install: 'npm ci',
    lint: 'npm run lint --if-present',
    typecheck: 'npm run typecheck --if-present',
    test: 'npm test --if-present',
  };
}

/**
 * Get default container image for a project based on detected language
 */
export function getDefaultImage(
  project?: { language: string }
): string {
  const language = project?.language?.toLowerCase() || 'typescript';

  const imageMap: Record<string, string> = {
    typescript: 'node:20-alpine',
    javascript: 'node:20-alpine',
    python: 'python:3.11-slim',
    go: 'golang:1.21-alpine',
    rust: 'rust:1.74-alpine',
    java: 'eclipse-temurin:21-jdk-alpine',
    kotlin: 'eclipse-temurin:21-jdk-alpine',
    ruby: 'ruby:3.2-alpine',
    php: 'php:8.2-cli-alpine',
  };

  return imageMap[language] || 'node:20-alpine';
}
