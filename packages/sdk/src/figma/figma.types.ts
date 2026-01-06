/**
 * Figma API Types
 *
 * Types for Figma file data used in context extraction.
 */

export interface FigmaUser {
  id: string;
  handle: string;
  img_url: string;
  email?: string;
}

export interface FigmaComment {
  id: string;
  message: string;
  file_key: string;
  parent_id?: string;
  user: FigmaUser;
  created_at: string;
  resolved_at?: string;
  order_id?: string;
  client_meta?: {
    node_id?: string;
    node_offset?: { x: number; y: number };
  };
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
}

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  document?: FigmaNode;
}

export interface FigmaScreenshot {
  nodeId: string;
  nodeName: string;
  imageUrl: string;
  imageBase64?: string;
  /** AI-generated description of the screenshot (via vision model) */
  visionAnalysis?: string;
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string>;
}

/**
 * Figma design context for refinement
 * Simplified structure for AI consumption
 */
export interface FigmaDesignContext {
  fileKey: string;
  fileName: string;
  lastModified: string;
  thumbnailUrl: string;
  comments: FigmaComment[];
  screenshots: FigmaScreenshot[];
}

/**
 * Figma Project (from GET /v1/teams/:team_id/projects)
 */
export interface FigmaProject {
  id: string;
  name: string;
}

/**
 * Figma File List Item (from GET /v1/projects/:project_id/files)
 */
export interface FigmaFileListItem {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified: string;
}
