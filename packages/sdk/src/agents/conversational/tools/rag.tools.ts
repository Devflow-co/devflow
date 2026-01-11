/**
 * RAG Tools - Tools for searching and retrieving codebase context
 */

import { RegisteredTool } from './tool.types';
import { defineTool } from '../tool-registry';

/**
 * Search codebase using semantic search
 */
const ragSearchCodebase = defineTool(
  'rag_search_codebase',
  'Search the codebase using semantic search (RAG). Returns relevant code chunks based on the query. Use this to find implementations, patterns, or understand how things work.',
  {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g., "authentication middleware implementation", "how are database connections handled")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 20)',
      },
      language: {
        type: 'string',
        description: 'Filter by programming language (e.g., "typescript", "python")',
      },
      filePath: {
        type: 'string',
        description: 'Filter to a specific file or directory path',
      },
    },
    required: ['query'],
  },
  async (args, context) => {
    const { query, limit, language, filePath } = args as {
      query: string;
      limit?: number;
      language?: string;
      filePath?: string;
    };

    if (!context.services.rag?.searchCodebase) {
      throw new Error('RAG service not available');
    }

    const maxLimit = Math.min(limit ?? 5, 20);
    const results = await context.services.rag.searchCodebase(query, maxLimit);

    // Format results for readability
    return {
      query,
      count: results.length,
      results: results.map((r, i) => ({
        rank: i + 1,
        filepath: r.filepath,
        content: r.content,
        score: Math.round(r.score * 100) / 100,
        metadata: r.metadata,
      })),
    };
  },
  'rag'
);

/**
 * Get a specific file from the codebase
 */
const ragGetFile = defineTool(
  'rag_get_file',
  'Get the full contents of a specific file from the codebase. Use this when you know the exact file path.',
  {
    type: 'object',
    properties: {
      filepath: {
        type: 'string',
        description: 'Full path to the file (e.g., "src/services/auth.service.ts")',
      },
    },
    required: ['filepath'],
  },
  async (args, context) => {
    const { filepath } = args as { filepath: string };

    if (!context.services.rag?.getFile) {
      throw new Error('RAG service not available');
    }

    const content = await context.services.rag.getFile(filepath);

    if (!content) {
      return {
        success: false,
        error: `File not found: ${filepath}`,
        suggestion: 'Use rag_search_codebase to find the correct file path',
      };
    }

    return {
      filepath,
      content,
      lines: content.split('\n').length,
    };
  },
  'rag'
);

/**
 * Get directory structure
 */
const ragGetDirectoryTree = defineTool(
  'rag_get_directory_tree',
  'Get the directory structure of the codebase. Use this to understand how files are organized.',
  {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list (default: root). E.g., "src", "src/services"',
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse (default: 3)',
      },
    },
    required: [],
  },
  async (args, context) => {
    const { path, depth } = args as { path?: string; depth?: number };

    if (!context.services.rag?.getDirectoryTree) {
      throw new Error('RAG service not available');
    }

    const tree = await context.services.rag.getDirectoryTree(path || '');

    return {
      path: path || '/',
      tree,
    };
  },
  'rag'
);

/**
 * All RAG tools
 */
export const ragTools: RegisteredTool[] = [
  ragSearchCodebase,
  ragGetFile,
  ragGetDirectoryTree,
];

export {
  ragSearchCodebase,
  ragGetFile,
  ragGetDirectoryTree,
};
