import { Injectable, Logger } from '@nestjs/common';
import {
  FigmaIntegrationService,
  FigmaDesignContext,
  FigmaFile,
  FigmaComment,
  FigmaImagesResponse,
  FigmaScreenshot,
} from '@devflow/sdk';
import { TokenRefreshService } from '@/auth/services/token-refresh.service';

/**
 * Figma API Service
 *
 * NestJS wrapper around FigmaIntegrationService from SDK.
 * This service is injected into controllers and provides Figma API integration.
 *
 * Pattern: NestJS DI → TokenRefreshService → FigmaIntegrationService → FigmaClient
 */
@Injectable()
export class FigmaApiService {
  private readonly logger = new Logger(FigmaApiService.name);
  private readonly figmaService: FigmaIntegrationService;

  constructor(tokenRefresh: TokenRefreshService) {
    // Create the SDK service with TokenRefreshService as the token resolver
    this.figmaService = new FigmaIntegrationService(tokenRefresh);
  }

  /**
   * Get full design context (file metadata, comments, optional screenshot)
   * This is the primary method used for context extraction.
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key from URL
   * @param nodeId - Optional specific node ID to screenshot
   */
  async getDesignContext(
    projectId: string,
    fileKey: string,
    nodeId?: string,
  ): Promise<FigmaDesignContext> {
    this.logger.log(
      `Getting design context for project ${projectId}, file ${fileKey}, node ${nodeId || 'N/A'}`,
    );

    try {
      const context = await this.figmaService.getDesignContext(
        projectId,
        fileKey,
        nodeId,
      );
      this.logger.log(`Successfully retrieved design context: ${context.fileName}`);
      return context;
    } catch (error: any) {
      this.logger.error(
        `Failed to get design context: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get file metadata only
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key from URL
   */
  async getFileMetadata(projectId: string, fileKey: string): Promise<FigmaFile> {
    this.logger.log(`Getting file metadata for project ${projectId}, file ${fileKey}`);

    try {
      return await this.figmaService.getFileMetadata(projectId, fileKey);
    } catch (error: any) {
      this.logger.error(
        `Failed to get file metadata: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get comments on a file
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   */
  async getFileComments(
    projectId: string,
    fileKey: string,
  ): Promise<FigmaComment[]> {
    this.logger.log(`Getting file comments for project ${projectId}, file ${fileKey}`);

    try {
      return await this.figmaService.getFileComments(projectId, fileKey);
    } catch (error: any) {
      this.logger.error(
        `Failed to get file comments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get rendered images for specific nodes
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   * @param nodeIds - Array of node IDs to render
   * @param scale - Image scale (1-4, default 2)
   * @param format - Image format (png, jpg, svg, pdf)
   */
  async getNodeImages(
    projectId: string,
    fileKey: string,
    nodeIds: string[],
    scale: number = 2,
    format: 'png' | 'jpg' | 'svg' | 'pdf' = 'png',
  ): Promise<FigmaImagesResponse> {
    this.logger.log(
      `Getting node images for project ${projectId}, file ${fileKey}, nodes ${nodeIds.join(', ')}`,
    );

    try {
      return await this.figmaService.getNodeImages(
        projectId,
        fileKey,
        nodeIds,
        scale,
        format,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to get node images: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get screenshot for a specific node
   *
   * @param projectId - Project ID for token resolution
   * @param fileKey - Figma file key
   * @param nodeId - Node ID to screenshot
   * @param nodeName - Optional node name for context
   */
  async getScreenshot(
    projectId: string,
    fileKey: string,
    nodeId: string,
    nodeName?: string,
  ): Promise<FigmaScreenshot | null> {
    this.logger.log(
      `Getting screenshot for project ${projectId}, file ${fileKey}, node ${nodeId}`,
    );

    try {
      return await this.figmaService.getScreenshot(
        projectId,
        fileKey,
        nodeId,
        nodeName,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to get screenshot: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
