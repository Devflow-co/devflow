/**
 * Figma Integration Module
 *
 * Exports Figma client and types for context extraction.
 */

export { FigmaClient, createFigmaClient } from './figma.client';
export {
  FigmaIntegrationService,
  createFigmaIntegrationService,
} from './figma-integration.service';
export type {
  FigmaFile,
  FigmaComment,
  FigmaScreenshot,
  FigmaDesignContext,
  FigmaUser,
  FigmaNode,
  FigmaImagesResponse,
} from './figma.types';
