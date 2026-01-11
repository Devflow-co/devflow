/**
 * GitHub Tools - Tools for interacting with GitHub repositories
 */

import { RegisteredTool } from './tool.types';
import { defineTool } from '../tool-registry';

/**
 * Get repository information
 */
const githubGetRepo = defineTool(
  'github_get_repo',
  'Get information about a GitHub repository including name, description, default branch, stars, and language.',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner (username or organization)',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
    },
    required: ['owner', 'repo'],
  },
  async (args, context) => {
    const { owner, repo } = args as { owner: string; repo: string };

    if (!context.services.github?.getRepo) {
      throw new Error('GitHub service not available');
    }

    const repository = await context.services.github.getRepo(owner, repo);
    return repository;
  },
  'github'
);

/**
 * Get file contents from a repository
 */
const githubGetFile = defineTool(
  'github_get_file',
  'Get the contents of a file from a GitHub repository. Returns the file content as a string.',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      path: {
        type: 'string',
        description: 'File path within the repository (e.g., "src/index.ts")',
      },
    },
    required: ['owner', 'repo', 'path'],
  },
  async (args, context) => {
    const { owner, repo, path } = args as { owner: string; repo: string; path: string };

    if (!context.services.github?.getFile) {
      throw new Error('GitHub service not available');
    }

    const file = await context.services.github.getFile(owner, repo, path);
    return file;
  },
  'github'
);

/**
 * Create a new branch
 */
const githubCreateBranch = defineTool(
  'github_create_branch',
  'Create a new branch in a GitHub repository from an existing branch (usually main or master).',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      branch: {
        type: 'string',
        description: 'New branch name (e.g., "feature/add-login")',
      },
      base: {
        type: 'string',
        description: 'Base branch to create from (default: "main")',
      },
    },
    required: ['owner', 'repo', 'branch'],
  },
  async (args, context) => {
    const { owner, repo, branch, base } = args as {
      owner: string;
      repo: string;
      branch: string;
      base?: string;
    };

    if (!context.services.github?.createBranch) {
      throw new Error('GitHub service not available');
    }

    const result = await context.services.github.createBranch(
      owner,
      repo,
      branch,
      base || 'main'
    );

    return result;
  },
  'github'
);

/**
 * Commit files to a branch
 */
const githubCommitFiles = defineTool(
  'github_commit_files',
  'Commit one or more files to a branch in a GitHub repository. Can create or update files.',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      branch: {
        type: 'string',
        description: 'Branch to commit to',
      },
      files: {
        type: 'array',
        description: 'Array of files to commit',
        items: {
          type: 'object',
        },
      },
      message: {
        type: 'string',
        description: 'Commit message (follow conventional commits format)',
      },
    },
    required: ['owner', 'repo', 'branch', 'files', 'message'],
  },
  async (args, context) => {
    const { owner, repo, branch, files, message } = args as {
      owner: string;
      repo: string;
      branch: string;
      files: Array<{ path: string; content: string }>;
      message: string;
    };

    if (!context.services.github?.commitFiles) {
      throw new Error('GitHub service not available');
    }

    const result = await context.services.github.commitFiles({
      owner,
      repo,
      branch,
      files,
      message,
    });

    return result;
  },
  'github'
);

/**
 * Create a pull request
 */
const githubCreatePR = defineTool(
  'github_create_pr',
  'Create a pull request to merge changes from one branch into another.',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      title: {
        type: 'string',
        description: 'Pull request title',
      },
      body: {
        type: 'string',
        description: 'Pull request description (markdown supported)',
      },
      head: {
        type: 'string',
        description: 'Branch containing the changes',
      },
      base: {
        type: 'string',
        description: 'Branch to merge into (usually "main")',
      },
    },
    required: ['owner', 'repo', 'title', 'head', 'base'],
  },
  async (args, context) => {
    const { owner, repo, title, body, head, base } = args as {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      head: string;
      base: string;
    };

    if (!context.services.github?.createPR) {
      throw new Error('GitHub service not available');
    }

    const pr = await context.services.github.createPR({
      owner,
      repo,
      title,
      body: body || '',
      head,
      base,
    });

    return pr;
  },
  'github'
);

/**
 * Get CI/CD pipeline status
 */
const githubGetPipelineStatus = defineTool(
  'github_get_pipeline_status',
  'Get the CI/CD pipeline (GitHub Actions) status for a specific branch.',
  {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      branch: {
        type: 'string',
        description: 'Branch name to check status for',
      },
    },
    required: ['owner', 'repo', 'branch'],
  },
  async (args, context) => {
    const { owner, repo, branch } = args as {
      owner: string;
      repo: string;
      branch: string;
    };

    if (!context.services.github?.getPipelineStatus) {
      throw new Error('GitHub service not available');
    }

    const status = await context.services.github.getPipelineStatus(owner, repo, branch);
    return status;
  },
  'github'
);

/**
 * All GitHub tools
 */
export const githubTools: RegisteredTool[] = [
  githubGetRepo,
  githubGetFile,
  githubCreateBranch,
  githubCommitFiles,
  githubCreatePR,
  githubGetPipelineStatus,
];

export {
  githubGetRepo,
  githubGetFile,
  githubCreateBranch,
  githubCommitFiles,
  githubCreatePR,
  githubGetPipelineStatus,
};
