/**
 * RAG Service
 * Handles semantic search, chunk browsing, and codebase indexing
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createLogger } from '@devflow/common';
import {
  SemanticRetriever,
  SemanticRetrieverConfig,
  HybridRetriever,
  RepositoryIndexer,
  RepositoryIndexerConfig,
  RetrievalResult,
  RetrievalFilter,
  parseRepositoryUrl,
} from '@devflow/sdk';
import { PrismaService } from '@/prisma/prisma.service';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';
import { GitHubAppAuthService } from '@devflow/sdk/dist/auth/github-app-auth.service';
import { SearchQueryDto, BrowseChunksDto, TriggerIndexingDto } from './dto';

export interface RagStats {
  totalChunks: number;
  totalFiles: number;
  totalIndexes: number;
  activeIndex: {
    id: string;
    commitSha: string;
    status: string;
    completedAt: string | null;
    cost: number;
    totalTokens: number;
    branch: string;
  } | null;
  retrieval: {
    totalRetrievals: number;
    averageScore: number;
    averageTimeMs: number;
    totalCost: number;
  };
  languages: { language: string; count: number }[];
  chunkTypes: { chunkType: string; count: number }[];
}

export interface IndexStatus {
  status: 'INDEXING' | 'COMPLETED' | 'FAILED' | null;
  progress?: number;
  totalFiles?: number;
  processedFiles?: number;
  error?: string;
  indexId?: string;
}

export interface PaginatedChunks {
  items: {
    id: string;
    filePath: string;
    content: string;
    language: string;
    chunkType: string;
    startLine: number | null;
    endLine: number | null;
    createdAt: Date;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class RagService {
  private logger = createLogger('RagService');
  private retrieverCache = new Map<string, { semantic: SemanticRetriever; hybrid: HybridRetriever }>();

  constructor(
    private prisma: PrismaService,
    private tokenRefresh: TokenRefreshService,
    private githubAppAuth: GitHubAppAuthService,
  ) {}

  /**
   * Get RAG statistics for a project
   */
  async getStats(projectId: string): Promise<RagStats> {
    this.logger.info('Getting RAG stats', { projectId });

    // Get active index
    const activeIndex = await this.prisma.codebaseIndex.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    // Count total indexes
    const totalIndexes = await this.prisma.codebaseIndex.count({
      where: { projectId },
    });

    // Get chunk stats from active index
    let totalChunks = 0;
    let totalFiles = 0;
    let languages: { language: string; count: number }[] = [];
    let chunkTypes: { chunkType: string; count: number }[] = [];

    if (activeIndex) {
      totalChunks = activeIndex.totalChunks;
      totalFiles = activeIndex.totalFiles;

      // Get language distribution
      const languageGroups = await this.prisma.documentChunk.groupBy({
        by: ['language'],
        where: { codebaseIndexId: activeIndex.id },
        _count: { language: true },
        orderBy: { _count: { language: 'desc' } },
      });
      languages = languageGroups.map(g => ({ language: g.language, count: g._count.language }));

      // Get chunk type distribution
      const typeGroups = await this.prisma.documentChunk.groupBy({
        by: ['chunkType'],
        where: { codebaseIndexId: activeIndex.id },
        _count: { chunkType: true },
        orderBy: { _count: { chunkType: 'desc' } },
      });
      chunkTypes = typeGroups.map(g => ({ chunkType: g.chunkType, count: g._count.chunkType }));
    }

    // Get retrieval stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const retrievalStats = await this.prisma.ragRetrieval.aggregate({
      where: {
        projectId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
      _avg: {
        retrievalTimeMs: true,
      },
      _sum: {
        cost: true,
      },
    });

    // Calculate average score from recent retrievals
    const recentRetrievals = await this.prisma.ragRetrieval.findMany({
      where: {
        projectId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { scores: true },
      take: 100,
    });

    let averageScore = 0;
    if (recentRetrievals.length > 0) {
      const allScores = recentRetrievals.flatMap(r => r.scores);
      if (allScores.length > 0) {
        averageScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
      }
    }

    return {
      totalChunks,
      totalFiles,
      totalIndexes,
      activeIndex: activeIndex
        ? {
            id: activeIndex.id,
            commitSha: activeIndex.commitSha,
            status: activeIndex.status,
            completedAt: activeIndex.completedAt?.toISOString() ?? null,
            cost: activeIndex.cost,
            totalTokens: activeIndex.totalTokens,
            branch: activeIndex.branch,
          }
        : null,
      retrieval: {
        totalRetrievals: retrievalStats._count,
        averageScore,
        averageTimeMs: retrievalStats._avg.retrievalTimeMs ?? 0,
        totalCost: retrievalStats._sum.cost ?? 0,
      },
      languages,
      chunkTypes,
    };
  }

  /**
   * Search using semantic or hybrid retrieval
   */
  async search(projectId: string, dto: SearchQueryDto): Promise<RetrievalResult[]> {
    this.logger.info('Searching', {
      projectId,
      query: dto.query.substring(0, 50),
      retrieverType: dto.retrieverType,
      topK: dto.topK,
    });

    // Check if project has an active index
    const activeIndex = await this.prisma.codebaseIndex.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    if (!activeIndex) {
      throw new BadRequestException(
        'No codebase index found for this project. Please index the codebase first.'
      );
    }

    // Get or create retrievers
    const retrievers = await this.getRetrievers(projectId);

    // Build filter
    const filter: RetrievalFilter | undefined = dto.filter
      ? {
          language: dto.filter.language,
          chunkType: dto.filter.chunkType,
          filePaths: dto.filter.filePaths,
        }
      : undefined;

    // Perform search
    const retrieverType = dto.retrieverType ?? 'semantic';
    let results: RetrievalResult[];

    if (retrieverType === 'hybrid') {
      results = await retrievers.hybrid.retrieve(
        dto.query,
        projectId,
        dto.topK ?? 10,
        filter
      );
    } else {
      results = await retrievers.semantic.retrieve(
        dto.query,
        projectId,
        dto.topK ?? 10,
        filter,
        dto.scoreThreshold
      );
    }

    this.logger.info('Search completed', {
      projectId,
      retrieverType,
      resultCount: results.length,
      avgScore: results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0,
    });

    return results;
  }

  /**
   * Browse indexed chunks with pagination
   */
  async browseChunks(projectId: string, dto: BrowseChunksDto): Promise<PaginatedChunks> {
    this.logger.info('Browsing chunks', { projectId, ...dto });

    // Get active index
    const activeIndex = await this.prisma.codebaseIndex.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });

    if (!activeIndex) {
      return {
        items: [],
        pagination: {
          page: dto.page ?? 1,
          limit: dto.limit ?? 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: {
      codebaseIndexId: string;
      language?: string;
      chunkType?: string;
      filePath?: { startsWith: string };
      content?: { contains: string; mode: 'insensitive' };
    } = {
      codebaseIndexId: activeIndex.id,
    };

    if (dto.language) {
      where.language = dto.language;
    }
    if (dto.chunkType) {
      where.chunkType = dto.chunkType;
    }
    if (dto.filePath) {
      where.filePath = { startsWith: dto.filePath };
    }
    if (dto.search) {
      where.content = { contains: dto.search, mode: 'insensitive' };
    }

    // Get total count
    const total = await this.prisma.documentChunk.count({ where });

    // Get chunks
    const chunks = await this.prisma.documentChunk.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ filePath: 'asc' }, { chunkIndex: 'asc' }],
      select: {
        id: true,
        filePath: true,
        content: true,
        language: true,
        chunkType: true,
        startLine: true,
        endLine: true,
        createdAt: true,
      },
    });

    return {
      items: chunks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Trigger codebase re-indexing
   */
  async triggerReindex(projectId: string, dto: TriggerIndexingDto): Promise<{ indexId: string; message: string }> {
    this.logger.info('Triggering re-indexing', { projectId, ...dto });

    // Get project with repository info
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        repository: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if repository is linked
    if (!project.repository) {
      throw new BadRequestException(
        'No repository linked to this project. Please link a GitHub repository first.'
      );
    }

    // Parse repository URL to extract owner and repo
    const repoInfo = parseRepositoryUrl(project.repository);
    if (!repoInfo) {
      throw new BadRequestException(
        'Invalid repository URL format. Please use a valid GitHub URL.'
      );
    }
    const { owner, repo } = repoInfo;

    // Check if indexing is already in progress
    const existingIndexing = await this.prisma.codebaseIndex.findFirst({
      where: {
        projectId,
        status: { in: ['PENDING', 'INDEXING'] },
      },
    });

    if (existingIndexing && !dto.force) {
      throw new BadRequestException(
        `Indexing already in progress (${existingIndexing.id}). Use force=true to start a new one.`
      );
    }

    // Get GitHub token - try GitHub App first, then fallback to OAuth
    let githubToken: string;
    try {
      // Try GitHub App first
      const installation = await this.prisma.gitHubAppInstallation.findFirst({
        where: {
          projectId,
          isActive: true,
          isSuspended: false,
        },
      });

      if (installation) {
        // Use GitHub App installation token
        this.logger.info('Using GitHub App for token', { projectId, installationId: installation.installationId });
        const app = await this.githubAppAuth.createApp(projectId);
        const octokit = await app.getInstallationOctokit(Number(installation.installationId));
        // Create installation access token
        const { data: tokenData } = await octokit.request('POST /app/installations/{installation_id}/access_tokens', {
          installation_id: Number(installation.installationId),
        });
        githubToken = tokenData.token;
      } else {
        // Fallback to OAuth
        this.logger.info('No GitHub App found, trying OAuth', { projectId });
        githubToken = await this.tokenRefresh.getAccessToken(projectId, 'GITHUB');
      }
    } catch (error) {
      this.logger.error('Failed to get GitHub token', error as Error);
      throw new BadRequestException(
        'GitHub not configured for this project. Please connect GitHub App in Integrations or OAuth.'
      );
    }

    // Create indexer
    const indexerConfig: RepositoryIndexerConfig = {
      githubToken,
      embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
      embeddingsBaseURL: 'https://openrouter.ai/api/v1',
      qdrantHost: process.env.QDRANT_HOST || 'localhost',
      qdrantPort: parseInt(process.env.QDRANT_PORT || '6333', 10),
      collectionName: `devflow_${projectId.replace(/-/g, '_')}`,
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    };

    const indexer = new RepositoryIndexer(indexerConfig);

    // Start indexing (async - runs in background)
    // The SDK's RepositoryIndexer creates and manages its own codebaseIndex record
    const indexPromise = indexer.indexRepository(owner, repo, projectId);

    // Handle completion/failure in background
    indexPromise
      .then(indexId => {
        this.logger.info('Indexing completed', { projectId, indexId });
        // Clear retriever cache to use new index
        this.retrieverCache.delete(projectId);
      })
      .catch(err => {
        this.logger.error(`Indexing failed for project ${projectId}: ${(err as Error).message}`, err as Error, { projectId });
      });

    // Wait briefly for the SDK to create its INDEXING record
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find the index record created by the SDK
    const sdkIndex = await this.prisma.codebaseIndex.findFirst({
      where: {
        projectId,
        status: { in: ['INDEXING', 'COMPLETED'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    return {
      indexId: sdkIndex?.id ?? 'indexing-started',
      message: `Indexing started for ${owner}/${repo}. This may take several minutes.`,
    };
  }

  /**
   * Get current indexing status
   */
  async getIndexStatus(projectId: string): Promise<IndexStatus> {
    this.logger.info('Getting index status', { projectId });

    // Check for in-progress indexing (SDK uses 'INDEXING', not 'PENDING')
    const currentIndex = await this.prisma.codebaseIndex.findFirst({
      where: {
        projectId,
        status: 'INDEXING',
      },
      orderBy: { startedAt: 'desc' },
    });

    if (currentIndex) {
      return {
        status: 'INDEXING',
        totalFiles: currentIndex.totalFiles,
        processedFiles: currentIndex.indexedFiles.length,
        progress: currentIndex.totalFiles > 0
          ? Math.round((currentIndex.indexedFiles.length / currentIndex.totalFiles) * 100)
          : 0,
        indexId: currentIndex.id,
      };
    }

    // Check for latest completed or failed index
    const latestIndex = await this.prisma.codebaseIndex.findFirst({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
    });

    if (!latestIndex) {
      return { status: null };
    }

    // Treat orphaned PENDING records (from old API behavior) as failed
    if (latestIndex.status === 'PENDING') {
      return {
        status: 'FAILED',
        error: 'Previous indexing attempt was interrupted. Please try again.',
        indexId: latestIndex.id,
      };
    }

    if (latestIndex.status === 'FAILED') {
      return {
        status: 'FAILED',
        error: 'Indexing failed. Please try again.',
        indexId: latestIndex.id,
      };
    }

    return {
      status: latestIndex.status as 'COMPLETED',
      totalFiles: latestIndex.totalFiles,
      processedFiles: latestIndex.totalFiles,
      progress: 100,
      indexId: latestIndex.id,
    };
  }

  /**
   * Get or create retrievers for a project
   */
  private async getRetrievers(projectId: string): Promise<{ semantic: SemanticRetriever; hybrid: HybridRetriever }> {
    // Check cache
    const cached = this.retrieverCache.get(projectId);
    if (cached) {
      return cached;
    }

    // Create new retrievers
    const config: SemanticRetrieverConfig = {
      embeddingsApiKey: process.env.OPENROUTER_API_KEY!,
      embeddingsBaseURL: 'https://openrouter.ai/api/v1',
      qdrantHost: process.env.QDRANT_HOST || 'localhost',
      qdrantPort: parseInt(process.env.QDRANT_PORT || '6333', 10),
      collectionName: `devflow_${projectId.replace(/-/g, '_')}`,
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
    };

    const semantic = new SemanticRetriever(config);
    const hybrid = new HybridRetriever(semantic);

    // Cache for reuse
    this.retrieverCache.set(projectId, { semantic, hybrid });

    return { semantic, hybrid };
  }
}
